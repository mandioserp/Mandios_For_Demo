import mongoose from 'mongoose';
import { ModelWrapper } from '../config/db.js';

const Schema = mongoose.Schema;

// 1. Business Settings Schema
const BusinessSettingsSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  businessName: { type: String, required: true, default: 'Mandi Brokerage' },
  ownerName: { type: String, required: true, default: 'Admin Owner' },
  ownerName1: { type: String, default: '' },
  ownerNumber1: { type: String, default: '' },
  ownerName2: { type: String, default: '' },
  ownerNumber2: { type: String, default: '' },
  logo: { type: String, default: '' },
  mobileNumber: { type: String, default: '' },
  whatsAppNumber: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  country: { type: String, default: '' },
  currency: { type: String, default: 'PKR' },
  currencySymbol: { type: String, default: 'Rs.' },
  timeZone: { type: String, default: 'UTC+5' },
  dateFormat: { type: String, default: 'YYYY-MM-DD' }
}, { timestamps: true });

// 2. Commission Rule Schema
const CommissionRuleSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  name: { type: String, required: true },
  commissionType: { type: String, required: true, enum: ['Fixed Amount', 'Percentage'] },
  value: { type: Number, required: true },
  chargeBasis: { type: String, required: true, enum: ['Per Crate', 'Per Box', 'Per Basket', 'Per Kilogram', 'Per Maund', 'Per Invoice', 'Sale Amount'] },
  appliesTo: { type: String, required: true, enum: ['Supplier', 'Customer', 'Both'] },
  scope: { type: String, required: true, enum: ['Global Default', 'Product Specific', 'Supplier Specific', 'Customer Specific'] },
  productId: { type: String, default: '' },
  productName: { type: String, default: '' },
  supplierId: { type: String, default: '' },
  supplierName: { type: String, default: '' },
  customerId: { type: String, default: '' },
  customerName: { type: String, default: '' },
  status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] }
}, { timestamps: true });

// 3. Unit Schema
const UnitSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  name: { type: String, required: true },
  symbol: { type: String, default: '' },
  description: { type: String, default: '' },
  status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] }
}, { timestamps: true });
UnitSchema.index({ tenantId: 1, name: 1 });

// 4. Charge Schema
const ChargeSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['Fixed Amount', 'Percentage'] },
  value: { type: Number, required: true },
  chargeBasis: { type: String, required: true, enum: ['Per Crate', 'Per Kg', 'Per Invoice'] },
  isOptional: { type: Boolean, default: false }, // false = Mandatory, true = Optional
  status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
  appliesTo: { type: String, required: true, enum: ['Supplier', 'Customer', 'Both'] }
}, { timestamps: true });
ChargeSchema.index({ tenantId: 1, name: 1 });

// 5. Expense Category Schema
const ExpenseCategorySchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] }
}, { timestamps: true });
ExpenseCategorySchema.index({ tenantId: 1, name: 1 });

// 6. Payment Method Schema
const PaymentMethodSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  detailsRequired: { type: Boolean, default: false },
  status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] } // Enable/Disable
}, { timestamps: true });
PaymentMethodSchema.index({ tenantId: 1, name: 1 });

// 7. Invoice Settings Schema
const InvoiceSettingsSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  companyLogo: { type: String, default: '' },
  header: { type: String, default: 'COMMISSION AGENT & WHOLESALE BROKER' },
  footer: { type: String, default: 'Thank you for your business!' },
  invoicePrefix: { type: String, default: 'INV' },
  invoiceStartingNumber: { type: Number, default: 1001 },
  paperSize: { type: String, default: 'A4', enum: ['A4', 'A5', 'Thermal 3-inch', 'Letter'] },
  autoPrint: { type: Boolean, default: false },
  printPreview: { type: Boolean, default: true },
  signature: { type: String, default: 'Authorized Signatory' },
  termsAndConditions: { type: String, default: '' },
  showCommissionDeduction: { type: Boolean, default: true },
  showAuxiliaryCharges: { type: Boolean, default: true },
  defaultDueDateDays: { type: Number, default: 15 }
}, { timestamps: true });

// 8. Application Settings Schema
const ApplicationSettingsSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  theme: { type: String, default: 'dark', enum: ['dark', 'light'] },
  language: { type: String, default: 'en', enum: ['en', 'ur'] },
  enableNotifications: { type: Boolean, default: true },
  backupFrequency: { type: String, default: 'Manual', enum: ['Daily', 'Weekly', 'Monthly', 'Manual'] }
}, { timestamps: true });

// 9. Notification Settings Schema
const NotificationSettingsSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  emailNotifications: { type: Boolean, default: false },
  smsNotifications: { type: Boolean, default: false },
  whatsAppNotifications: { type: Boolean, default: false },
  alertLowStock: { type: Boolean, default: true },
  alertHighReceivable: { type: Boolean, default: true }
}, { timestamps: true });

// 10. Ledger Settings Schema
const LedgerSettingsSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  autoPostSale: { type: Boolean, default: true },
  autoPostPayment: { type: Boolean, default: true },
  defaultNarrationFormat: { type: String, default: 'Sale/Purchase transaction' }
}, { timestamps: true });

// 11. Tax Settings Schema
const TaxSettingSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  taxName: { type: String, default: 'Sales Tax' },
  taxRate: { type: Number, default: 0 },
  isTaxEnabled: { type: Boolean, default: false }
}, { timestamps: true });


// Compile Mongoose Models
const MongooseBusinessSettings = mongoose.models.BusinessSettings || mongoose.model('BusinessSettings', BusinessSettingsSchema);
const MongooseCommissionRule = mongoose.models.CommissionRule || mongoose.model('CommissionRule', CommissionRuleSchema);
const MongooseUnit = mongoose.models.Unit || mongoose.model('Unit', UnitSchema);
const MongooseCharge = mongoose.models.Charge || mongoose.model('Charge', ChargeSchema);
const MongooseExpenseCategory = mongoose.models.ExpenseCategory || mongoose.model('ExpenseCategory', ExpenseCategorySchema);
const MongoosePaymentMethod = mongoose.models.PaymentMethod || mongoose.model('PaymentMethod', PaymentMethodSchema);
const MongooseInvoiceSettings = mongoose.models.InvoiceSettings || mongoose.model('InvoiceSettings', InvoiceSettingsSchema);
const MongooseApplicationSettings = mongoose.models.ApplicationSettings || mongoose.model('ApplicationSettings', ApplicationSettingsSchema);
const MongooseNotificationSettings = mongoose.models.NotificationSettings || mongoose.model('NotificationSettings', NotificationSettingsSchema);
const MongooseLedgerSettings = mongoose.models.LedgerSettings || mongoose.model('LedgerSettings', LedgerSettingsSchema);
const MongooseTaxSetting = mongoose.models.TaxSetting || mongoose.model('TaxSetting', TaxSettingSchema);

// Wrapped Model Exports
export const BusinessSettings = new ModelWrapper('BusinessSettings', MongooseBusinessSettings);
export const CommissionRule = new ModelWrapper('CommissionRule', MongooseCommissionRule);
export const Unit = new ModelWrapper('Unit', MongooseUnit);
export const Charge = new ModelWrapper('Charge', MongooseCharge);
export const ExpenseCategory = new ModelWrapper('ExpenseCategory', MongooseExpenseCategory);
export const PaymentMethod = new ModelWrapper('PaymentMethod', MongoosePaymentMethod);
export const InvoiceSettings = new ModelWrapper('InvoiceSettings', MongooseInvoiceSettings);
export const ApplicationSettings = new ModelWrapper('ApplicationSettings', MongooseApplicationSettings);
export const NotificationSettings = new ModelWrapper('NotificationSettings', MongooseNotificationSettings);
export const LedgerSettings = new ModelWrapper('LedgerSettings', MongooseLedgerSettings);
export const TaxSetting = new ModelWrapper('TaxSetting', MongooseTaxSetting);
