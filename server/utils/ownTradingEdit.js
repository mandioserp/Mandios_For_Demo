import { normalizeOwnTradingPurchase } from './ownTrading.js';

const reject = message => { const error = new Error(message); error.status = 409; throw error; };

export function prepareOwnTradingEdit(purchase, input, { lots, sales, returns }) {
  if (purchase.status !== 'Posted') reject('Only posted purchases can be edited.');
  if (!input.updatedAt || new Date(input.updatedAt).getTime() !== new Date(purchase.updatedAt).getTime()) reject('This purchase changed. Close the form and reopen it before saving.');
  if (input.date !== purchase.date || input.purchaseReference !== purchase.purchaseReference) reject('The original purchase date and reference cannot be changed.');
  let normalized;
  try { normalized = normalizeOwnTradingPurchase({ ...input, idempotencyKey: purchase.idempotencyKey }); }
  catch (error) { error.status = 400; throw error; }
  const submitted = (input.beoparis || []).flatMap(group => group.products || []);
  const originals = new Map(purchase.items.map(item => [String(item.lotId), item]));
  if (submitted.length !== originals.size || new Set(submitted.map(item => String(item.lotId))).size !== originals.size) reject('Keep the existing purchase lots when editing.');
  const items = normalized.items.map((item, index) => {
    const old = originals.get(String(submitted[index].lotId));
    if (!old || old.supplierId !== item.supplierId || old.productId !== item.productId || old.unit !== item.unit) reject('Supplier, product and unit cannot be changed on an existing lot.');
    return { ...item, lotId: old.lotId, lotNumber: old.lotNumber, supplierName: old.supplierName, productName: old.productName };
  });
  // Preserve original item order: rounding of expense allocations must be stable.
  if (items.some((item, index) => item.lotId !== purchase.items[index].lotId)) reject('Keep the original purchase item order.');
  const costChanged = items.some(item => {
    const old = originals.get(String(item.lotId));
    return ['quantity', 'purchaseRate', 'allocatedExpenses', 'landedCost'].some(key => Number(old[key]) !== Number(item[key]));
  });
  if (lots.length !== items.length) reject('A linked stock lot is missing. Resolve the purchase before editing.');
  if (costChanged && (sales.length || returns.length || lots.some(lot => Number(lot.remainingQuantity) !== Number(lot.quantity)))) reject('Purchase quantities, rates and expenses cannot change after sales, returns or stock adjustments. Reverse those transactions first.');
  const supplierBalances = normalized.supplierBalances.map(balance => {
    const old = purchase.supplierBalances.find(row => row.supplierId === balance.supplierId);
    if (!old || Number(old.advancePaid) !== balance.advancePaid) reject('Record or reverse supplier payments through Payments; advances cannot be edited here.');
    const paidAmount = Number(old.paidAmount ?? old.advancePaid) || 0;
    if (balance.purchaseAmount < paidAmount) reject('Purchase amount cannot be less than supplier payments already recorded.');
    return { ...old, purchaseAmount: balance.purchaseAmount, paidAmount, outstandingPayable: Math.round((balance.purchaseAmount - paidAmount) * 100) / 100 };
  });
  return { ...normalized, items, supplierBalances };
}
