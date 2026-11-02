import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOwnTradingPurchase } from './ownTrading.js';
import { prepareOwnTradingEdit } from './ownTradingEdit.js';
import { purchaseToForm } from '../../frontend/src/utils/ownTradingForm.js';

function fixture() {
  const purchase = { ...normalizeOwnTradingPurchase({ date: '2026-10-29', idempotencyKey: 'edit-test', purchaseReference: 'OT-1', expenses: { transport: 30 }, beoparis: [
    { supplierId: 's1', advancePaid: 20, products: [{ productId: 'p1', quantity: 10, purchaseRate: 10, unit: 'Bag' }, { productId: 'p2', quantity: 5, purchaseRate: 20, unit: 'Crate' }] },
    { supplierId: 's2', advancePaid: 0, products: [{ productId: 'p1', quantity: 10, purchaseRate: 10, unit: 'Bag' }] },
  ] }), status: 'Posted', updatedAt: '2026-10-29T10:00:00.000Z' };
  purchase.items = purchase.items.map((item, i) => ({ ...item, lotId: `lot-${i}`, lotNumber: `OT-1-${i}` }));
  const context = { lots: purchase.items.map(item => ({ quantity: item.quantity, remainingQuantity: item.quantity })), sales: [], returns: [] };
  return { purchase, form: purchaseToForm(purchase), context };
}

test('edit form preserves all suppliers, product lots, original rates, advances and expenses', () => {
  const { purchase, form, context } = fixture();
  assert.equal(form.beoparis.length, 2);
  assert.equal(form.beoparis[0].products.length, 2);
  assert.equal(form.beoparis[0].products[0].purchaseRate, 10);
  assert.deepEqual(prepareOwnTradingEdit(purchase, form, context).items, purchase.items);
});
test('quantity/rate edits recalculate cost, allocated expenses and outstanding amounts, preserving payments', () => {
  const { purchase, form, context } = fixture();
  form.beoparis[0].products[0].quantity = 20;
  const result = prepareOwnTradingEdit(purchase, form, context);
  assert.equal(result.purchaseValue, 400);
  assert.equal(result.landedCostTotal, 430);
  assert.equal(result.supplierBalances[0].paidAmount, 20);
  assert.equal(result.supplierBalances[0].outstandingPayable, 280);
  assert.deepEqual(result.items.map(x => x.lotId), purchase.items.map(x => x.lotId));
});
for (const activity of ['sales', 'returns', 'stock']) {
  test(`cost changes blocked after ${activity}, metadata still editable`, () => {
    const { purchase, form, context } = fixture();
    if (activity === 'stock') context.lots[0].remainingQuantity = 9;
    else context[activity].push({});
    form.notes = 'Corrected note';
    assert.equal(prepareOwnTradingEdit(purchase, form, context).notes, 'Corrected note');
    form.beoparis[0].products[0].quantity = 11;
    assert.throws(() => prepareOwnTradingEdit(purchase, form, context), /cannot change after/);
  });
}
for (const [name, mutate, pattern] of [
  ['stale edit', f => { f.updatedAt = '2026-10-28'; }, /changed/],
  ['payment edit', f => { f.beoparis[0].advancePaid = 10; }, /Payments/],
  ['foreign lot', f => { f.beoparis[0].products[0].lotId = 'foreign'; }, /cannot be changed/],
  ['duplicate lot', f => { f.beoparis[0].products[1].lotId = 'lot-0'; }, /existing purchase lots/],
  ['changed product', f => { f.beoparis[0].products[0].productId = 'other'; }, /cannot be changed/],
  ['date change', f => { f.date = '2026-10-28'; }, /date and reference/],
]) test(name, () => { const { purchase, form, context } = fixture(); mutate(form); assert.throws(() => prepareOwnTradingEdit(purchase, form, context), pattern); });

test('cannot reduce purchase below payments already recorded', () => {
  const { purchase, form, context } = fixture();
  purchase.supplierBalances[0].paidAmount = 190;
  form.beoparis[0].products[0].quantity = 1;
  assert.throws(() => prepareOwnTradingEdit(purchase, form, context), /less than supplier payments/);
});
