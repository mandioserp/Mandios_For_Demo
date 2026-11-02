import { buildOwnTradingReport } from './ownTrading.js';
import { buildTenantQuery } from './tenant.js';

export function validateOwnTradingFilters(query) {
  const filters = {};
  for (const key of ['startDate', 'endDate', 'supplierId', 'productId', 'customerId', 'lotId', 'purchaseReference', 'sourceMandi', 'paymentStatus', 'saleStatus', 'dateBasis', 'detailLotId']) {
    const value = query[key];
    if (value != null && (typeof value !== 'string' || value.length > 200)) throw new Error(`Invalid ${key}.`);
    filters[key] = value || '';
  }
  for (const key of ['startDate', 'endDate']) {
    const value = filters[key];
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error(`Invalid ${key}.`);
  }
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new Error('From Date must not be after To Date.');
  for (const [key, allowed] of Object.entries({ paymentStatus: ['', 'All', 'Paid', 'Partial', 'Partially Paid', 'Unpaid'], saleStatus: ['', 'All', 'Unsold', 'Partially Sold', 'Sold'], dateBasis: ['', 'Purchase Date', 'Purchase or Activity Date'] })) {
    if (!allowed.includes(filters[key])) throw new Error(`Invalid ${key}.`);
  }
  if (filters.paymentStatus === 'Partially Paid') filters.paymentStatus = 'Partial';
  return filters;
}

export async function loadOwnTradingReport(req, models) {
  const { OwnTradingPurchase, StockEntry, Sale, ReturnRecord, Payment } = models;
  // Require a business context even for cross-tenant administrators.
  if (!req.tenantId) { const error = new Error('Select a business before viewing Own Trading reports.'); error.status = 403; throw error; }
  let filters;
  try { filters = validateOwnTradingFilters(req.query); }
  catch (error) { error.status = 400; throw error; }
  const scoped = query => buildTenantQuery(req, query);
  const date = { ...(filters.startDate ? { $gte: filters.startDate } : {}), ...(filters.endDate ? { $lte: filters.endDate } : {}) };
  const purchaseQuery = { status: 'Posted' };
  const itemMatch = Object.fromEntries(['supplierId', 'productId', 'lotId'].filter(key => filters[key]).map(key => [key, filters[key]]));
  if (filters.detailLotId) itemMatch.lotId = filters.detailLotId;
  if (Object.keys(itemMatch).length) purchaseQuery.items = { $elemMatch: itemMatch };
  for (const key of ['purchaseReference', 'sourceMandi']) {
    if (filters[key]) purchaseQuery[key] = { $regex: filters[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (Object.keys(date).length && !filters.detailLotId) {
    if (filters.dateBasis === 'Purchase or Activity Date') {
      const [sales, payments, returns] = await Promise.all([
        Sale.find(scoped({ businessMode: 'Own Trading', isDeleted: { $ne: true }, date })),
        Payment.find(scoped({ ownTradingPurchaseId: { $exists: true }, date })),
        ReturnRecord.find(scoped({ businessMode: 'Own Trading', status: 'Approved', isDeleted: { $ne: true }, date })),
      ]);
      const purchaseIds = [...new Set([...sales, ...payments, ...returns].map(row => row.ownTradingPurchaseId).filter(Boolean))];
      const lotIds = [...new Set([...sales, ...returns].map(row => row.stockEntryId).filter(Boolean))];
      purchaseQuery.$or = [{ date }, { _id: { $in: purchaseIds } }, { 'items.lotId': { $in: lotIds } }];
    } else purchaseQuery.date = date;
  }
  const purchases = await OwnTradingPurchase.find(scoped(purchaseQuery));
  const lotIds = purchases.flatMap(purchase => purchase.items.map(item => item.lotId));
  const stockEntries = lotIds.length ? await StockEntry.find(scoped({ _id: { $in: lotIds } })) : [];
  const sales = lotIds.length ? await Sale.find(scoped({ stockEntryId: { $in: lotIds }, businessMode: 'Own Trading', isDeleted: { $ne: true } })) : [];
  const returns = lotIds.length ? await ReturnRecord.find(scoped({ status: 'Approved', isDeleted: { $ne: true }, $or: [{ stockEntryId: { $in: lotIds } }, { saleId: { $in: sales.map(row => row.id || row._id) } }] })) : [];
  const result = buildOwnTradingReport({ purchases, stockEntries, sales, returns, filters: { ...filters, startDate: '', endDate: '', lotId: filters.detailLotId || filters.lotId } });
  const totals = Object.fromEntries(['purchaseAmount', 'allocatedExpenses', 'landedCost', 'salesRevenue', 'costOfGoodsSold', 'supplierPayments', 'supplierPayable', 'grossTradingProfit', 'netTradingProfit', 'wastageCost', 'customerRecoveries', 'customerReceivable'].map(key => [key, Math.round(result.rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) * 100) / 100]));
  // Quantities with different units cannot be meaningfully added together.
  if (new Set(result.rows.map(row => row.unit)).size === 1) for (const key of ['purchasedQuantity', 'soldQuantity', 'remainingQuantity', 'returnedQuantity', 'wastageQuantity']) totals[key] = result.rows.reduce((sum, row) => sum + row[key], 0);
  let detail;
  if (filters.detailLotId) {
    const row = result.rows[0];
    if (!row) { const error = new Error('Own Trading lot not found.'); error.status = 404; throw error; }
    const purchase = purchases.find(p => p.items.some(item => item.lotId === filters.detailLotId));
    const item = purchase.items.find(item => item.lotId === filters.detailLotId);
    const lotSales = sales.filter(sale => sale.stockEntryId === filters.detailLotId);
    const saleIds = new Set(lotSales.map(sale => String(sale.id || sale._id)));
    detail = { row, purchase: { purchaseReference: purchase.purchaseReference, date: purchase.date, sourceMandi: purchase.sourceMandi, notes: purchase.notes, expenses: purchase.expenses },
      sales: lotSales, returns: returns.filter(ret => ret.stockEntryId === filters.detailLotId || saleIds.has(String(ret.saleId))),
      payments: await Payment.find(scoped({ ownTradingPurchaseId: String(purchase.id || purchase._id), partyId: item.supplierId, partyType: 'Supplier', type: 'Paid' })),
    };
  }
  return { reportId: 'own-trading', ...result, totals, detail, generatedAt: new Date().toISOString() };
}
