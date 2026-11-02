import 'dotenv/config';
import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

const mongoUriFromEnv = process.env.MONGODB_URI?.trim();
// Some Mongo-compatible deployments reject retryable writes. Disable them in
// both the URI and driver options so an existing retryWrites=true URI value
// cannot cause writes to fail on those deployments.
const mongoUri = mongoUriFromEnv
  ? (() => {
      const normalizedUri = mongoUriFromEnv.replace(/([?&])retryWrites=[^&]*/i, '$1retryWrites=false');
      if (normalizedUri !== mongoUriFromEnv) return normalizedUri;
      const separator = /[?&]$/.test(normalizedUri) ? '' : (normalizedUri.includes('?') ? '&' : '?');
      return `${normalizedUri}${separator}retryWrites=false`;
    })()
  : undefined;

// Production-ready MongoDB connection options
const connectOptions = {
  retryWrites: false,
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  maxPoolSize: 50,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
};

let isConnected = false;
let connectPromise = null;

// Track connection lifecycle events
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('✅ [MongoDB] Database connected successfully.');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('❌ [MongoDB] Connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️ [MongoDB] Connection lost. Waiting for automatic reconnection...');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('🔄 [MongoDB] Reconnected to cluster.');
});

if (mongoUri) {
  console.log('🚀 [MongoDB] Initializing connection to MongoDB cluster in strict mode...');
  
  connectPromise = mongoose.connect(mongoUri, connectOptions)
    .then(async () => {
      isConnected = true;
      console.log('✅ [MongoDB] Cluster online. Running schema index checks...');
      
      try {
        if (mongoose.connection.db) {
          const collections = await mongoose.connection.db.listCollections().toArray();
          const collectionNames = collections.map(c => c.name);

          // Clean legacy duplicate indexes
          if (collectionNames.includes('paymentmethods')) {
            const indexes = await mongoose.connection.db.collection('paymentmethods').indexes();
            const nameIndex = indexes.find(i => i.name === 'name_1' && i.unique);
            if (nameIndex) {
              await mongoose.connection.db.collection('paymentmethods').dropIndex('name_1').catch(() => {});
            }
          }

          if (collectionNames.includes('expensecategories')) {
            const indexes = await mongoose.connection.db.collection('expensecategories').indexes();
            const nameIndex = indexes.find(i => i.name === 'name_1' && i.unique);
            if (nameIndex) {
              await mongoose.connection.db.collection('expensecategories').dropIndex('name_1').catch(() => {});
            }
          }

          // Handle Users collection indexes (fix E11000 duplicate key error on email: null)
          if (collectionNames.includes('users')) {
            const usersColl = mongoose.connection.db.collection('users');
            try {
              // 1. Unset null or empty emails on existing user records
              await usersColl.updateMany(
                { $or: [{ email: null }, { email: '' }, { email: { $exists: true, $type: 10 } }] },
                { $unset: { email: "" } }
              );

              // 2. Drop any legacy non-partial email index
              const userIndexes = await usersColl.indexes();
              const legacyEmailIdx = userIndexes.find(i => i.name === 'email_1' || (i.key && i.key.email && !i.partialFilterExpression));
              if (legacyEmailIdx) {
                console.log(`[MongoDB] Dropping legacy email index '${legacyEmailIdx.name}' on users...`);
                await usersColl.dropIndex(legacyEmailIdx.name).catch(() => {});
              }

              // 3. Create a safe partial unique index that only indexes actual non-empty email strings
              await usersColl.createIndex(
                { email: 1 },
                {
                  unique: true,
                  sparse: true,
                  partialFilterExpression: { email: { $type: 'string', $gt: '' } },
                  background: true
                }
              ).catch(() => {});
            } catch (userIndexErr) {
              console.warn('[MongoDB] Note on users index setup:', userIndexErr.message);
            }
          }

          // Clean legacy unique email indexes on customers and suppliers if present
          for (const collName of ['customers', 'suppliers', 'employees']) {
            if (collectionNames.includes(collName)) {
              try {
                const coll = mongoose.connection.db.collection(collName);
                const collIndexes = await coll.indexes();
                for (const idx of collIndexes) {
                  if (idx.name === 'email_1' || (idx.key && idx.key.email && !idx.partialFilterExpression)) {
                    await coll.dropIndex(idx.name).catch(() => {});
                  }
                }
              } catch  {
                // Ignore
              }
            }
          }
        }
      } catch (idxErr) {
        console.warn('[MongoDB] Index verification warning:', idxErr.message);
      }
    })
    .catch((err) => {
      isConnected = false;
      console.error('❌ [MongoDB] Failed to connect to MongoDB cluster:', err.message);
    });
} else {
  console.error('❌ [MongoDB Critical] MONGODB_URI environment variable is missing! MandiOS runs in strict MongoDB-only mode.');
}

/**
 * Ensures MongoDB is connected before running queries.
 * Throws a clean 503-compatible Error if MongoDB is unavailable.
 */
export async function ensureDBConnected() {
  if (connectPromise) {
    try {
      await connectPromise;
    } catch {
      // Handled by connection state check below
    }
  }

  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Database is offline. MandiOS is running in strict MongoDB mode — please verify your MONGODB_URI and MongoDB cluster status.');
    error.name = 'DatabaseOfflineError';
    error.status = 503;
    throw error;
  }
}

export async function withMongoTransaction(work) {
  await ensureDBConnected();
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Strict MongoDB Model Wrapper
 * Standardizes document queries and ensures clean projection handling across all collections.
 */
class ModelWrapper {
  constructor(name, mongooseModel) {
    this.name = name;
    this.mongooseModel = mongooseModel;
  }

  async find(query = {}, options = {}) {
    await ensureDBConnected();
    let request = this.mongooseModel.find(query);
    if (options.session) request = request.session(options.session);
    return request.lean();
  }

  async findOne(query, options = {}) {
    await ensureDBConnected();
    let request = this.mongooseModel.findOne(query);
    if (options.session) request = request.session(options.session);
    return request.lean();
  }

  async findById(id, options = {}) {
    await ensureDBConnected();
    let request = this.mongooseModel.findById(id);
    if (options.session) request = request.session(options.session);
    return request.lean();
  }

  async create(doc, options = {}) {
    await ensureDBConnected();
    const cleanDoc = { ...doc };
    // If email is empty, whitespace, or null, remove it so Mongo doesn't index a null value
    if (cleanDoc.email !== undefined && (!cleanDoc.email || !String(cleanDoc.email).trim())) {
      delete cleanDoc.email;
    }

    const result = options.session
      ? (await this.mongooseModel.create([cleanDoc], { session: options.session }))[0]
      : await this.mongooseModel.create(cleanDoc);
    return result.toObject ? result.toObject() : result;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    await ensureDBConnected();
    const cleanUpdate = { ...update };

    if (cleanUpdate.email !== undefined && (!cleanUpdate.email || !String(cleanUpdate.email).trim())) {
      delete cleanUpdate.email;
      cleanUpdate.$unset = { ...(cleanUpdate.$unset || {}), email: "" };
    }

    return this.mongooseModel.findByIdAndUpdate(
      id,
      cleanUpdate,
      { new: true, ...options }
    ).lean();
  }

  async findByIdAndDelete(id, options = {}) {
    await ensureDBConnected();
    let request = this.mongooseModel.findByIdAndDelete(id);
    if (options.session) request = request.session(options.session);
    return request.lean();
  }

  async countDocuments(query = {}, options = {}) {
    await ensureDBConnected();
    let request = this.mongooseModel.countDocuments(query);
    if (options.session) request = request.session(options.session);
    return request;
  }

  async findOneAndUpdate(query = {}, update = {}, options = {}) {
    await ensureDBConnected();
    return this.mongooseModel.findOneAndUpdate(
      query,
      update,
      { new: true, ...options }
    ).lean();
  }
}

const useMongoDB = true;

export { useMongoDB, ModelWrapper };
