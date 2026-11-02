import mongoose from 'mongoose';
import { ModelWrapper } from '../config/db.js';

const Schema = mongoose.Schema;

// 0. Business Schema (Multi-Tenant SaaS Management)
const BusinessSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  businessName: { type: String, required: true },
  businessCode: { type: String },
  arthiCode: { type: String, uppercase: true, trim: true },
  ownerName: { type: String, required: true },
  ownerName1: { type: String, default: '' },
  ownerNumber1: { type: String, default: '' },
  ownerName2: { type: String, default: '' },
  ownerNumber2: { type: String, default: '' },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  address: { type: String },
  city: { type: String },
  country: { type: String, default: 'Pakistan' },
  logo: { type: String, default: '' },
  tenantId: { type: String, required: true, unique: true },
  subscriptionPlan: { type: String, default: 'Trial', enum: ['Trial', 'Basic', 'Standard', 'Premium', 'Enterprise', 'Pro', 'Free', 'Starter', 'Custom'] },
  subscriptionStatus: { type: String, default: 'Active', enum: ['Active', 'Suspended', 'Expired', 'Trial', 'Inactive'] },
  subscriptionStartDate: { type: String },
  subscriptionExpiryDate: { type: String },
  maxUsers: { type: Number, default: 10 },
  features: { type: Object, default: {} },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Platform Broadcasts & Announcements Schema
const AnnouncementSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'info', enum: ['info', 'warning', 'alert', 'success'] },
  targetAudience: { type: String, default: 'All' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, default: 'Super Admin' },
  expiresAt: { type: String },
}, { timestamps: true });

// SaaS Subscription Plans & Quota Schema
const PlanSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true }, // Basic, Pro, Enterprise
  priceMonthly: { type: Number, default: 0 },
  priceAnnual: { type: Number, default: 0 },
  maxUsers: { type: Number, default: 5 },
  maxProducts: { type: Number, default: 50 },
  description: { type: String, default: '' },
  features: {
    logistics: { type: Boolean, default: true },
    multiLanguage: { type: Boolean, default: true },
    reportsExport: { type: Boolean, default: true },
    returnsModule: { type: Boolean, default: true },
    smsWhatsApp: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
  },
  isPopular: { type: Boolean, default: false },
  status: { type: String, default: 'Active' },
}, { timestamps: true });

// Global Platform Settings Schema (For Super Admin)
const GlobalSettingsSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  platformName: { type: String, default: 'MandiOS Cloud ERP' },
  maintenanceMode: { type: Boolean, default: false },
  supportEmail: { type: String, default: 'support@mandios.com' },
  supportPhone: { type: String, default: '03000000000' },
  defaultTrialDays: { type: Number, default: 30 },
  allowSelfRegistration: { type: Boolean, default: false },
}, { timestamps: true });

// 1. User Schema
const UserSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String }, // Optional for super_admin, required for tenant users
  email: { 
    type: String, 
    trim: true, 
    lowercase: true,
    index: {
      unique: true,
      sparse: true,
      partialFilterExpression: { email: { $type: 'string', $gt: '' } },
    }
  },
  khataId: { type: String, uppercase: true, trim: true },
  password: { type: String },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  role: { type: String, required: true, enum: ['super_admin', 'Admin', 'Clerk', 'Customer', 'Supplier'] },
  address: { type: String },
  status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: String },
}, { timestamps: true });

// 2. Product Schema
const ProductSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  name: { type: String, required: true },
  category: { type: String, required: true },
  unit: { type: String, required: true },
  currentQuantity: { type: Number, default: 0 },
  purchaseRate: { type: Number, default: 0 },
  saleRate: { type: Number, default: 0 },
  status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
  // Default Settings added for customization
  defaultCommission: { type: Number, default: 0 },
  commissionType: { type: String, default: 'Percentage', enum: ['Fixed Amount', 'Percentage'] },
  defaultUnit: { type: String, default: 'Crate' },
  averageWeight: { type: Number, default: 0 },
  minPrice: { type: Number, default: 0 },
  maxPrice: { type: Number, default: 0 },
}, { timestamps: true });

// 3. Supplier Schema
const SupplierSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  userId: { type: String, ref: 'User' },
  khataId: { type: String, uppercase: true, trim: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  cnic: { type: String },
  currentBalance: { type: Number, default: 0 }, // negative = we owe them
  totalSupplied: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  remainingBalance: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: String },
}, { timestamps: true });

// 4. Customer Schema
const CustomerSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  userId: { type: String, ref: 'User' },
  khataId: { type: String, uppercase: true, trim: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  referenceBy: { type: String, default: '' },
  currentBalance: { type: Number, default: 0 }, // positive = they owe us
  totalPurchases: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  remainingBalance: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: String },
}, { timestamps: true });

// 5. StockEntry Schema
const StockEntrySchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  lotNumber: { type: String },
  vehicleNumber: { type: String, default: '' },
  unit: { type: String, default: 'Crates' },
  supplierId: { type: String, ref: 'Supplier', required: true },
  supplierName: { type: String },
  productId: { type: String, ref: 'Product', required: true },
  productName: { type: String },
  quantity: { type: Number, required: true },
  remainingQuantity: { type: Number },
  wastedQuantity: { type: Number, default: 0 },
  purchaseRate: { type: Number, required: true },
  date: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  supplierCommissionType: { type: String, default: 'Percentage' },
  supplierCommissionValue: { type: Number, default: 0 },
  marketFeeRate: { type: Number, default: 0 },
  marketFeeFixedAmount: { type: Number },
  marketFeeAmount: { type: Number, default: 0 },
  lotExpenses: { type: Schema.Types.Mixed, default: {} },
  totalDeductions: { type: Number, default: 0 },
  netPayable: { type: Number, default: 0 },
  isSettled: { type: Boolean, default: false },
  settledAmount: { type: Number, default: 0 },
  settledAt: { type: Date },
  businessMode: { type: String, enum: ['Commission Business', 'Own Trading'], default: 'Commission Business' },
  ownTradingPurchaseId: { type: String, ref: 'OwnTradingPurchase' },
  purchaseReference: { type: String, default: '' },
  sourceMandi: { type: String, default: '' },
  purchaseCost: { type: Number, default: 0 },
  allocatedPurchaseExpenses: { type: Number, default: 0 },
  landedCostTotal: { type: Number, default: 0 },
}, { timestamps: true });

// 6. Boli Session Schema (container only; real sales remain in Sale model)
const BoliSessionSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  lotId: { type: String, ref: 'StockEntry', required: true },
  stockEntryId: { type: String, ref: 'StockEntry' },
  productId: { type: String, ref: 'Product' },
  productName: { type: String },
  supplierId: { type: String, ref: 'Supplier' },
  supplierName: { type: String },
  commissionType: { type: String, default: 'Percentage' },
  commissionValue: { type: Number, default: 0 },
  status: { type: String, default: 'Open', enum: ['Open', 'Closed'] },
  createdBy: { type: String },
  closedBy: { type: String },
  closedAt: { type: Date },
}, { timestamps: true });

// 7. Sale Schema
const SaleSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  customerId: { type: String, ref: 'Customer' },
  customerName: { type: String },
  productId: { type: String, ref: 'Product', required: true },
  productName: { type: String },
  stockEntryId: { type: String, ref: 'StockEntry' },
  boliSessionId: { type: String, ref: 'BoliSession' },
  quantity: { type: Number, required: true },
  saleRate: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  date: { type: String, required: true },
  isWalkIn: { type: Boolean, default: false },
  walkInName: { type: String },
  walkInMobile: { type: String },
  walkInVehicle: { type: String },
  remarks: { type: String },
  commissionAmount: { type: Number, default: 0 },
  commissionType: { type: String },
  commissionRate: { type: String },
  commissionRateValue: { type: Number },
  commissionBasis: { type: String },
  grossSale: { type: Number },
  netSale: { type: Number },
  businessMode: { type: String, enum: ['Commission Business', 'Own Trading'], default: 'Commission Business' },
  ownTradingPurchaseId: { type: String, ref: 'OwnTradingPurchase' },
  costOfGoodsSold: { type: Number, default: 0 },
}, { timestamps: true });

// 7. Ledger Schema
const LedgerSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  partyId: { type: String, required: true }, // Supplier id or Customer id
  partyType: { type: String, required: true, enum: ['Supplier', 'Customer'] },
  date: { type: String, required: true },
  type: { type: String, required: true, enum: ['Debit', 'Credit'] },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  description: { type: String },
}, { timestamps: true });

// 8. Payment Schema
const PaymentSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  partyId: { type: String, required: true },
  partyName: { type: String },
  partyType: { type: String, required: true, enum: ['Supplier', 'Customer'] },
  date: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true, enum: ['Paid', 'Received'] },
  paymentMethod: { type: String, default: 'Cash' },
  description: { type: String },
  balanceBefore: { type: Number },
  balanceAfter: { type: Number },
  idempotencyKey: { type: String },
  ownTradingPurchaseId: { type: String, ref: 'OwnTradingPurchase' },
  ownTradingAllocationType: { type: String, enum: ['Supplier Payable', 'Customer Receivable'] },
  ownTradingAllocations: {
    type: [{ stockEntryId: { type: String, ref: 'StockEntry' }, amount: { type: Number, default: 0 } }],
    default: [],
  },
}, { timestamps: true });
PaymentSchema.index({ tenantId: 1, idempotencyKey: 1 }, {
  unique: true,
  partialFilterExpression: { idempotencyKey: { $type: 'string' } },
});

const OwnTradingPurchaseSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001', required: true },
  idempotencyKey: { type: String, required: true },
  purchaseReference: { type: String, required: true },
  date: { type: String, required: true },
  sourceMandi: { type: String, default: '' },
  truckNumber: { type: String, default: '' },
  businessMode: { type: String, default: 'Own Trading', enum: ['Own Trading'] },
  status: { type: String, default: 'Processing', enum: ['Processing', 'Posted', 'Cancelled', 'Failed'] },
  items: {
    type: [{
      supplierId: { type: String, ref: 'Supplier', required: true },
      supplierName: { type: String, default: '' },
      productId: { type: String, ref: 'Product', required: true },
      productName: { type: String, default: '' },
      quantity: { type: Number, required: true, min: 0.000001 },
      unit: { type: String, required: true },
      purchaseRate: { type: Number, required: true, min: 0 },
      lineAmount: { type: Number, required: true, min: 0 },
      allocatedExpenses: { type: Number, default: 0 },
      landedCost: { type: Number, default: 0 },
      landedUnitCost: { type: Number, default: 0 },
      lotId: { type: String, ref: 'StockEntry', default: '' },
      lotNumber: { type: String, default: '' },
    }],
    default: [],
  },
  expenses: {
    transport: { type: Number, default: 0 },
    loading: { type: Number, default: 0 },
    unloading: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  purchaseValue: { type: Number, default: 0 },
  expenseTotal: { type: Number, default: 0 },
  landedCostTotal: { type: Number, default: 0 },
  supplierBalances: {
    type: [{
      supplierId: { type: String, ref: 'Supplier' },
      supplierName: { type: String, default: '' },
      purchaseAmount: { type: Number, default: 0 },
      advancePaid: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
      outstandingPayable: { type: Number, default: 0 },
    }],
    default: [],
  },
  customerBalances: {
    type: [{
      customerId: { type: String, ref: 'Customer' },
      customerName: { type: String, default: '' },
      stockEntryId: { type: String, ref: 'StockEntry' },
      salesAmount: { type: Number, default: 0 },
      recoveredAmount: { type: Number, default: 0 },
      returnCredits: { type: Number, default: 0 },
      outstandingReceivable: { type: Number, default: 0 },
    }],
    default: [],
  },
  notes: { type: String, default: '' },
  recordedBy: { type: String, default: '' },
  recordedByName: { type: String, default: '' },
  cancelledAt: { type: Date },
  cancelledBy: { type: String, default: '' },
}, { timestamps: true });
OwnTradingPurchaseSchema.index({ tenantId: 1, status: 1, date: 1 });
StockEntrySchema.index({ tenantId: 1, ownTradingPurchaseId: 1 });
SaleSchema.index({ tenantId: 1, stockEntryId: 1 });
PaymentSchema.index({ tenantId: 1, ownTradingPurchaseId: 1, partyId: 1 });
OwnTradingPurchaseSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
OwnTradingPurchaseSchema.index({ tenantId: 1, purchaseReference: 1 }, { unique: true });

const OwnTradingSaleRequestSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001', required: true },
  idempotencyKey: { type: String, required: true },
  purchaseId: { type: String, ref: 'OwnTradingPurchase', required: true },
  stockEntryId: { type: String, ref: 'StockEntry', required: true },
  saleIds: { type: [String], default: [] },
  status: { type: String, enum: ['Processing', 'Posted'], default: 'Processing' },
}, { timestamps: true });
OwnTradingSaleRequestSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });

// 9. AuditLog Schema
const AuditLogSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  userId: { type: String, required: true },
  userName: { type: String },
  userRole: { type: String },
  action: { type: String, required: true },
  details: { type: String },
  timestamp: { type: String, required: true },
});

// 10. Expense Schema
const ExpenseSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  description: { type: String },
  recordedBy: { type: String },
}, { timestamps: true });

// 11. Truck Schema
const TruckSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  truckNumber: { type: String, required: true },
  vehicleType: { type: String, default: 'Truck' },
  status: { type: String, default: 'Arrived', enum: ['Arrived', 'Waiting', 'Completed', 'Dispatched'] },
  arrivalDate: { type: String, required: true },
  dispatchDate: { type: String },
  supplierId: { type: String, ref: 'Supplier' },
  supplierName: { type: String },
  driverName: { type: String },
  driverPhone: { type: String },
  quantityLoaded: { type: Number, default: 0 },
  description: { type: String },
  notes: { type: String },
  beoparis: {
    type: [{
      supplierId: { type: String, ref: 'Supplier', default: '' },
      supplierName: { type: String, default: '' },
      products: {
        type: [{
          productId: { type: String, ref: 'Product', default: '' },
          productName: { type: String, required: true },
          quantity: { type: Number, required: true, min: 0 },
          unit: { type: String, default: '' },
          description: { type: String, default: '' },
        }],
        default: [],
      },
    }],
    default: [],
  },
}, { timestamps: true });

// 12. Employee Schema
const EmployeeSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  employeeId: { type: String, required: true },
  name: { type: String, required: true },
  fatherName: { type: String },
  cnic: { type: String },
  phone: { type: String, required: true },
  alternatePhone: { type: String },
  email: { type: String },
  address: { type: String },
  city: { type: String },
  photo: { type: String },
  notes: { type: String },
  referenceBy: { type: String, default: '' },
  designation: { type: String, required: true },
  department: { type: String },
  joiningDate: { type: String, required: true },
  salaryType: { type: String, required: true, default: 'Monthly', enum: ['Monthly', 'Weekly', 'Daily'] },
  basicSalary: { type: Number, required: true },
  openingAdvance: { type: Number, default: 0 },
  status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: String },
}, { timestamps: true });

// 13. Salary Schema
const SalarySchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  employeeId: { type: String, required: true },
  employeeName: { type: String },
  month: { type: String, required: true },
  year: { type: Number, required: true },
  basicSalary: { type: Number, required: true },
  bonus: { type: Number, default: 0 },
  allowance: { type: Number, default: 0 },
  overtime: { type: Number, default: 0 },
  advanceDeduction: { type: Number, default: 0 },
  otherDeductions: { type: Number, default: 0 },
  netSalary: { type: Number, required: true },
  paymentDate: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  paymentStatus: { type: String, required: true, enum: ['Paid', 'Partial', 'Unpaid'] },
  remarks: { type: String },
  expenseReference: { type: String },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// 14. SalaryAdvance Schema
const SalaryAdvanceSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  employeeId: { type: String, required: true },
  employeeName: { type: String },
  date: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String },
  approvedBy: { type: String },
  remarks: { type: String },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// 15. Counter Schema (Atomic Khata ID Sequences)
const CounterSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, required: true },
  role: { type: String, required: true, enum: ['Customer', 'Supplier'] },
  seq: { type: Number, default: 0 },
}, { timestamps: true });

// Compile Mongoose Models (only if mongoose is used)
const MongooseBusiness = mongoose.models.Business || mongoose.model('Business', BusinessSchema);
const MongooseGlobalSettings = mongoose.models.GlobalSettings || mongoose.model('GlobalSettings', GlobalSettingsSchema);
const MongooseUser = mongoose.models.User || mongoose.model('User', UserSchema);
const MongooseProduct = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const MongooseSupplier = mongoose.models.Supplier || mongoose.model('Supplier', SupplierSchema);
const MongooseCustomer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
const MongooseStockEntry = mongoose.models.StockEntry || mongoose.model('StockEntry', StockEntrySchema);
const MongooseBoliSession = mongoose.models.BoliSession || mongoose.model('BoliSession', BoliSessionSchema);
const MongooseSale = mongoose.models.Sale || mongoose.model('Sale', SaleSchema);
const MongooseLedger = mongoose.models.Ledger || mongoose.model('Ledger', LedgerSchema);
const MongoosePayment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
const MongooseOwnTradingPurchase = mongoose.models.OwnTradingPurchase || mongoose.model('OwnTradingPurchase', OwnTradingPurchaseSchema);
const MongooseOwnTradingSaleRequest = mongoose.models.OwnTradingSaleRequest || mongoose.model('OwnTradingSaleRequest', OwnTradingSaleRequestSchema);
const MongooseAuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
const MongooseExpense = mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
const MongooseTruck = mongoose.models.Truck || mongoose.model('Truck', TruckSchema);
const MongooseEmployee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
const MongooseSalary = mongoose.models.Salary || mongoose.model('Salary', SalarySchema);
const MongooseSalaryAdvance = mongoose.models.SalaryAdvance || mongoose.model('SalaryAdvance', SalaryAdvanceSchema);
const MongooseCounter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);
const MongooseAnnouncement = mongoose.models.Announcement || mongoose.model('Announcement', AnnouncementSchema);
const MongoosePlan = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);

// Create and export Wrapped Models
export const Business = new ModelWrapper('Business', MongooseBusiness);
export const GlobalSettings = new ModelWrapper('GlobalSettings', MongooseGlobalSettings);
export const User = new ModelWrapper('User', MongooseUser);
export const Product = new ModelWrapper('Product', MongooseProduct);
export const Supplier = new ModelWrapper('Supplier', MongooseSupplier);
export const Customer = new ModelWrapper('Customer', MongooseCustomer);
export const StockEntry = new ModelWrapper('StockEntry', MongooseStockEntry);
export const BoliSession = new ModelWrapper('BoliSession', MongooseBoliSession);
export const Sale = new ModelWrapper('Sale', MongooseSale);
export const Ledger = new ModelWrapper('Ledger', MongooseLedger);
export const Payment = new ModelWrapper('Payment', MongoosePayment);
export const OwnTradingPurchase = new ModelWrapper('OwnTradingPurchase', MongooseOwnTradingPurchase);
export const OwnTradingSaleRequest = new ModelWrapper('OwnTradingSaleRequest', MongooseOwnTradingSaleRequest);
export const AuditLog = new ModelWrapper('AuditLog', MongooseAuditLog);
export const Expense = new ModelWrapper('Expense', MongooseExpense);
export const Truck = new ModelWrapper('Truck', MongooseTruck);
export const Employee = new ModelWrapper('Employee', MongooseEmployee);
export const Salary = new ModelWrapper('Salary', MongooseSalary);
export const SalaryAdvance = new ModelWrapper('SalaryAdvance', MongooseSalaryAdvance);
export const Counter = new ModelWrapper('Counter', MongooseCounter);
export const Announcement = new ModelWrapper('Announcement', MongooseAnnouncement);
export const Plan = new ModelWrapper('Plan', MongoosePlan);
export { ReturnRecord } from './returnModel.js';
