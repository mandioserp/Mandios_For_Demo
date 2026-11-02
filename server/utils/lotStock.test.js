import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLotRemaining } from './lotStock.js';

test('sold lots deplete and deleting a sale restores availability', () => {
  assert.equal(calculateLotRemaining(10, [{ quantity: 4 }, { quantity: 6 }]), 0);
  assert.equal(calculateLotRemaining(10, [{ quantity: 4 }]), 6);
});
test('own trading restocks good returns and excludes damaged and spoiled returns', () => {
  const returns = ['Good', 'Damaged', 'Spoiled'].map(produceCondition => ({ produceCondition, produceReturnedQty: 1 }));
  assert.equal(calculateLotRemaining(10, [{ quantity: 10 }], returns, true), 1);
  assert.equal(calculateLotRemaining(10, [{ quantity: 10 }], returns, false), 3);
});
test('fractional quantities do not leave phantom remaining stock', () => {
  assert.equal(calculateLotRemaining(0.3, [{ quantity: 0.1 }, { quantity: 0.2 }]), 0);
});
