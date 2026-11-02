import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts';
import { TrendingUp, CreditCard, BarChart2, AlertCircle } from 'lucide-react';
import DateRangeFilter, { filterRecordsByDate } from './DateRangeFilter.jsx';
import { groupRecordsByTime, formatCurrency, formatCompactNumber } from '../../utils/analyticsHelpers.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

export default function CustomerAnalytics({
  purchases = [],
  payments = [],
  customerProfile = {},
  dateRange: propDateRange,
  onRangeChange: propOnRangeChange,
  customStart: propCustomStart,
  onCustomStartChange: propOnCustomStartChange,
  customEnd: propCustomEnd,
  onCustomEndChange: propOnCustomEndChange,
  grouping: propGrouping,
  onGroupingChange: propOnGroupingChange,
  hideFilterBar = false
}) {
  const { t } = useLanguage();
  const [internalDateRange, setInternalDateRange] = useState('ALL');
  const [internalCustomStart, setInternalCustomStart] = useState('');
  const [internalCustomEnd, setInternalCustomEnd] = useState('');
  const [internalGrouping, setInternalGrouping] = useState('daily');

  const dateRange = propDateRange !== undefined ? propDateRange : internalDateRange;
  const setDateRange = propOnRangeChange || setInternalDateRange;

  const customStart = propCustomStart !== undefined ? propCustomStart : internalCustomStart;
  const setCustomStart = propOnCustomStartChange || setInternalCustomStart;

  const customEnd = propCustomEnd !== undefined ? propCustomEnd : internalCustomEnd;
  const setCustomEnd = propOnCustomEndChange || setInternalCustomEnd;

  const grouping = propGrouping !== undefined ? propGrouping : internalGrouping;
  const setGrouping = propOnGroupingChange || setInternalGrouping;

  // Product breakdown sort & pagination state
  const [productSortBy, setProductSortBy] = useState('value'); // 'value' | 'quantity'
  const [showAllProducts, setShowAllProducts] = useState(false);

  // Filter purchases & payments by selected date range
  const filteredPurchases = useMemo(() => {
    return filterRecordsByDate(purchases, dateRange, customStart, customEnd, 'date');
  }, [purchases, dateRange, customStart, customEnd]);

  const filteredPayments = useMemo(() => {
    return filterRecordsByDate(payments, dateRange, customStart, customEnd, 'date');
  }, [payments, dateRange, customStart, customEnd]);

  // 1. Purchase Trend Time Series
  const purchaseTrendData = useMemo(() => {
    return groupRecordsByTime(
      filteredPurchases,
      'date',
      { purchaseAmount: p => p.totalAmount || 0, quantity: p => p.quantity || 0 },
      grouping
    );
  }, [filteredPurchases, grouping]);

  // 2. Product Purchase Breakdown
  const productBreakdown = useMemo(() => {
    const map = {};
    filteredPurchases.forEach(p => {
      const name = p.productName || 'General Produce';
      if (!map[name]) {
        map[name] = { productName: name, totalQuantity: 0, totalValue: 0, orderCount: 0 };
      }
      map[name].totalQuantity += Number(p.quantity) || 0;
      map[name].totalValue += Number(p.totalAmount) || 0;
      map[name].orderCount += 1;
    });

    const list = Object.values(map);
    list.sort((a, b) => {
      if (productSortBy === 'quantity') {
        return b.totalQuantity - a.totalQuantity;
      }
      return b.totalValue - a.totalValue;
    });

    return list;
  }, [filteredPurchases, productSortBy]);

  const displayedProducts = showAllProducts ? productBreakdown : productBreakdown.slice(0, 10);

  // 3. Purchase vs Payment Metrics
  const summaryMetrics = useMemo(() => {
    const periodPurchases = filteredPurchases.reduce((acc, p) => acc + (Number(p.totalAmount) || Number(p.netSale) || Number(p.grossSale) || 0), 0);
    const periodPayments = filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    
    // Total purchases & total paid overall
    const profilePurchases = Number(customerProfile?.totalPurchases) || 0;
    const profilePaid = Number(customerProfile?.totalPaid) || 0;
    const profileBalance = Number(customerProfile?.currentBalance) || 0;

    const totalPurchasesOverall = (dateRange === 'ALL')
      ? (purchases.length > 0 ? periodPurchases : profilePurchases)
      : periodPurchases;

    const totalPaidOverall = (dateRange === 'ALL')
      ? (payments.length > 0 ? periodPayments : profilePaid)
      : periodPayments;

    const currentBalance = (dateRange === 'ALL')
      ? (customerProfile?.currentBalance !== undefined && customerProfile?.currentBalance !== null ? profileBalance : (totalPurchasesOverall - totalPaidOverall))
      : (periodPurchases - periodPayments);

    return {
      periodPurchases,
      periodPayments,
      totalPurchasesOverall,
      totalPaidOverall,
      currentBalance
    };
  }, [filteredPurchases, filteredPayments, purchases, payments, customerProfile, dateRange]);

  const financialComparisonData = [
    { name: 'Total Purchased', amount: summaryMetrics.totalPurchasesOverall, fill: '#3B82F6' },
    { name: 'Total Paid', amount: summaryMetrics.totalPaidOverall, fill: '#10B981' },
    { name: 'Outstanding Debt', amount: Math.max(0, summaryMetrics.currentBalance), fill: '#EF4444' }
  ];

  // 4. Payment Trend Time Series
  const paymentTrendData = useMemo(() => {
    return groupRecordsByTime(
      filteredPayments,
      'date',
      { paymentAmount: p => p.amount || 0 },
      grouping
    );
  }, [filteredPayments, grouping]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('Customer Financial & Purchase Analytics')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Visualizing real-time purchase trends, product allocations, and payment balances')}</p>
        </div>
      </div>

      {/* Date Filter Bar */}
      {!hideFilterBar && (
        <DateRangeFilter
          selectedRange={dateRange}
          onRangeChange={setDateRange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
          grouping={grouping}
          onGroupingChange={setGrouping}
        />
      )}



      {/* Grid Row 1: Purchase Trend & Purchase vs Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART 1: Purchase Trend */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('1. Purchase Value Trend')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('Total purchase value over time')} ({t(grouping)})</p>
              </div>
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <TrendingUp size={18} />
              </div>
            </div>

            {purchaseTrendData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                <p className="text-xs font-semibold">{t('No purchase data available for the selected period.')}</p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={purchaseTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} tickFormatter={formatCompactNumber} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                      formatter={(val) => [formatCurrency(val), t('Purchase Amount')]}
                    />
                    <Line
                      type="monotone"
                      dataKey="purchaseAmount"
                      name={t('Purchase Value')}
                      stroke="#4F46E5"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#4F46E5' }}
                      activeDot={{ r: 6, stroke: '#6366F1', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* CHART 3: Purchase vs Payment Comparison */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('3. Purchase vs Payment')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('Financial position & ledger comparison')}</p>
              </div>
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <BarChart2 size={18} />
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialComparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} tickFormatter={formatCompactNumber} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#F8FAFC',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                    formatter={(val) => [formatCurrency(val), t('Amount')]}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {financialComparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between font-semibold">
            <span>{t('Outstanding Debt')}:</span>
            <span className="font-extrabold text-rose-500">{formatCurrency(summaryMetrics.currentBalance)}</span>
          </div>
        </div>
      </div>

      {/* Grid Row 2: Product Breakdown & Payment Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 2: Product Purchase Breakdown */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('2. Product Purchase Breakdown')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('Most purchased produce items by')} {t(productSortBy)}</p>
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setProductSortBy('value')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    productSortBy === 'value'
                      ? 'bg-[#4F46E5] text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('By Value')}
                </button>
                <button
                  type="button"
                  onClick={() => setProductSortBy('quantity')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    productSortBy === 'quantity'
                      ? 'bg-[#4F46E5] text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('By Quantity')}
                </button>
              </div>
            </div>

            {displayedProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                <p className="text-xs font-semibold">{t('No product data available for the selected period.')}</p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayedProducts} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="productName"
                      stroke="#94A3B8"
                      fontSize={10}
                      tickLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="#94A3B8"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={productSortBy === 'value' ? formatCompactNumber : val => val}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                      formatter={(val, name) => [
                        name === 'totalValue' ? formatCurrency(val) : `${val} Crates/Units`,
                        name === 'totalValue' ? t('Purchase Value') : t('Quantity')
                      ]}
                    />
                    <Bar
                      dataKey={productSortBy === 'value' ? 'totalValue' : 'totalQuantity'}
                      name={productSortBy === 'value' ? t('Total Value') : t('Total Quantity')}
                      fill="#6366F1"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {productBreakdown.length > 10 && (
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAllProducts(!showAllProducts)}
                className="text-xs font-bold text-[#4F46E5] dark:text-indigo-400 hover:underline"
              >
                {showAllProducts ? t('Show Top 10 Only') : `${t('View All')} (${productBreakdown.length} ${t('Products')})`}
              </button>
            </div>
          )}
        </div>

        {/* CHART 4: Payment Trend */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('4. Payment Trend')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('Verified payment receipts over time')} ({t(grouping)})</p>
              </div>
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <CreditCard size={18} />
              </div>
            </div>

            {paymentTrendData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                <p className="text-xs font-semibold">{t('No payment records found for the selected period.')}</p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={paymentTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} tickFormatter={formatCompactNumber} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                      formatter={(val) => [formatCurrency(val), t('Payment Amount')]}
                    />
                    <Line
                      type="monotone"
                      dataKey="paymentAmount"
                      name={t('Payment Amount')}
                      stroke="#10B981"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#10B981' }}
                      activeDot={{ r: 6, stroke: '#059669', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
