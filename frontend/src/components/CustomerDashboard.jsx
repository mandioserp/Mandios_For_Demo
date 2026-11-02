import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { openSafePrintWindowFromElement } from '../utils/safePrint.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { Eye, Printer, ShoppingBag, FileText, CheckCircle2, Search, ArrowUpRight, Clock, AlertCircle, X, ArrowUpDown, Download, Calendar, ChevronRight, Layers, DollarSign } from 'lucide-react';
import HomeTab from './HomeTab.jsx';
import { openReportInNewTab } from '../utils/navigation.js';
import CustomerAnalytics from './analytics/CustomerAnalytics.jsx';
import BusinessProfile from './settings/BusinessProfile.jsx';
import DateRangeFilter, { filterRecordsByDate } from './analytics/DateRangeFilter.jsx';
import { downloadLedgerPDF, downloadDayWisePurchasePDF, downloadSingleDayPurchasePDF } from '../utils/pdfExport.js';

export default function CustomerDashboard({ tab, setCurrentTab }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [toast, setToast] = useState(null);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'

  // Global Analytics Timeframe State
  const [analyticsDateRange, setAnalyticsDateRange] = useState('ALL');
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState('');
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState('');
  const [analyticsGrouping, setAnalyticsGrouping] = useState('daily');

  // Day Wise Report State
  const [selectedDayModal, setSelectedDayModal] = useState(null);
  const [daySearchQuery, setDaySearchQuery] = useState('');
  const [daySortOrder, setDaySortOrder] = useState('newest');
  const [dayDateRange, setDayDateRange] = useState('all'); // 'all' | 'today' | '7days' | '30days' | 'year' | 'custom'
  const [dayCustomStartDate, setDayCustomStartDate] = useState('');
  const [dayCustomEndDate, setDayCustomEndDate] = useState('');

  // Sorted ledger entries for display according to sortOrder (default Newest First)
  const displayLedger = [...ledger].sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.createdAt || 0).getTime();
    if (dateA !== dateB) {
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    }
    const idxA = ledger.indexOf(a);
    const idxB = ledger.indexOf(b);
    return sortOrder === 'newest' ? idxB - idxA : idxA - idxB;
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customersRes, invoiceSettingsRes, paymentsRes] = await Promise.all([
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/settings/invoice').catch(() => ({ data: null })),
        api.get('/payments').catch(() => ({ data: [] }))
      ]);
      setInvoiceSettings(invoiceSettingsRes.data || null);
      const linkedCustomer = customersRes.data.find(c => 
        (c.userId && (String(c.userId) === String(user.id) || String(c.userId) === String(user._id))) ||
        (user.customerId && (String(c.id) === String(user.customerId) || String(c._id) === String(user.customerId))) ||
        (String(c.id) === String(user.id) || String(c._id) === String(user.id))
      );

      if (linkedCustomer) {
        setCustomerProfile(linkedCustomer);
        const custIdStr = String(linkedCustomer.id || linkedCustomer._id);
        
        // Fetch custom reports to get customer ledger
        const ledgerRes = await api.get(`/reports?type=custom&startDate=2000-01-01&endDate=2050-12-31&customerId=${custIdStr}`);
        setLedger(ledgerRes.data?.customerLedger || []);
        
        // Filter sales by this customer ID
        const salesRes = await api.get('/sales');
        const custSales = (salesRes.data || []).filter(s => String(s.customerId) === custIdStr);
        setPurchases(custSales);

        // Filter payments by this customer ID
        const custPayments = (paymentsRes.data || []).filter(p => 
          String(p.partyId) === custIdStr && p.partyType === 'Customer'
        );
        setPayments(custPayments);
      } else {
        showToast(t('No customer profile linked to this login.'), 'error');
      }
    } catch (err) {
      showToast(t('Failed to load transaction history.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tab]);

  const triggerPrint = (title) => {
    const printContent = document.getElementById('printable-invoice');
    const win = openSafePrintWindowFromElement(title, printContent, 'height=700,width=900');
    if (!win) return;
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">{t("Opening Customer Desk...")}</p>
      </div>
    );
  }

  if (!customerProfile) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center space-x-3">
        <AlertCircle size={20} />
        <div>
          <h4 className="text-sm font-bold uppercase">{t("Account Link Error")}</h4>
          <p className="text-xs opacity-80 mt-0.5">{t("We could not locate an active Customer Profile linked to your username. Contact Lahore Mandi Admin to link your login account!")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl transition-all border
          ${toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-[#4F46E5]/10 border-[#4F46E5]/20 text-[#4F46E5] dark:text-indigo-400'}`}>
          <CheckCircle2 size={18} />
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* ----------------- TAB: HOME ----------------- */}
      {tab === 'home' && (
        <HomeTab setCurrentTab={setCurrentTab} />
      )}

      {/* ----------------- TAB: DASHBOARD ----------------- */}
      {tab === 'dashboard' && (() => {
        const filteredPurchases = filterRecordsByDate(purchases, analyticsDateRange, analyticsCustomStart, analyticsCustomEnd, 'date');
        const filteredPayments = filterRecordsByDate(payments, analyticsDateRange, analyticsCustomStart, analyticsCustomEnd, 'date');
        const filteredLedger = filterRecordsByDate(ledger, analyticsDateRange, analyticsCustomStart, analyticsCustomEnd, 'date');

        // Dynamic KPI calculations based on selected timeframe
        const calcPurchased = filteredPurchases.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
        const totalPurchased = (analyticsDateRange === 'ALL')
          ? (purchases.length > 0 ? calcPurchased : (Number(customerProfile?.totalPurchases) || 0))
          : calcPurchased;

        const sumPayments = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const sumLedgerCredit = filteredLedger.reduce((sum, l) => sum + (l.type === 'Credit' ? (Number(l.amount) || Number(l.credit) || 0) : (Number(l.credit) || 0)), 0);
        const calcPaid = sumPayments || sumLedgerCredit;
        const totalPaid = (analyticsDateRange === 'ALL')
          ? (payments.length > 0 || ledger.length > 0 ? calcPaid : (Number(customerProfile?.totalPaid) || 0))
          : calcPaid;

        const calculatedBalance = totalPurchased - totalPaid;
        const profileBalance = Number(customerProfile?.currentBalance) || 0;
        const outstandingBalance = (analyticsDateRange === 'ALL')
          ? (customerProfile?.currentBalance !== undefined && customerProfile?.currentBalance !== null ? profileBalance : calculatedBalance)
          : calculatedBalance;

        return (
          <div className="space-y-6">
            {/* Analytics Timeframe Filter Bar placed at TOP of Dashboard */}
            <DateRangeFilter
              selectedRange={analyticsDateRange}
              onRangeChange={setAnalyticsDateRange}
              customStart={analyticsCustomStart}
              customEnd={analyticsCustomEnd}
              onCustomStartChange={setAnalyticsCustomStart}
              onCustomEndChange={setAnalyticsCustomEnd}
              grouping={analyticsGrouping}
              onGroupingChange={setAnalyticsGrouping}
            />

            {/* 4 KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{t("Outstanding Balance (Payable)")}</p>
                  <h3 className={`text-2xl font-black mt-1 ${outstandingBalance > 0 ? 'text-rose-500' : 'text-[#4F46E5] dark:text-indigo-400'}`}>
                    {t("Rs.")} {Math.abs(outstandingBalance).toLocaleString()}
                  </h3>
                  <span className="text-[10px] font-semibold opacity-70">{outstandingBalance > 0 ? t("Debt") : t("Balance")}</span>
                </div>
                <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl"><ArrowUpRight size={22} /></div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{t("Total Purchased")}</p>
                  <h3 className="text-2xl font-black mt-1 text-blue-500">{t("Rs.")} {totalPurchased.toLocaleString()}</h3>
                  <span className="text-[10px] font-semibold opacity-70">{t("Purchase History")}</span>
                </div>
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><ShoppingBag size={22} /></div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{t("Payments")}</p>
                  <h3 className="text-2xl font-black mt-1 text-[#4F46E5] dark:text-indigo-400">{t("Rs.")} {totalPaid.toLocaleString()}</h3>
                  <span className="text-[10px] font-semibold opacity-70">{t("Verified payments on counter")}</span>
                </div>
                <div className="p-3 bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400 rounded-xl"><Clock size={22} /></div>
              </div>
            </div>

            {/* Embedded Customer Analytics Section on Dashboard */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <CustomerAnalytics
                purchases={purchases}
                payments={payments}
                customerProfile={customerProfile}
                ledger={ledger}
                dateRange={analyticsDateRange}
                onRangeChange={setAnalyticsDateRange}
                customStart={analyticsCustomStart}
                onCustomStartChange={setAnalyticsCustomStart}
                customEnd={analyticsCustomEnd}
                onCustomEndChange={setAnalyticsCustomEnd}
                grouping={analyticsGrouping}
                onGroupingChange={setAnalyticsGrouping}
                hideFilterBar={true}
              />
            </div>
          </div>
        );
      })()}

      {/* ----------------- TAB: BUSINESS PROFILE ----------------- */}
      {(tab === 'business_profile' || tab === 'business') && (
        <BusinessProfile showToast={showToast} />
      )}

      {/* ----------------- TAB: PURCHASE HISTORY ----------------- */}
      {tab === 'purchases' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider">{t("My Purchase History Ledger")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("Review all fruits & vegetables purchased from the Mandi")}</p>
          </div>

          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                    <th className="py-4 px-5">{t("Date")}</th>
                    <th className="py-4 px-5">{t("Produce Name")}</th>
                    <th className="py-4 px-5 text-right">{t("Quantity")}</th>
                    <th className="py-4 px-5 text-right">{t("Total Cost Payable")}</th>
                    <th className="py-4 px-5 text-right">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/30 text-slate-700 dark:text-slate-300">
                  {purchases.map(p => (
                    <tr key={p.id || p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                      <td className="py-3.5 px-5 font-bold text-slate-500 dark:text-slate-400">{p.date}</td>
                      <td className="py-3.5 px-5 font-semibold text-[#1E293B] dark:text-slate-100">{p.productName}</td>
                      <td className="py-3.5 px-5 text-right font-bold">{Number(p.quantity || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-5 text-right font-black text-[#4F46E5] dark:text-indigo-400">{t("Rs.")} {Number(p.totalAmount || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-5 text-right">
                        <button 
                          onClick={() => setSelectedInvoice(p)}
                          className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded-lg ml-auto"
                        >
                          <Eye size={12} />
                          <span>{t("INVOICE")}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB: DAY WISE REPORT ----------------- */}
      {tab === 'daywise' && (() => {
        // Filter purchases according to selected date range filter
        const filteredPurchases = purchases.filter(p => {
          if (!p.date) return dayDateRange === 'all';
          
          const parseLocalDate = (dStr) => {
            if (!dStr) return null;
            if (dStr.includes('T')) return new Date(dStr);
            const parts = dStr.split('-');
            if (parts.length === 3) {
              return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            }
            return new Date(dStr);
          };

          const pDate = parseLocalDate(p.date);
          if (!pDate || isNaN(pDate.getTime())) return true;

          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

          if (dayDateRange === 'today') {
            return pDate >= todayStart && pDate <= todayEnd;
          }
          if (dayDateRange === '7days') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
            return pDate >= start && pDate <= todayEnd;
          }
          if (dayDateRange === '30days') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
            return pDate >= start && pDate <= todayEnd;
          }
          if (dayDateRange === 'year') {
            const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            return pDate >= start && pDate <= todayEnd;
          }
          if (dayDateRange === 'custom') {
            let start = new Date(0);
            let end = new Date(8640000000000000);
            if (dayCustomStartDate) {
              const parts = dayCustomStartDate.split('-');
              if (parts.length === 3) start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
            }
            if (dayCustomEndDate) {
              const parts = dayCustomEndDate.split('-');
              if (parts.length === 3) end = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59, 999);
            }
            return pDate >= start && pDate <= end;
          }

          return true; // 'all'
        });

        const dayWiseMap = {};
        filteredPurchases.forEach(p => {
          const dateKey = p.date ? p.date.trim() : 'Unknown Date';
          if (!dayWiseMap[dateKey]) {
            dayWiseMap[dateKey] = {
              date: dateKey,
              items: [],
              totalQuantity: 0,
              totalAmount: 0,
              itemsCount: 0
            };
          }
          dayWiseMap[dateKey].items.push(p);
          dayWiseMap[dateKey].totalQuantity += Number(p.quantity) || 0;
          dayWiseMap[dateKey].totalAmount += Number(p.totalAmount) || 0;
          dayWiseMap[dateKey].itemsCount += 1;
        });

        let dayWiseList = Object.values(dayWiseMap);

        dayWiseList.sort((a, b) => {
          const timeA = new Date(a.date).getTime() || 0;
          const timeB = new Date(b.date).getTime() || 0;
          return daySortOrder === 'newest' ? timeB - timeA : timeA - timeB;
        });

        if (daySearchQuery.trim()) {
          const q = daySearchQuery.toLowerCase();
          dayWiseList = dayWiseList.filter(d => 
            d.date.toLowerCase().includes(q) ||
            d.items.some(item => item.productName?.toLowerCase().includes(q))
          );
        }

        const grandTotalDays = Object.keys(dayWiseMap).length;
        const grandTotalQty = filteredPurchases.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

        return (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider flex items-center space-x-2">
                  <Calendar size={20} className="text-[#4F46E5]" />
                  <span>{t("Day Wise Purchase Report")}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("Sequenced date-wise purchase logs. Click any date row to view products bought on that date.")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => downloadDayWisePurchasePDF({
                    customerDetails: customerProfile,
                    dayWiseList: dayWiseList,
                    totals: {
                      grandTotalDays,
                      grandTotalQty,
                      grandTotalAmount: dayWiseList.reduce((acc, d) => acc + (d.totalAmount || 0), 0),
                    },
                    filterTitle: dayDateRange === 'custom' 
                      ? `${dayCustomStartDate || 'Start'} to ${dayCustomEndDate || 'End'}` 
                      : (dayDateRange === 'all' ? 'All Time' : dayDateRange)
                  })}
                  className="flex items-center space-x-1.5 bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all shrink-0"
                >
                  <Download size={14} />
                  <span>{t("Download PDF Report")}</span>
                </button>

                <div className="relative flex-1 sm:w-64 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={daySearchQuery}
                    onChange={(e) => setDaySearchQuery(e.target.value)}
                    placeholder={t("Search date or product...")}
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-[#4F46E5]"
                  />
                  {daySearchQuery && (
                    <button onClick={() => setDaySearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setDaySortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 transition-all shrink-0"
                >
                  <ArrowUpDown size={13} className="text-[#4F46E5]" />
                  <span>{daySortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
                </button>
              </div>
            </div>

            {/* Date Filter Selection Bar */}
            <div className="p-3.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
                  <Calendar size={14} className="text-[#4F46E5]" />
                  <span>{t("Filter Date Range:")}</span>
                </span>
                
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  {[
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: '7days', label: 'Last 7 Days' },
                    { id: '30days', label: '30 Days' },
                    { id: 'year', label: 'Year' },
                    { id: 'custom', label: 'Custom Date' }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDayDateRange(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                        dayDateRange === f.id
                          ? 'bg-[#4F46E5] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Selector inputs if 'custom' selected */}
              {dayDateRange === 'custom' && (
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 animate-fade-in">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-500">{t("From Date:")}</span>
                    <input
                      type="date"
                      value={dayCustomStartDate}
                      onChange={(e) => setDayCustomStartDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-500">{t("To Date:")}</span>
                    <input
                      type="date"
                      value={dayCustomEndDate}
                      onChange={(e) => setDayCustomEndDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  {(dayCustomStartDate || dayCustomEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDayCustomStartDate('');
                        setDayCustomEndDate('');
                      }}
                      className="text-xs text-rose-500 hover:underline font-bold ml-auto"
                    >
                      {t("Reset Dates")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t("Total Purchase Days")}</p>
                  <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">{grandTotalDays} {t("Days")}</h4>
                </div>
                <div className="p-2.5 bg-indigo-500/10 text-[#4F46E5] dark:text-indigo-400 rounded-xl"><Calendar size={18} /></div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t("Total Quantity Purchased")}</p>
                  <h4 className="text-xl font-black text-blue-500 mt-1">{grandTotalQty.toLocaleString()} {t("Units")}</h4>
                </div>
                <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl"><ShoppingBag size={18} /></div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold bg-slate-50/50 dark:bg-slate-900/50">
                      <th className="py-3.5 px-5">{t("S.No")}</th>
                      <th className="py-3.5 px-5">{t("Purchase Date")}</th>
                      <th className="py-3.5 px-5 text-center">{t("Items Purchased")}</th>
                      <th className="py-3.5 px-5 text-right">{t("Total Quantity")}</th>
                      <th className="py-3.5 px-5 text-right">{t("Total Day Invoice")}</th>
                      <th className="py-3.5 px-5 text-center">{t("Action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/30 text-slate-700 dark:text-slate-300">
                    {dayWiseList.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-400">
                          <p className="font-bold text-sm">{t("No date records found")}</p>
                          <p className="text-xs mt-1">{t("Try adjusting your search filter or view overall purchase history.")}</p>
                        </td>
                      </tr>
                    ) : (
                      dayWiseList.map((dayData, idx) => (
                        <tr
                          key={dayData.date}
                          onClick={() => setSelectedDayModal(dayData)}
                          className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors group"
                        >
                          <td className="py-4 px-5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-4 px-5">
                            <div className="flex items-center space-x-2.5">
                              <div className="p-2 bg-indigo-500/10 text-[#4F46E5] dark:text-indigo-400 rounded-lg group-hover:bg-[#4F46E5] group-hover:text-white transition-colors">
                                <Calendar size={14} />
                              </div>
                              <span className="font-black text-sm text-slate-800 dark:text-slate-100">{dayData.date}</span>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-center">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              <Layers size={11} className="text-[#4F46E5]" />
                              <span>{dayData.itemsCount} {t(dayData.itemsCount === 1 ? 'Produce' : 'Produces')}</span>
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right font-extrabold text-blue-500 dark:text-blue-400">
                            {dayData.totalQuantity.toLocaleString()} {t("Units")}
                          </td>
                          <td className="py-4 px-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            {t("Rs.")} {dayData.totalAmount.toLocaleString()}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDayModal(dayData);
                                }}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-[11px] shadow-sm transition-all"
                              >
                                <Eye size={12} />
                                <span>{t("View Products")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadSingleDayPurchasePDF({
                                    customerDetails: customerProfile,
                                    dayData: dayData
                                  });
                                }}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] border border-slate-200 dark:border-slate-700 transition-all"
                                title={t("Download PDF for this day")}
                              >
                                <Download size={12} className="text-[#4F46E5]" />
                                <span>{t("PDF")}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ----------------- TAB: LEDGER HISTORY ----------------- */}
      {tab === 'ledger' && (() => {
        const handleDownloadPDF = () => {
          const totalDebit = ledger.filter(e => e.type === 'Debit').reduce((sum, e) => sum + (e.amount || 0), 0);
          const totalCredit = ledger.filter(e => e.type === 'Credit').reduce((sum, e) => sum + (e.amount || 0), 0);
          downloadLedgerPDF({
            partyType: 'Customer',
            partyDetails: customerProfile || { name: user?.name || 'Customer' },
            ledgerEntries: displayLedger,
            totals: { totalDebit, totalCredit, currentBalance: customerProfile?.currentBalance }
          });
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider">{t("My Comprehensive General Ledger")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("Posting transaction histories, payments, outstanding debts, and opening balances")}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  type="button"
                  onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
                >
                  <ArrowUpDown size={13} className="text-[#4F46E5]" />
                  <span>{t(sortOrder === 'newest' ? 'Newest First' : 'Oldest First')}</span>
                </button>
                <button 
                  type="button"
                  onClick={handleDownloadPDF}
                  className="flex items-center space-x-1.5 bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-500/10"
                >
                  <Download size={14} />
                  <span>{t("DOWNLOAD PDF")}</span>
                </button>
              </div>
            </div>

            <div id="printable-invoice" className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden p-6 text-xs text-slate-700 dark:text-slate-300">
              <div className="hidden print:block border-b-2 border-slate-300 pb-4 mb-5">
                <h2 className="text-lg font-black uppercase text-[#4F46E5] dark:text-indigo-400">{t("Lahore Sabzi & Fruit Mandi")}</h2>
                <h3 className="text-xs font-bold uppercase mt-1">{t("Personal Customer Account Statement Ledger")}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{t("Account Owner:")} <strong>{customerProfile?.name}</strong> {t("| Phone:")} {customerProfile?.phone}</p>
              </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                  <th className="py-3 px-2">{t("Date")}</th>
                  <th className="py-3 px-2">{t("Reference Posting / Memo Description")}</th>
                  <th className="py-3 px-2">{t("Type")}</th>
                  <th className="py-3 px-2 text-right">{t("Debit Cash (Purchases)")}</th>
                  <th className="py-3 px-2 text-right">{t("Credit Cash (Payments Paid)")}</th>
                  <th className="py-3 px-2 text-right">{t("Balance Post-Posting")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
                {displayLedger.map((l, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                    <td className="py-3.5 px-2">{l.date}</td>
                    <td className="py-3.5 px-2 italic font-semibold">{l.description}</td>
                    <td className="py-3.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${l.type === 'Debit' ? 'bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400' : 'bg-rose-500/10 text-rose-500'}`}>
                        {t(l.type)}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-right font-semibold">
                      {l.type === 'Debit' ? `Rs. ${l.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3.5 px-2 text-right font-semibold">
                      {l.type === 'Credit' ? `Rs. ${l.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3.5 px-2 text-right font-black text-[#1E293B] dark:text-slate-100">
                      {t("Rs.")} {l.balanceAfter.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* --- INVOICE VIEW MODAL --- */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 p-6 space-y-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-200 dark:border-slate-800/80 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider">{t("OFFICIAL TRADE TICKET")}</h3>
              <div className="flex items-center space-x-2">
                <button onClick={() => triggerPrint(`Invoice-${selectedInvoice.id || selectedInvoice._id}`)} className="flex items-center space-x-1 bg-[#4F46E5] hover:bg-[#4F46E5] text-white font-bold text-xs px-3 py-1.5 rounded-xl">
                  <Printer size={13} />
                  <span>{t("PRINT TICKET")}</span>
                </button>
                <button onClick={() => setSelectedInvoice(null)} className="text-slate-500 dark:text-slate-400 hover:text-white"><X size={18} /></button>
              </div>
            </div>

            <div
              id="printable-invoice"
              className={`p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl mx-auto shadow-sm ${
                invoiceSettings?.paperSize === 'Thermal 3-inch'
                  ? 'w-[76mm] max-w-[320px] font-mono text-[10px] space-y-3'
                  : invoiceSettings?.paperSize === 'A5'
                  ? 'w-[148mm] max-w-md text-[11px] space-y-4'
                  : 'w-full max-w-xl space-y-6 text-xs'
              }`}
            >
              {/* Header block */}
              <div className={`flex ${invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'flex-col items-center text-center' : 'justify-between items-start'} border-b-2 border-slate-200 pb-4`}>
                <div className={invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'space-y-1' : ''}>
                  {invoiceSettings?.companyLogo ? (
                    <img
                      src={invoiceSettings.companyLogo}
                      alt={t("Logo")}
                      className="h-10 object-contain mb-1.5"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex items-center space-x-2 mb-1">
                      <img 
                        src="/mandi_logo.jpg" 
                        alt={t("Mandi OS Logo")}
                        referrerPolicy="no-referrer"
                        className="h-9 w-auto object-contain rounded"
                      />
                      <h2 className="text-base font-black tracking-wider uppercase text-[#4F46E5]">
                        {invoiceSettings?.header || t('Mandi OS - Sabzi & Fruit Broker')}
                      </h2>
                    </div>
                  )}
                  {!invoiceSettings?.companyLogo && invoiceSettings?.header && (
                    <h2 className="text-sm font-black tracking-wide uppercase text-slate-800">
                      {invoiceSettings.header}
                    </h2>
                  )}
                  <p className="text-[10px] text-slate-500">{t("Shop 12, Fruit Market, Lahore, Pakistan")}</p>
                </div>
                <div className={invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'text-center mt-2 pt-2 border-t border-dashed border-slate-300 w-full' : 'text-right'}>
                  <p className="font-bold text-[10px]">
                    {t("No:")} {invoiceSettings?.invoicePrefix || 'MANDI'}-{selectedInvoice.id?.substring(0, 5) || selectedInvoice._id?.substring(0, 5)}
                  </p>
                  <p className="text-[10px] text-slate-500">{t("Date:")} {selectedInvoice.date}</p>
                </div>
              </div>

              <div className={`grid ${invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'grid-cols-1 space-y-2' : 'grid-cols-2 gap-4'} py-3 border-b border-slate-200 text-[10px]`}>
                <div>
                  <span className="text-slate-500 font-bold block text-[8px]">{t("Billed Customer:")}</span>
                  <p className="font-bold text-sm text-slate-800">{selectedInvoice.customerName}</p>
                </div>
                <div className={invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'text-left' : 'text-right'}>
                  <span className="text-slate-500 font-bold block text-[8px]">{t("Category:")}</span>
                  <p className="text-slate-600 text-[9px]">{t("Mandi Trade Account Buyer")}</p>
                </div>
              </div>

              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 font-bold uppercase text-slate-500 text-[8px]">
                    <th className="py-1">{t("Description")}</th>
                    <th className="py-1 text-right">{t("Qty")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-bold text-slate-800 text-[10px]">
                    <td className="py-2">{selectedInvoice.productName}</td>
                    <td className="py-2 text-right">{selectedInvoice.quantity}</td>
                  </tr>
                </tbody>
              </table>

              <div className="border-t border-slate-200 pt-3 flex justify-end">
                <div className={`${invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'w-full' : 'w-1/2'} space-y-1 text-right font-bold text-[10px]`}>
                  {(() => {
                    const totalPayable = Number(selectedInvoice.totalAmount) || 0;
                    return (
                      <>
                        <div className="flex justify-between border-t border-slate-300 pt-1.5 text-xs font-black text-slate-900">
                          <span>{t("Total Cost Payable")}</span>
                          <span>{t("Rs.")} {totalPayable.toLocaleString()}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Terms and Conditions */}
              {invoiceSettings?.termsAndConditions && (
                <div className="border-t border-slate-200 pt-3 text-[9px] text-slate-500 text-left">
                  <span className="font-bold block uppercase text-[8px]">{t("Terms & Conditions:")}</span>
                  <p className="whitespace-pre-line leading-normal text-slate-600">{invoiceSettings.termsAndConditions}</p>
                </div>
              )}

              {/* Signature Block */}
              <div className="flex justify-between items-end pt-5 border-t border-slate-200 text-[9px]">
                <div className="text-slate-400 text-[8px]">
                  {t("Format:")} {invoiceSettings?.paperSize || 'A4 Standard'}
                </div>
                <div className="text-right">
                  <div className="w-24 border-b border-slate-300 mx-auto"></div>
                  <p className="text-[9px] text-slate-500 mt-1.5 font-bold">
                    {invoiceSettings?.signature || t('Authorized Signatory')}
                  </p>
                </div>
              </div>

              {/* Footer Note */}
              <div className="border-t border-slate-100 pt-3 text-center text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
                {invoiceSettings?.footer || t('Thank you for trading at Lahore Sabzi & Fruit Mandi!')}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setSelectedInvoice(null)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold">{t("Close Invoice")}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- DAY-WISE PRODUCTS BREAKDOWN MODAL --- */}
      {selectedDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400 rounded-xl">
                  <Calendar size={22} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black uppercase text-slate-800 dark:text-slate-100">
                      {t("Day Wise Purchases —")} {selectedDayModal.date}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400">
                      {selectedDayModal.itemsCount} {t(selectedDayModal.itemsCount === 1 ? 'Item' : 'Items')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t("Visual product breakdown and invoice records for")} {customerProfile?.name || t('Customer')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => downloadSingleDayPurchasePDF({
                    customerDetails: customerProfile,
                    dayData: selectedDayModal
                  })}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
                >
                  <Download size={14} />
                  <span>{t("Download Day PDF")}</span>
                </button>
                <button
                  onClick={() => setSelectedDayModal(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Daily Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{t("Produces Bought")}</span>
                  <span className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
                    {selectedDayModal.itemsCount} {t("Lines")}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30">
                  <span className="text-[10px] font-bold uppercase text-blue-500 block">{t("Total Quantity")}</span>
                  <span className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5 block">
                    {selectedDayModal.totalQuantity.toLocaleString()} {t("Units")}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30">
                  <span className="text-[10px] font-bold uppercase text-emerald-500 block">{t("Day Total Sum")}</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    {t("Rs.")} {selectedDayModal.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Product Breakdown Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center space-x-1.5">
                  <ShoppingBag size={14} className="text-[#4F46E5]" />
                  <span>{t("Purchased Products Visual Breakdown")}</span>
                </h4>

                <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold bg-slate-50/50 dark:bg-slate-900/50">
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">{t("Product / Produce")}</th>
                          <th className="py-3 px-4 text-right">{t("Quantity")}</th>
                          <th className="py-3 px-4 text-right">{t("Total Cost Payable")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/30 text-slate-700 dark:text-slate-300">
                        {selectedDayModal.items.map((item, idx) => (
                          <tr key={item.id || item._id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                            <td className="py-3.5 px-4 font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                {item.productName}
                              </div>
                              {item.lotNumber && (
                                <span className="text-[10px] text-slate-400 font-mono">{t("Lot #")}{item.lotNumber}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-extrabold text-blue-500">{item.quantity}</td>
                            <td className="py-3.5 px-4 text-right font-black text-[#4F46E5] dark:text-indigo-400 text-sm">
                              {t("Rs.")} {(item.totalAmount || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t("Total")} {selectedDayModal.itemsCount} {t("purchase records on")} {selectedDayModal.date}
              </span>
              <button
                onClick={() => setSelectedDayModal(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
              >
                {t("Close Window")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
