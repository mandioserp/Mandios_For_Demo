import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOwnTradingFilters, loadOwnTradingReport } from './ownTradingReportData.js';
import { buildOwnTradingReport } from './ownTrading.js';

const purchase = { _id: 'purchase', tenantId: 't1', status: 'Posted', date: '2026-01-01',
  items: [0, 1, 2].map(i => ({ lotId: `lot${i}`, supplierId: 's', productId: `p${i}`, quantity: 10, unit: i === 2 ? 'Bag' : 'Crate', purchaseRate: 1, lineAmount: 10, allocatedExpenses: 1, landedUnitCost: 1.1, landedCost: 11 })),
  supplierBalances: [{ supplierId: 's', purchaseAmount: 30, paidAmount: 10, outstandingPayable: 20 }],
};
const sales = [{ _id: 'a', businessMode: 'Own Trading', stockEntryId: 'lot1', quantity: 2, totalAmount: 4 }, { _id: 'b', businessMode: 'Own Trading', stockEntryId: 'lot1', quantity: 3, totalAmount: 6 }, { _id: 'c', businessMode: 'Own Trading', stockEntryId: 'lot2', quantity: 10, totalAmount: 20 }];

test('unsold, partial and sold rows, multiple sales and rounded supplier allocations reconcile', () => {
  const report = buildOwnTradingReport({ purchases: [purchase], sales });
  assert.deepEqual(report.rows.map(row => row.saleStatus), ['Unsold', 'Partially Sold', 'Sold']);
  assert.equal(report.rows[0].grossTradingProfit, 0);
  assert.equal(report.rows[1].grossTradingProfit, 4.5);
  assert.equal(report.summary.outstandingSupplierPayables, 20);
  assert.equal(report.summary.totalSalesRevenue, 30);
  assert.equal(report.summary.remainingStockValue, 16.5);
  assert.deepEqual(report.rows.map(row => row.supplierPayments), [3.33, 3.34, 3.33]);
  const filtered = buildOwnTradingReport({ purchases: [purchase], sales, filters: { productId: 'p1', supplierId: 's', lotId: 'lot1', paymentStatus: 'Partial', saleStatus: 'Partially Sold' } });
  assert.equal(filtered.rows.length, 1);
  assert.equal(filtered.summary.outstandingSupplierPayables, 6.66);
});
for (const [paid, status] of [[0, 'Unpaid'], [10, 'Partial'], [30, 'Paid']]) test(`payment status ${status}`, () => {
  const p = { ...purchase, supplierBalances: [{ supplierId: 's', paidAmount: paid, outstandingPayable: 30-paid }] };
  assert.equal(buildOwnTradingReport({ purchases: [p], filters: { paymentStatus: status } }).rows.length, 3);
});
test('reject malformed filters, operator injection, invalid dates and reversed ranges', () => {
  for (const filters of [{ supplierId: { $ne: null } }, { startDate: '2026-02-30' }, { startDate: '2026-10-29', endDate: '2026-10-28' }, { saleStatus: 'Missing' }]) assert.throws(() => validateOwnTradingFilters(filters));
});
function models(record = purchase) {
  const calls = [];
  return { calls, models: Object.fromEntries(['OwnTradingPurchase', 'StockEntry', 'Sale', 'ReturnRecord', 'Payment'].map(name => [name, { find: async query => {
    calls.push({ name, query });
    assert.equal(query.tenantId, 't1');
    if (name === 'OwnTradingPurchase') return record ? [record] : [];
    if (name === 'Sale' && query.date) return [{ ...sales[0], ownTradingPurchaseId: 'purchase' }];
    if (name === 'Sale') return sales;
    return [];
  } }])) };
}
test('activity range selects older purchases and uses lifetime sales, with all queries tenant scoped', async () => {
  const db = models();
  const result = await loadOwnTradingReport({ tenantId: 't1', query: { startDate: '2026-10-29', endDate: '2026-10-29', dateBasis: 'Purchase or Activity Date' } }, db.models);
  assert.equal(result.rows.length, 3);
  const query = db.calls.find(call => call.name === 'OwnTradingPurchase').query;
  assert.deepEqual(query.$or[1], { _id: { $in: ['purchase'] } });
  assert.equal(db.calls.filter(call => call.name === 'Sale').at(-1).query.date, undefined);
  assert.equal(result.totals.purchasedQuantity, undefined);
  assert.equal(result.totals.wastageCost, 0);
  assert.equal(result.totals.customerRecoveries, 0);
  assert.equal(result.totals.customerReceivable, 0);
});
test('purchase filter uses database date and same-item matching', async () => {
  const db = models(null);
  await loadOwnTradingReport({ tenantId: 't1', query: { startDate: '2026-10-29', productId: 'p', supplierId: 's' } }, db.models);
  assert.deepEqual(db.calls[0].query.date, { $gte: '2026-10-29' });
  assert.deepEqual(db.calls[0].query.items, { $elemMatch: { supplierId: 's', productId: 'p' } });
  assert.equal(db.calls.length, 1);
});
test('foreign lot details return 404 and missing tenant fails closed', async () => {
  const db = models(null);
  await assert.rejects(loadOwnTradingReport({ tenantId: 't1', query: { detailLotId: 'foreign' } }, db.models), error => error.status === 404);
  assert.equal(db.calls[0].query.items.$elemMatch.lotId, 'foreign');
  await assert.rejects(loadOwnTradingReport({ query: {} }, db.models), error => error.status === 403);
});
