import { Schema } from 'mongoose';
import mongoose from 'mongoose';
import { ModelWrapper } from '../config/db.js';

// Return Record Schema
const ReturnRecordSchema = new Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  tenantId: { type: String, default: 'tenant_default_001' },
  returnNumber: { type: String, required: true }, // e.g. RET-1001
  returnType: { type: String, enum: ['Produce', 'Crate', 'Both'], required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['Draft', 'Waiting Approval', 'Approved', 'Rejected'], default: 'Waiting Approval' },
  
  // Customer Details
  customerId: { type: String, ref: 'Customer', required: true },
  customerName: { type: String, required: true },

  // Original Sale Details (if produce return)
  saleId: { type: String, ref: 'Sale' },
  stockEntryId: { type: String, ref: 'StockEntry' },
  businessMode: { type: String, enum: ['Commission Business', 'Own Trading'], default: 'Commission Business' },
  ownTradingPurchaseId: { type: String, ref: 'OwnTradingPurchase' },
  wastageCost: { type: Number, default: 0 },
  productId: { type: String, ref: 'Product' },
  productName: { type: String },
  unit: { type: String, default: 'Crate' },
  saleRate: { type: Number, default: 0 },
  quantitySold: { type: Number, default: 0 },
  quantityAlreadyReturned: { type: Number, default: 0 },

  // Produce Return Items
  produceReturnedQty: { type: Number, default: 0 },
  produceCondition: { type: String, enum: ['Good', 'Damaged', 'Spoiled'], default: 'Good' },
  grossReturnAmount: { type: Number, default: 0 }, // produceReturnedQty * saleRate
  commissionReversedAmount: { type: Number, default: 0 }, // commission deducted/reversed for returned units
  commissionRate: { type: String, default: '' },
  returnAmount: { type: Number, default: 0 }, // net credited: grossReturnAmount + commissionReversedAmount (or gross based on billing model)
  
  // Crate Return Items
  cratesGiven: { type: Number, default: 0 },
  cratesAlreadyReturned: { type: Number, default: 0 },
  goodCratesReturned: { type: Number, default: 0 },
  damagedCratesReturned: { type: Number, default: 0 },
  totalCratesReturned: { type: Number, default: 0 }, // good + damaged
  
  // Reason & Notes
  reason: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  notes: { type: String, default: '' },

  // Users and approvals
  recordedBy: { type: String, default: '' },
  recordedByName: { type: String, default: '' },
  approvedBy: { type: String, default: '' },
  approvedByName: { type: String, default: '' },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },

  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

ReturnRecordSchema.index({ tenantId: 1, stockEntryId: 1, status: 1 });
ReturnRecordSchema.index({ tenantId: 1, saleId: 1, status: 1 });

// Compile Mongoose Model
const MongooseReturnRecord = mongoose.models.ReturnRecord || mongoose.model('ReturnRecord', ReturnRecordSchema);

// Export wrapped model
export const ReturnRecord = new ModelWrapper('ReturnRecord', MongooseReturnRecord);
export default ReturnRecord;
