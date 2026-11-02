// One immutable report snapshot feeds both printing and PDF generation.
export const OWN_TRADING_OUTPUT_SECTIONS = [
  { title: 'Purchases and Stock', keys: ['purchaseDate', 'purchaseReference', 'lotId', 'supplierName', 'sourceMandi', 'truckNumber', 'productName', 'unit', 'purchasedQuantity', 'purchaseRate', 'purchaseAmount', 'allocatedExpenses', 'landedCost', 'landedUnitCost'] },
  { title: 'Sales and Realized Profit', keys: ['lotId', 'productName', 'unit', 'soldQuantity', 'remainingQuantity', 'returnedQuantity', 'wastageQuantity', 'salesRevenue', 'costOfGoodsSold', 'grossTradingProfit', 'wastageCost', 'netTradingProfit', 'saleStatus'] },
  { title: 'Supplier and Customer Balances', keys: ['lotId', 'supplierName', 'productName', 'supplierPayments', 'supplierPayable', 'paymentStatus', 'customerName', 'customerRecoveries', 'customerReceivable'] },
];
const summaryLabels = {
  totalPurchaseValue: 'Total Purchase Cost', totalSalesRevenue: 'Total Sales Revenue',
  totalAllocatedExpenses: 'Total Expenses', grossTradingProfit: 'Total Realized Profit',
  outstandingSupplierPayables: 'Outstanding Supplier Payables', remainingStockValue: 'Current Unsold Stock Value',
};
const number = value => Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildOwnTradingOutput({ report, rows = report.rows, columns, suppliers = [], products = [], lots = [], t = value => value }) {
  const applied = report.appliedFilters || {};
  const lookup = (items, id, key = 'name') => items.find(item => String(item.id || item._id) === String(id))?.[key] || id;
  const filters = [
    ['Supplier / Beopari', applied.supplierId && lookup(suppliers, applied.supplierId)],
    ['Product', applied.productId && lookup(products, applied.productId)],
    ['Lot ID', applied.lotId && lookup(lots, applied.lotId, 'lotNumber')],
    ['Purchase Reference', applied.purchaseReference], ['Source Mandi', applied.sourceMandi],
    ['Sale Status', applied.saleStatus], ['Payment Status', applied.paymentStatus === 'Partial' ? 'Partially Paid' : applied.paymentStatus],
  ].filter(([, value]) => value && value !== 'All').map(([label, value]) => ({ label: t(label), value: t(value) }));
  const format = (column, value) => {
    if (value == null) return '—';
    if (column.format?.startsWith('currency')) return number(value);
    if (column.format === 'number') return Number(value).toLocaleString('en-PK', { maximumFractionDigits: 6 });
    return t(value === 'Partial' ? 'Partially Paid' : String(value));
  };
  return {
    title: t('Own Trading Report'),
    period: `${t(applied.dateBasis || 'Purchase Date')}: ${applied.startDate || t('All dates')} ${t('to')} ${applied.endDate || t('present')}`,
    generatedAt: report.generatedAt,
    filters,
    summary: Object.entries(summaryLabels).map(([key, label]) => ({ label: t(label), value: `Rs. ${number(report.summary?.[key])}` })),
    note: t('Amounts in Rs. Balances include all linked activity for the selected purchases. Supplier payments are allocated by purchase value. Expenses are included in landed cost. Mixed-unit quantities are not added together.'),
    sections: OWN_TRADING_OUTPUT_SECTIONS.map(section => {
      const selected = section.keys.map(key => columns.find(column => column.key === key)).filter(Boolean);
      return {
        title: t(section.title), columns: selected.map(column => ({ ...column, label: t(column.label) })),
        rows: rows.map(row => selected.map(column => format(column, row[column.key]))),
        totals: selected.map((column, index) => index === 0 ? t('Totals') : format(column, report.totals?.[column.key])),
      };
    }),
  };
}
