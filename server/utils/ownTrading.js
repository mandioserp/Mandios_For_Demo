const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function normalizeOwnTradingPurchase(input = {}) {
  const date = String(input.date || '').slice(0, 10);
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!date) throw new Error('Purchase date is required.');
  if (!idempotencyKey) throw new Error('An idempotency key is required for this purchase.');
  if (!Array.isArray(input.beoparis) || input.beoparis.length === 0) throw new Error('Add at least one supplier with products.');

  const supplierIds = new Set();
  const items = [];
  const supplierAmounts = new Map();
  for (const [supplierIndex, group] of input.beoparis.entries()) {
    const supplierId = String(group?.supplierId || '').trim();
    if (!supplierId) throw new Error(`Select a supplier for section ${supplierIndex + 1}.`);
    if (supplierIds.has(supplierId)) throw new Error('Each supplier should appear once; add products to that supplier section.');
    supplierIds.add(supplierId);
    if (!Array.isArray(group.products) || group.products.length === 0) throw new Error(`Add at least one product for supplier section ${supplierIndex + 1}.`);

    let supplierAmount = 0;
    for (const [productIndex, product] of group.products.entries()) {
      const productId = String(product?.productId || '').trim();
      const quantity = Number(product?.quantity);
      const purchaseRate = Number(product?.purchaseRate);
      const unit = String(product?.unit || '').trim();
      if (!productId) throw new Error(`Select a product in supplier section ${supplierIndex + 1}, row ${productIndex + 1}.`);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Purchase quantity must be greater than zero.');
      if (!Number.isFinite(purchaseRate) || purchaseRate <= 0) throw new Error('Purchase rate must be greater than zero.');
      if (!unit) throw new Error('Select a unit for every purchase item.');
      const lineAmount = money(quantity * purchaseRate);
      supplierAmount += lineAmount;
      items.push({
        supplierId, productId, quantity, purchaseRate, unit, lineAmount,
        productName: '', supplierName: '', allocatedExpenses: 0, landedCost: lineAmount,
        landedUnitCost: purchaseRate, lotId: '', lotNumber: '',
      });
    }
    const advancePaid = Number(group.advancePaid || 0);
    if (!Number.isFinite(advancePaid) || advancePaid < 0) throw new Error('Supplier advance cannot be negative.');
    supplierAmounts.set(supplierId, { purchaseAmount: money(supplierAmount), advancePaid: money(advancePaid) });
  }

  const expenses = Object.fromEntries(['transport', 'loading', 'unloading', 'other'].map(key => {
    const amount = Number(input.expenses?.[key] || 0);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`${key} expense cannot be negative.`);
    return [key, money(amount)];
  }));
  const expenseTotal = money(Object.values(expenses).reduce((sum, amount) => sum + amount, 0));
  const purchaseValue = money(items.reduce((sum, item) => sum + item.lineAmount, 0));
  if (purchaseValue <= 0) throw new Error('Purchase value must be greater than zero.');

  let allocated = 0;
  items.forEach((item, index) => {
    const allocation = index === items.length - 1
      ? money(expenseTotal - allocated)
      : money(expenseTotal * item.lineAmount / purchaseValue);
    allocated = money(allocated + allocation);
    item.allocatedExpenses = allocation;
    item.landedCost = money(item.lineAmount + allocation);
    item.landedUnitCost = money(item.landedCost / item.quantity);
  });

  const supplierBalances = [...supplierAmounts.entries()].map(([supplierId, amounts]) => {
    if (amounts.advancePaid > amounts.purchaseAmount) throw new Error('Supplier advance cannot exceed that supplier purchase amount.');
    return {
      supplierId,
      purchaseAmount: amounts.purchaseAmount,
      advancePaid: amounts.advancePaid,
      paidAmount: amounts.advancePaid,
      outstandingPayable: money(amounts.purchaseAmount - amounts.advancePaid),
    };
  });
  return {
    date, idempotencyKey, items, expenses, purchaseValue, expenseTotal,
    landedCostTotal: money(purchaseValue + expenseTotal), supplierBalances,
    sourceMandi: String(input.sourceMandi || '').trim(),
    truckNumber: String(input.truckNumber || '').trim(),
    purchaseReference: String(input.purchaseReference || '').trim(),
    notes: String(input.notes || '').trim(),
  };
}

export function calculateOwnTradingLotMetrics({ item, sales = [], returns = [], stockEntry = {} }) {
  const lotId = String(item.lotId || '');
  const lotSales = sales.filter(sale => String(sale.stockEntryId || '') === lotId && sale.isDeleted !== true);
  const saleIds = new Set(lotSales.map(sale => String(sale.id || sale._id)));
  const lotReturns = returns.filter(ret => ret.status === 'Approved' && ret.isDeleted !== true &&
    (String(ret.stockEntryId || '') === lotId || saleIds.has(String(ret.saleId || ''))));
  const grossSoldQuantity = lotSales.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0);
  const returnedQuantity = lotReturns.reduce((sum, ret) => sum + (Number(ret.produceReturnedQty) || 0), 0);
  const goodReturnedQuantity = lotReturns.filter(ret => (ret.produceCondition || 'Good') === 'Good')
    .reduce((sum, ret) => sum + (Number(ret.produceReturnedQty) || 0), 0);
  const wastageQuantity = Math.max(0, returnedQuantity - goodReturnedQuantity);
  const soldQuantity = Math.max(0, grossSoldQuantity - returnedQuantity);
  const remainingQuantity = Math.max(0, Number(stockEntry.remainingQuantity ?? (Number(item.quantity) - soldQuantity - wastageQuantity)) || 0);
  const landedUnitCost = Number(item.landedUnitCost) || 0;
  const salesRevenue = money(lotSales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0) - lotReturns.reduce((sum, ret) => sum + (Number(ret.returnAmount) || 0), 0));
  const costOfGoodsSold = money(soldQuantity * landedUnitCost);
  const wastageCost = money(wastageQuantity * landedUnitCost);
  const remainingStockValue = money(remainingQuantity * landedUnitCost);
  const grossTradingProfit = money(salesRevenue - money(soldQuantity * landedUnitCost));
  const netTradingProfit = money(grossTradingProfit - wastageCost);
  return {
    grossSoldQuantity, returnedQuantity, goodReturnedQuantity, wastageQuantity,
    soldQuantity, remainingQuantity, landedUnitCost, salesRevenue,
    costOfGoodsSold, wastageCost, remainingStockValue, grossTradingProfit, netTradingProfit,
  };
}

export function buildOwnTradingReport({ purchases = [], stockEntries = [], sales = [], returns = [], filters = {} }) {
  const stockMap = new Map(stockEntries.map(stock => [String(stock.id || stock._id), stock]));
  const rows = [];
  const salesByLot = new Map();
  const saleLot = new Map();
  const returnsByLot = new Map();
  for (const sale of sales) {
    const key = String(sale.stockEntryId || '');
    if (!salesByLot.has(key)) salesByLot.set(key, []);
    salesByLot.get(key).push(sale);
    saleLot.set(String(sale.id || sale._id), key);
  }
  for (const ret of returns) {
    const key = String(ret.stockEntryId || saleLot.get(String(ret.saleId)) || '');
    if (!returnsByLot.has(key)) returnsByLot.set(key, []);
    returnsByLot.get(key).push(ret);
  }
  const selectedPurchases = purchases.filter(purchase => {
    if (purchase.status !== 'Posted') return false;
    if (filters.startDate && purchase.date < filters.startDate) return false;
    if (filters.endDate && purchase.date > filters.endDate) return false;
    if (filters.purchaseReference && !String(purchase.purchaseReference || '').toLowerCase().includes(String(filters.purchaseReference).toLowerCase())) return false;
    if (filters.sourceMandi && !String(purchase.sourceMandi || '').toLowerCase().includes(String(filters.sourceMandi).toLowerCase())) return false;
    return true;
  });

  for (const purchase of selectedPurchases) {
    const selectedSupplierBalance = (purchase.supplierBalances || []).filter(balance => !filters.supplierId || String(balance.supplierId) === String(filters.supplierId));
    if (filters.supplierId && selectedSupplierBalance.length === 0) continue;
    // Supplier payments belong to the purchase, not individual product lots.
    // Allocate cumulatively so rounding cannot duplicate or lose cents.
    const paidByLot = new Map();
    for (const balance of purchase.supplierBalances || []) {
      const lines = (purchase.items || []).filter(item => item.supplierId === balance.supplierId);
      const total = lines.reduce((sum, item) => sum + Number(item.lineAmount), 0);
      let cumulative = 0, allocated = 0;
      for (const item of lines) {
        cumulative += Number(item.lineAmount);
        const target = total ? money(Number(balance.paidAmount ?? balance.advancePaid ?? 0) * cumulative / total) : 0;
        paidByLot.set(String(item.lotId), money(target - allocated));
        allocated = target;
      }
    }
    for (const item of purchase.items || []) {
      if (filters.productId && String(item.productId) !== String(filters.productId)) continue;
      if (filters.lotId && String(item.lotId) !== String(filters.lotId)) continue;
      if (filters.supplierId && String(item.supplierId) !== String(filters.supplierId)) continue;
      const lotSales = (salesByLot.get(String(item.lotId || '')) || []).filter(sale => String(sale.stockEntryId || '') === String(item.lotId || '') && sale.businessMode === 'Own Trading' && sale.isDeleted !== true && (!filters.customerId || String(sale.customerId || '') === String(filters.customerId)));
      const lotSaleIds = new Set(lotSales.map(sale => String(sale.id || sale._id)));
      const lotReturns = (returnsByLot.get(String(item.lotId || '')) || []).filter(ret => ret.status === 'Approved' && ret.isDeleted !== true &&
        (!filters.customerId || String(ret.customerId || '') === String(filters.customerId)) &&
        (String(ret.stockEntryId || '') === String(item.lotId || '') || lotSaleIds.has(String(ret.saleId || ''))));
      const metrics = calculateOwnTradingLotMetrics({ item, sales: lotSales, returns: lotReturns, stockEntry: stockMap.get(String(item.lotId || '')) || {} });
      const supplierBalance = selectedSupplierBalance.find(balance => String(balance.supplierId) === String(item.supplierId)) || {};
      const customerIds = [...new Set(lotSales.map(sale => String(sale.customerId || '')).filter(Boolean))];
      const customerBalances = (purchase.customerBalances || []).filter(balance => String(balance.stockEntryId || '') === String(item.lotId || '') && customerIds.includes(String(balance.customerId)) && (!filters.customerId || String(balance.customerId) === String(filters.customerId)));
      const outstandingPayable = Number(supplierBalance.outstandingPayable) || 0;
      const paymentStatus = outstandingPayable <= 0 ? 'Paid' : (Number(supplierBalance.paidAmount || supplierBalance.advancePaid) > 0 ? 'Partial' : 'Unpaid');
      if (filters.paymentStatus && filters.paymentStatus !== 'All' && paymentStatus !== filters.paymentStatus) continue;
      const supplierPaid = paidByLot.get(String(item.lotId)) || 0;
      const supplierPayable = money(Number(item.lineAmount) - supplierPaid);
      const saleStatus = metrics.remainingQuantity <= 0 ? 'Sold' : metrics.soldQuantity > 0 ? 'Partially Sold' : 'Unsold';
      if (filters.saleStatus && filters.saleStatus !== 'All' && saleStatus !== filters.saleStatus) continue;
      rows.push({
        stockEntryId: item.lotId,
        saleStatus,
        purchaseDate: purchase.date,
        purchaseReference: purchase.purchaseReference,
        sourceMandi: purchase.sourceMandi || '-',
        truckNumber: purchase.truckNumber || '-',
        lotId: item.lotNumber || item.lotId,
        supplierName: item.supplierName,
        productName: item.productName,
        purchasedQuantity: Number(item.quantity) || 0,
        unit: item.unit,
        purchaseRate: Number(item.purchaseRate) || 0,
        purchaseAmount: Number(item.lineAmount) || 0,
        allocatedExpenses: Number(item.allocatedExpenses) || 0,
        landedCost: Number(item.landedCost) || 0,
        landedUnitCost: Number(item.landedUnitCost) || 0,
        soldQuantity: metrics.soldQuantity,
        remainingQuantity: metrics.remainingQuantity,
        returnedQuantity: metrics.returnedQuantity,
        wastageQuantity: metrics.wastageQuantity,
        salesRevenue: metrics.salesRevenue,
        costOfGoodsSold: metrics.costOfGoodsSold,
        grossTradingProfit: metrics.grossTradingProfit,
        allocatedExpenseUsed: money(metrics.soldQuantity * (Number(item.allocatedExpenses) / (Number(item.quantity) || 1))),
        wastageCost: metrics.wastageCost,
        netTradingProfit: metrics.netTradingProfit,
        supplierPayments: supplierPaid,
        supplierPayable,
        customerName: customerBalances.map(balance => balance.customerName).join(', ') || '-',
        customerRecoveries: customerBalances.reduce((sum, balance) => sum + (Number(balance.recoveredAmount) || 0), 0),
        customerReceivable: customerBalances.reduce((sum, balance) => sum + Math.max(0, Number(balance.outstandingReceivable) || 0), 0),
        paymentStatus,
      });
    }
  }

  const sum = key => money(rows.reduce((total, row) => total + (Number(row[key]) || 0), 0));
  const summary = {
    totalPurchaseValue: sum('purchaseAmount'),
    totalSalesRevenue: sum('salesRevenue'),
    costOfGoodsSold: sum('costOfGoodsSold'),
    outstandingSupplierPayables: sum('supplierPayable'),
    outstandingCustomerReceivables: sum('customerReceivable'),
    remainingStockValue: money(rows.reduce((total, row) => total + row.remainingQuantity * row.landedUnitCost, 0)),
    grossTradingProfit: sum('grossTradingProfit'),
    totalAllocatedExpenses: sum('allocatedExpenses'),
    totalWastageCost: sum('wastageCost'),
    netTradingProfit: sum('netTradingProfit'),
  };
  return { rows, summary };
}
