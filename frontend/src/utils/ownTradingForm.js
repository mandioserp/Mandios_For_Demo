export function purchaseToForm(purchase) {
  const groups = new Map();
  for (const item of purchase.items || []) {
    if (!groups.has(item.supplierId)) {
      const balance = (purchase.supplierBalances || []).find(row => row.supplierId === item.supplierId);
      groups.set(item.supplierId, { supplierId: item.supplierId, advancePaid: balance?.advancePaid || 0, products: [] });
    }
    groups.get(item.supplierId).products.push({ lotId: item.lotId, productId: item.productId, quantity: item.quantity, unit: item.unit, purchaseRate: item.purchaseRate });
  }
  return {
    idempotencyKey: purchase.idempotencyKey, updatedAt: purchase.updatedAt,
    purchaseReference: purchase.purchaseReference, date: purchase.date,
    sourceMandi: purchase.sourceMandi || '', truckNumber: purchase.truckNumber || '', notes: purchase.notes || '',
    expenses: { transport: 0, loading: 0, unloading: 0, other: 0, ...purchase.expenses },
    beoparis: [...groups.values()],
  };
}
