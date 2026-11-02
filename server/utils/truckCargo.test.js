import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTruckToSupplier, getTruckBeoparis, normalizeTruckBeoparis, normalizeTruckForResponse, truckHasSupplier } from './truckCargo.js';

test('normalizes multiple suppliers and product rows while keeping product associations', () => {
  const beoparis = normalizeTruckBeoparis([
    { supplierId: 'supplier-a', products: [{ productName: 'Apple', quantity: '12', unit: 'Crates' }, { productName: 'Pear', quantity: 5, unit: 'Bag' }] },
    { supplierId: 'supplier-b', products: [{ productId: 'product-1', productName: 'Apple', quantity: 3, unit: 'Peti' }] },
  ]);
  assert.equal(beoparis.length, 2);
  assert.deepEqual(beoparis[0].products.map(({ productName, quantity }) => [productName, quantity]), [['Apple', 12], ['Pear', 5]]);
  assert.equal(beoparis[1].products[0].productId, 'product-1');
});

test('rejects missing suppliers, duplicate supplier sections, empty product rows, and invalid quantities', () => {
  assert.throws(() => normalizeTruckBeoparis([]), /at least one beopari/);
  assert.throws(() => normalizeTruckBeoparis([{ supplierId: '', products: [{ productName: 'Apple', quantity: 1, unit: 'Crates' }] }]), /Select a beopari/);
  assert.throws(() => normalizeTruckBeoparis([
    { supplierId: 'supplier-a', products: [{ productName: 'Apple', quantity: 1, unit: 'Crates' }] },
    { supplierId: 'supplier-a', products: [{ productName: 'Pear', quantity: 2, unit: 'Crates' }] },
  ]), /should appear once/);
  assert.throws(() => normalizeTruckBeoparis([{ supplierId: 'supplier-a', products: [] }]), /at least one product/);
  assert.throws(() => normalizeTruckBeoparis([{ supplierId: 'supplier-a', products: [{ productName: 'Apple', quantity: '', unit: 'Crates' }] }]), /valid quantity/);
  assert.throws(() => normalizeTruckBeoparis([{ supplierId: 'supplier-a', products: [{ productName: 'Apple', quantity: -1, unit: 'Crates' }] }]), /valid quantity/);
  assert.equal(normalizeTruckBeoparis([{ supplierId: 'supplier-a', products: [{ productName: 'Apple', quantity: 0, unit: 'Crates' }] }])[0].products[0].quantity, 0);
});

test('normalizes legacy single-supplier truck records for display without changing their stored shape', () => {
  const legacy = { supplierId: 'supplier-old', supplierName: 'Old Supplier', quantityLoaded: 20, description: 'Apples' };
  const normalized = normalizeTruckForResponse(legacy);
  assert.equal(normalized.beoparis[0].supplierName, 'Old Supplier');
  assert.deepEqual(normalized.beoparis[0].products[0], {
    productId: '', productName: 'Apples', quantity: 20, unit: 'Crates', description: '',
  });
  assert.equal(legacy.beoparis, undefined);
  assert.equal(truckHasSupplier(legacy, 'supplier-old'), true);
  assert.equal(getTruckBeoparis({ truckNumber: 'TR-10' }).length, 0);
});

test('supplier-filtered views keep only that supplier group on a shared truck', () => {
  const truck = { truckNumber: 'T-1', beoparis: [
    { supplierId: 'supplier-a', supplierName: 'Ahmed', products: [{ productName: 'Apple', quantity: 5, unit: 'Bag' }] },
    { supplierId: 'supplier-b', supplierName: 'Bilal', products: [{ productName: 'Pear', quantity: 2, unit: 'Crate' }] },
  ] };
  const filtered = filterTruckToSupplier(truck, 'supplier-b');
  assert.equal(filtered.beoparis.length, 1);
  assert.equal(filtered.supplierName, 'Bilal');
  assert.equal(filtered.beoparis[0].products[0].productName, 'Pear');
  assert.equal(truck.beoparis.length, 2);
});
