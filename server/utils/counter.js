import { Business, Counter, Customer, Supplier, User } from '../models/index.js';

/**
 * Generates an auto-suggested Arthi Code (2-5 uppercase alphanumeric chars) from business name.
 * e.g. "Rehman Traders" -> "RT"
 * e.g. "Bismillah Fruit Mandi" -> "BFM"
 */
export function generateSuggestedArthiCode(businessName = '') {
  if (!businessName || typeof businessName !== 'string') {
    return 'MC'; // Mandi Commission
  }

  // Remove special characters and clean
  const clean = businessName.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 'MC';

  if (words.length === 1) {
    const single = words[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
    return single.length >= 2 ? single.substring(0, Math.min(5, Math.max(2, single.length))) : (single + 'M').substring(0, 2);
  }

  // Multiple words: extract first letters
  let code = words.map(w => w[0].toUpperCase()).join('');
  if (code.length < 2) {
    code = (words[0].substring(0, 2)).toUpperCase();
  }
  return code.substring(0, 5);
}

/**
 * Validates Arthi Code: 2 to 5 uppercase alphanumeric characters.
 */
export function validateArthiCode(code = '') {
  if (!code || typeof code !== 'string') return false;
  const regex = /^[A-Za-z0-9]{2,5}$/;
  return regex.test(code.trim());
}

/**
 * Retrieve Arthi Code for a given tenant.
 */
export async function getBusinessArthiCode(tenantId) {
  if (!tenantId) return 'MC';
  const biz = await Business.findOne({ tenantId });
  if (biz && biz.arthiCode) {
    return biz.arthiCode.toUpperCase().trim();
  }
  if (biz && (biz.businessName || biz.name)) {
    return generateSuggestedArthiCode(biz.businessName || biz.name);
  }
  return 'MC';
}

/**
 * Live preview of next Khata ID without incrementing sequence counter.
 */
export async function peekNextKhataId(tenantId, role = 'Customer') {
  const arthiCode = await getBusinessArthiCode(tenantId);
  const prefix = role === 'Supplier' ? 'S' : 'C';

  const counter = await Counter.findOne({ tenantId, role });
  const currentSeq = counter ? (Number(counter.seq) || 0) : 0;
  const nextSeq = currentSeq + 1;

  const nextKhataId = `${arthiCode}-${prefix}-${nextSeq}`;
  return {
    nextKhataId,
    seq: nextSeq,
    arthiCode,
    role
  };
}

/**
 * Atomically generates and increments the Khata ID counter for the given business tenant & role.
 * Scoped by { tenantId, role }.
 */
export async function getNextKhataId(tenantId, role = 'Customer') {
  const arthiCode = await getBusinessArthiCode(tenantId);
  const prefix = role === 'Supplier' ? 'S' : 'C';

  // Atomic counter pattern using findOneAndUpdate + $inc
  const updatedCounter = await Counter.findOneAndUpdate(
    { tenantId, role },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  const seq = updatedCounter ? updatedCounter.seq : 1;
  const khataId = `${arthiCode}-${prefix}-${seq}`;

  return {
    khataId,
    seq,
    arthiCode,
    role
  };
}

/**
 * Adjusts counter if a user manually assigned a higher sequence number to avoid collisions later.
 */
export async function syncCounterIfNeeded(tenantId, role, manualKhataId) {
  if (!manualKhataId || typeof manualKhataId !== 'string') return;
  const match = manualKhataId.trim().match(/-([CS])-(\d+)$/i);
  if (match && match[2]) {
    const num = parseInt(match[2], 10);
    if (!isNaN(num) && num > 0) {
      const current = await Counter.findOne({ tenantId, role });
      if (!current || (current.seq || 0) < num) {
        await Counter.findOneAndUpdate(
          { tenantId, role },
          { $set: { seq: num } },
          { upsert: true, new: true }
        );
      }
    }
  }
}

/**
 * Validate uniqueness of Khata ID within a tenant for Customer / Supplier.
 */
export async function isKhataIdUnique(tenantId, role, khataId, excludeId = null) {
  if (!khataId || typeof khataId !== 'string') return true;
  const cleanId = khataId.trim().toUpperCase();

  const Model = role === 'Supplier' ? Supplier : Customer;
  const allItems = await Model.find({ tenantId, isDeleted: { $ne: true } });

  const duplicate = allItems.find(item => {
    const itemId = item.id || item._id?.toString();
    if (excludeId && String(itemId) === String(excludeId)) {
      return false;
    }
    return item.khataId && item.khataId.trim().toUpperCase() === cleanId;
  });

  return !duplicate;
}
