import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOwnTradingReport, calculateOwnTradingLotMetrics, normalizeOwnTradingPurchase } from './ownTrading.js';

test('normalizes multi-supplier, multi-product purchase and allocates expenses by item value', () => {
  const purchase = normalizeOwnTradingPurchase({
    idempotencyKey: 'request-1', date: '2026-10-28',
    expenses: { transport: 30, loading: 10 },
    beoparis: [
      { supplierId: 's1', advancePaid: 20, products: [{ productId: 'p1', quantity: 10, unit: 'Crate', purchaseRate: 100 }] },
      { supplierId: 's2', products: [{ productId: 'p1', quantity: 5, unit: 'Crate', purchaseRate: 100 }, { productId: 'p2', quantity: 2, unit: 'Bag', purchaseRate: 250 }] },
    ],
  });
  assert.equal(purchase.purchaseValue, 2000);
  assert.equal(purchase.landedCostTotal, 2040);
  assert.equal(purchase.items.reduce((sum, item) => sum + item.allocatedExpenses, 0), 40);
  assert.equal(purchase.supplierBalances.find(balance => balance.supplierId === 's1').outstandingPayable, 980);
  assert.equal(purchase.items[0].landedUnitCost, 102);
});

test('rejects invalid purchase items and advances beyond that supplier amount', () => {
  assert.throws(() => normalizeOwnTradingPurchase({ date: '2026-10-28', beoparis: [] }), /idempotency key/);
  assert.throws(() => normalizeOwnTradingPurchase({ idempotencyKey: 'x', date: '2026-10-28', beoparis: [{ supplierId: 's', advancePaid: 11, products: [{ productId: 'p', quantity: 1, unit: 'Bag', purchaseRate: 10 }] }] }), /cannot exceed/);
  assert.throws(() => normalizeOwnTradingPurchase({ idempotencyKey: 'x', date: '2026-10-28', beoparis: [{ supplierId: 's', products: [{ productId: 'p', quantity: 1, unit: 'Bag', purchaseRate: 0 }] }] }), /greater than zero/);
});

test('calculates profit on sold stock and leaves unsold stock in inventory value', () => {
  const item = { lotId: 'lot-1', lotNumber: 'OT-1', supplierId: 's1', supplierName: 'Supplier', productId: 'p1', productName: 'Apple', quantity: 10, lineAmount: 1000, allocatedExpenses: 100, landedCost: 1100, landedUnitCost: 110 };
  const metrics = calculateOwnTradingLotMetrics({
    item,
    stockEntry: { remainingQuantity: 6 },
    sales: [
      { _id: 'sale-1', stockEntryId: 'lot-1', businessMode: 'Own Trading', quantity: 2, totalAmount: 400 },
      { _id: 'sale-2', stockEntryId: 'lot-1', businessMode: 'Own Trading', quantity: 2, totalAmount: 500 },
    ],
    returns: [{ saleId: 'sale-2', stockEntryId: 'lot-1', status: 'Approved', produceCondition: 'Good', produceReturnedQty: 1, returnAmount: 125 }],
  });
  assert.equal(metrics.salesRevenue, 775);
  assert.equal(metrics.soldQuantity, 3);
  assert.equal(metrics.costOfGoodsSold, 330);
  assert.equal(metrics.remainingStockValue, 660);
  assert.equal(metrics.netTradingProfit, 445);
});

test('Own Trading report filters only posted own purchases and reconciles summary values', () => {
  const purchase = {
    status: 'Posted', date: '2026-10-28', purchaseReference: 'OT-28', sourceMandi: 'Lahore',
    supplierBalances: [{ supplierId: 's1', purchaseAmount: 1000, paidAmount: 200, outstandingPayable: 800 }],
    customerBalances: [{ stockEntryId: 'lot-1', customerId: 'c1', customerName: 'Buyer', recoveredAmount: 50, outstandingReceivable: 150 }],
    items: [{ lotId: 'lot-1', lotNumber: 'OT-28-1', supplierId: 's1', supplierName: 'Supplier', productId: 'p1', productName: 'Apple', quantity: 10, unit: 'Bag', purchaseRate: 100, lineAmount: 1000, allocatedExpenses: 100, landedCost: 1100, landedUnitCost: 110 }],
  };
  const result = buildOwnTradingReport({
    purchases: [purchase, { ...purchase, status: 'Cancelled', purchaseReference: 'OT-OLD' }],
    stockEntries: [{ _id: 'lot-1', remainingQuantity: 6 }],
    sales: [{ _id: 'sale-1', stockEntryId: 'lot-1', businessMode: 'Own Trading', customerId: 'c1', quantity: 4, totalAmount: 900 }],
    filters: { startDate: '2026-10-28', endDate: '2026-10-28', paymentStatus: 'Partial' },
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.summary.totalPurchaseValue, 1000);
  assert.equal(result.summary.totalSalesRevenue, 900);
  assert.equal(result.summary.outstandingSupplierPayables, 800);
  assert.equal(result.summary.remainingStockValue, 660);
});

test('customer filter excludes another customer’s returns on the same lot', () => {
  const purchase = {
    status: 'Posted', date: '2026-10-28', purchaseReference: 'OT-29',
    supplierBalances: [{ supplierId: 's1', purchaseAmount: 1000, paidAmount: 0, outstandingPayable: 1000 }],
    items: [{ lotId: 'lot-1', lotNumber: 'OT-29-1', supplierId: 's1', supplierName: 'Supplier', productId: 'p1', productName: 'Apple', quantity: 10, unit: 'Bag', purchaseRate: 100, lineAmount: 1000, allocatedExpenses: 0, landedCost: 1000, landedUnitCost: 100 }],
  };
  const result = buildOwnTradingReport({
    purchases: [purchase], stockEntries: [{ _id: 'lot-1', remainingQuantity: 8 }],
    sales: [
      { _id: 'sale-c1', stockEntryId: 'lot-1', businessMode: 'Own Trading', customerId: 'c1', quantity: 2, totalAmount: 300 },
      { _id: 'sale-c2', stockEntryId: 'lot-1', businessMode: 'Own Trading', customerId: 'c2', quantity: 2, totalAmount: 350 },
    ],
    returns: [{ saleId: 'sale-c2', stockEntryId: 'lot-1', customerId: 'c2', status: 'Approved', produceReturnedQty: 1, returnAmount: 175 }],
    filters: { customerId: 'c1' },
  });
  assert.equal(result.rows[0].salesRevenue, 300);
  assert.equal(result.rows[0].soldQuantity, 2);
});
