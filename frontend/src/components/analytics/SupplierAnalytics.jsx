import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
import { Boxes, DollarSign, TrendingUp, CreditCard, BarChart2, AlertCircle, Percent, Wallet } from 'lucide-react';
import DateRangeFilter, { filterRecordsByDate } from './DateRangeFilter.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { groupRecordsByTime, formatCurrency, formatCompactNumber } from '../../utils/analyticsHelpers.js';
import { calculateSupplyFinancials } from '../../utils/commission.js';

export default function SupplierAnalytics({ supplies = [], payments = [], supplierProfile = {}, products = [] }) {
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState('30D');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [grouping, setGrouping] = useState('daily');

  // Product breakdown sort & pagination state
  const [productSortBy, setProductSortBy] = useState('value'); // 'value' | 'quantity'
  const [showAllProducts, setShowAllProducts] = useState(false);

  // Filter supplies & payments by date range
  const filteredSupplies = useMemo(() => {
    return filterRecordsByDate(supplies, dateRange, customStart, customEnd, 'date');
  }, [supplies, dateRange, customStart, customEnd]);

  const filteredPayments = useMemo(() => {
    return filterRecordsByDate(payments, dateRange, customStart, customEnd, 'date');
  }, [payments, dateRange, customStart, customEnd]);

  // Compute exact financial metrics per supply item using calculateSupplyFinancials
  const suppliesWithFinancials = useMemo(() => {
    return filteredSupplies.map(s => {
      const fin = calculateSupplyFinancials(s, products);
      return {
        ...s,
        financials: fin
      };
    });
  }, [filteredSupplies, products]);

  // Aggregate financial metrics for the selected period (ONLY settled lots where Record to Payables & Supply Value was clicked)
  const periodTotals = useMemo(() => {
    let grossSupplyValue = 0;
    let commissionAmount = 0;
    let totalExpenses = 0;
    let totalDeductions = 0;
    let netPayable = 0;
    let totalQuantity = 0;

    suppliesWithFinancials.forEach(item => {
      if (!item.isSettled) return; // Calculate lot value only after clicking Record to Payables & Supply Value
      const fin = item.financials;
      grossSupplyValue += fin.grossAmount;
      commissionAmount += fin.commissionAmount;
      totalExpenses += fin.totalExpenses;
      totalDeductions += fin.totalDeductions;
      netPayable += fin.netPayable;
      totalQuantity += Number(item.quantity) || 0;
    });

    const periodPaid = filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const currentBalance = Number(supplierProfile?.currentBalance) || 0;
    const totalPaidOverall = Number(supplierProfile?.totalPaid) || 0;

    return {
      grossSupplyValue: Math.round(grossSupplyValue * 100) / 100,
      commissionAmount: Math.round(commissionAmount * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netPayable: Math.round(netPayable * 100) / 100,
      totalQuantity,
      periodPaid,
      currentBalance,
      totalPaidOverall
    };
  }, [suppliesWithFinancials, filteredPayments, supplierProfile]);

  // 1. Supply Value Trend Time Series (ONLY settled lots)
  const supplyTrendData = useMemo(() => {
    const settledSupplies = suppliesWithFinancials.filter(s => s.isSettled);
    return groupRecordsByTime(
      settledSupplies,
      'date',
      {
        grossSupplyValue: item => item.financials.grossAmount,
        netPayable: item => item.financials.netPayable
      },
      grouping
    );
  }, [suppliesWithFinancials, grouping]);

  // 2. Product Supply Breakdown (ONLY settled lots)
  const productBreakdown = useMemo(() => {
    const map = {};
    suppliesWithFinancials.forEach(s => {
      if (!s.isSettled) return; // Calculate lot value only after Record to Payables
      const name = s.productName || 'General Produce';
      if (!map[name]) {
        map[name] = { productName: name, totalQuantity: 0, grossValue: 0, netPayable: 0, shipmentCount: 0 };
      }
      map[name].totalQuantity += Number(s.quantity) || 0;
      map[name].grossValue += s.financials.grossAmount;
      map[name].netPayable += s.financials.netPayable;
      map[name].shipmentCount += 1;
    });

    const list = Object.values(map);
    list.sort((a, b) => {
      if (productSortBy === 'quantity') {
        return b.totalQuantity - a.totalQuantity;
      }
      return b.grossValue - a.grossValue;
    });

    return list;
  }, [suppliesWithFinancials, productSortBy]);

  const displayedProducts = showAllProducts ? productBreakdown : productBreakdown.slice(0, 10);

  // 3. Gross vs Commission vs Net Comparison Chart Data
  const grossVsNetChartData = [
    { name: 'Gross Supply', amount: periodTotals.grossSupplyValue, fill: '#3B82F6' },
    { name: 'Commission', amount: periodTotals.commissionAmount, fill: '#F59E0B' },
    { name: 'Other Expenses', amount: periodTotals.totalExpenses, fill: '#EF4444' },
    { name: 'Net Payable', amount: periodTotals.netPayable, fill: '#10B981' }
  ];

  // 4. Settlement & Outstanding Payment Trend
  const paymentTrendData = useMemo(() => {
    return groupRecordsByTime(
      filteredPayments,
      'date',
      { paymentReceived: p => p.amount || 0 },
      grouping
    );
  }, [filteredPayments, grouping]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('Beopari/Grower Supply & Settlement Analytics')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Exact visualization of crop supply value, commission deductions, net payables, and account settlements')}</p>
        </div>
      </div>

      {/* Date Range Filter */}
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t('Gross Supply Value')}</span>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl"><Boxes size={16} /></div>
          </div>
          <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">
            {formatCurrency(periodTotals.grossSupplyValue)}
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">{filteredSupplies.length} shipments ({periodTotals.totalQuantity} units)</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t('Commission Deducted')}</span>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl"><Percent size={16} /></div>
          </div>
          <h4 className="text-xl font-black text-amber-600 dark:text-amber-400 mt-2">
            - {formatCurrency(periodTotals.commissionAmount)}
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">{t('Exact Mandi commission logic')}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t('Other Lot Expenses')}</span>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl"><DollarSign size={16} /></div>
          </div>
          <h4 className="text-xl font-black text-rose-500 mt-2">
            - {formatCurrency(periodTotals.totalExpenses)}
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">{t('Freight & Mandi charges')}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t('Net Earned / Payable')}</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl"><TrendingUp size={16} /></div>
          </div>
          <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {formatCurrency(periodTotals.netPayable)}
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">{t('Net payable for period')}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t('Paid / Received Amount')}</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl"><Wallet size={16} /></div>
          </div>
          <h4 className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {formatCurrency(periodTotals.periodPaid)}
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">
            {filteredPayments.length > 0 ? `${filteredPayments.length} payments in period` : `Total Paid: ${formatCurrency(periodTotals.totalPaidOverall)}`}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t('Current Ledger Balance')}</span>
            <div className="p-2 bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400 rounded-xl"><CreditCard size={16} /></div>
          </div>
          <h4 className="text-xl font-black text-[#4F46E5] dark:text-indigo-400 mt-2">
            {formatCurrency(Math.abs(periodTotals.currentBalance))}
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">{t(periodTotals.currentBalance >= 0 ? 'Receivable from broker' : 'Advance balance')}</p>
        </div>
      </div>

      {/* Grid Row 1: Supply Trend & Gross vs Commission Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART 1: Supply Value Trend */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('1. Supply Value Trend')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Gross supply value vs Net payable earned over time ({grouping})</p>
              </div>
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                <TrendingUp size={18} />
              </div>
            </div>

            {supplyTrendData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                <p className="text-xs font-semibold">{t('No supply history available for the selected period.')}</p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={supplyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                      formatter={(val, name) => [
                        formatCurrency(val),
                        name === 'grossSupplyValue' ? 'Gross Supply Value' : 'Net Payable'
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      formatter={(value) => value === 'grossSupplyValue' ? 'Gross Supply Value' : 'Net Payable'}
                    />
                    <Line
                      type="monotone"
                      dataKey="grossSupplyValue"
                      name="grossSupplyValue"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#3B82F6' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="netPayable"
                      name="netPayable"
                      stroke="#10B981"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#10B981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* CHART 3: Gross Supply vs Commission vs Net Payable Breakdown */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('3. Financial Deduction Waterfall')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('Gross supply → Commission & Expenses → Net Payable')}</p>
              </div>
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                <BarChart2 size={18} />
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grossVsNetChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    formatter={(val) => [formatCurrency(val), 'Amount']}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {grossVsNetChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] space-y-1 text-slate-600 dark:text-slate-300 font-semibold">
            <div className="flex justify-between">
              <span>{t('Gross Value')}:</span>
              <span className="font-bold text-blue-500">{formatCurrency(periodTotals.grossSupplyValue)}</span>
            </div>
            <div className="flex justify-between text-rose-500">
              <span>{t('Total Deductions')}:</span>
              <span className="font-bold">- {formatCurrency(periodTotals.totalDeductions)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-black border-t border-slate-200 dark:border-slate-700 pt-1 text-xs">
              <span>{t('Net Payable')}:</span>
              <span>{formatCurrency(periodTotals.netPayable)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Row 2: Product Supply Breakdown & Payment Settlement Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 2: Product Supply Breakdown */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('2. Produce Supply Breakdown')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Most supplied crops/produce by {productSortBy}</p>
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
                  By Value
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
                  By Quantity
                </button>
              </div>
            </div>

            {displayedProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                <p className="text-xs font-semibold">{t('No produce data available for the selected period.')}</p>
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
                        name === 'grossValue' ? formatCurrency(val) : `${val} Crates/Units`,
                        name === 'grossValue' ? 'Gross Value' : 'Quantity'
                      ]}
                    />
                    <Bar
                      dataKey={productSortBy === 'value' ? 'grossValue' : 'totalQuantity'}
                      name={productSortBy === 'value' ? 'Gross Value' : 'Quantity'}
                      fill="#3B82F6"
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
                {showAllProducts ? 'Show Top 10 Only' : `View All (${productBreakdown.length} Products)`}
              </button>
            </div>
          )}
        </div>

        {/* CHART 4: Payment & Settlement Trend */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('4. Settlement Payment Activity')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Cash & bank payments received from broker over time ({grouping})</p>
              </div>
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <CreditCard size={18} />
              </div>
            </div>

            {paymentTrendData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                <p className="text-xs font-semibold">{t('No settlement payment records found for the selected period.')}</p>
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
                      formatter={(val) => [formatCurrency(val), 'Payment Received']}
                    />
                    <Line
                      type="monotone"
                      dataKey="paymentReceived"
                      name="Payment Received"
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
