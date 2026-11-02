import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOwnTradingOutput, OWN_TRADING_OUTPUT_SECTIONS } from './ownTradingReportOutput.js';
import { REPORTS_CONFIG } from '../config/reportsConfig.js';
const columns = REPORTS_CONFIG['own-trading'].columns;
test('landscape sections retain every report column without duplicating financial totals', () => {
  const keys = OWN_TRADING_OUTPUT_SECTIONS.flatMap(section => section.keys);
  for (const column of columns) {
    assert.ok(keys.includes(column.key), column.key);
    if (column.format?.startsWith('currency')) assert.equal(keys.filter(key => key === column.key).length, 1, column.key);
  }
});
test('output uses applied filters, resolved names and server totals with money precision', () => {
  const report = { generatedAt: '2026-10-29T12:00:00Z', appliedFilters: { supplierId: 's', productId: 'p', lotId: 'l', paymentStatus: 'Partial', startDate: '2026-10-01' },
    rows: [{ lotId: 'OT-1', purchasedQuantity: 1.125, purchaseAmount: 100.25, grossTradingProfit: -20.5, paymentStatus: 'Partial' }],
    summary: { totalPurchaseValue: 100.25 }, totals: { purchaseAmount: 100.25, grossTradingProfit: -20.5 } };
  const result = buildOwnTradingOutput({ report, columns, suppliers: [{ _id: 's', name: 'Supplier Name' }], products: [{ id: 'p', name: 'Apple' }], lots: [{ id: 'l', lotNumber: 'OT-1' }] });
  assert.ok(result.filters.some(filter => filter.value === 'Supplier Name'));
  assert.ok(result.filters.some(filter => filter.value === 'Apple'));
  assert.ok(result.filters.some(filter => filter.value === 'OT-1'));
  assert.equal(result.period, 'Purchase Date: 2026-10-01 to present');
  assert.equal(result.summary[0].value, 'Rs. 100.25');
  const purchases = result.sections[0];
  assert.equal(purchases.totals[purchases.columns.findIndex(c => c.key === 'purchaseAmount')], '100.25');
  assert.equal(purchases.totals[purchases.columns.findIndex(c => c.key === 'purchasedQuantity')], '—');
  const profit = result.sections[1];
  assert.equal(profit.rows[0][profit.columns.findIndex(c => c.key === 'grossTradingProfit')], '-20.50');
  assert.equal(result.generatedAt, report.generatedAt);
});
test('empty report and all-date range export without fabricated quantities', () => {
  const result = buildOwnTradingOutput({ report: { rows: [], summary: {}, totals: {} }, columns });
  assert.equal(result.period, 'Purchase Date: All dates to present');
  assert.ok(result.sections.every(section => section.rows.length === 0));
});
