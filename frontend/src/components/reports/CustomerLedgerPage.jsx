import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext';
import { exportToCSV } from '../../utils/navigation';
import { downloadLedgerPDF } from '../../utils/pdfExport';
import { Download, Filter, Search, ArrowLeft, Calendar, User, DollarSign, RefreshCw, ArrowUpDown, ArrowDown, ArrowUp, FileText, Printer } from 'lucide-react';
import PrintReportHeader from '../common/PrintReportHeader.jsx';

export default function CustomerLedgerPage() {
  const { t } = useLanguage();
  const searchParams = new URLSearchParams(window.location.search);
  const initialPartyId = searchParams.get('partyId') || '';

  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialPartyId);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [postingType, setPostingType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' (Descending) | 'oldest' (Ascending)

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerLedger(selectedCustomerId);
    } else {
      setLoading(false);
    }
  }, [selectedCustomerId]);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      const list = res.data || [];
      setCustomers(list);
      if (!selectedCustomerId && list.length > 0) {
        setSelectedCustomerId(list[0].id || list[0]._id);
      } else if (selectedCustomerId) {
        const found = list.find(c => (c.id || c._id) === selectedCustomerId);
        if (found) {
          setCustomerDetails(found);
        }
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    }
  };

  const fetchCustomerLedger = async (custId) => {
    try {
      setLoading(true);
      const [custRes, reportRes] = await Promise.all([
        api.get(`/customers/${custId}`).catch(() => null),
        api.get(`/reports?type=custom&partyId=${custId}`).catch(() => ({ data: { customerLedger: [] } }))
      ]);

      if (custRes?.data && typeof custRes.data === 'object' && custRes.data.name) {
        setCustomerDetails(custRes.data);
      } else {
        const found = customers.find(c => (c.id || c._id) === custId);
        setCustomerDetails(found || null);
      }

      const allLedger = reportRes.data?.customerLedger || [];
      // Filter for this customer specifically if returned mixed
      const partyLedger = allLedger.filter(l => l.partyId === custId || !l.partyId);
      setLedgerEntries(partyLedger);
    } catch (err) {
      console.error('Failed to fetch customer ledger', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Ledger entries
  const filteredLedger = ledgerEntries.filter(entry => {
    if (postingType !== 'All' && entry.type !== postingType) return false;
    if (startDate && entry.date < startDate) return false;
    if (endDate && entry.date > endDate) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const descMatch = entry.description?.toLowerCase().includes(term);
      const typeMatch = entry.type?.toLowerCase().includes(term);
      const amtMatch = ('' + entry.amount).includes(term);
      if (!descMatch && !typeMatch && !amtMatch) return false;
    }
    return true;
  });

  // Sorted Ledger entries for display & export according to selected sortOrder
  const displayLedger = [...filteredLedger].sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.createdAt || 0).getTime();
    if (dateA !== dateB) {
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    }
    const idxA = ledgerEntries.indexOf(a);
    const idxB = ledgerEntries.indexOf(b);
    return sortOrder === 'newest' ? idxB - idxA : idxA - idxB;
  });

  // Calculate totals (invariant under sorting)
  const totalDebit = filteredLedger.filter(e => e.type === 'Debit').reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalCredit = filteredLedger.filter(e => e.type === 'Credit').reduce((sum, e) => sum + (e.amount || 0), 0);
  const currentBalance = customerDetails?.currentBalance !== undefined 
    ? customerDetails.currentBalance 
    : (ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balanceAfter : 0);

  const handleDownloadPDF = () => {
    downloadLedgerPDF({
      partyType: 'Customer',
      partyDetails: customerDetails || { name: 'Customer Portfolio' },
      ledgerEntries: displayLedger,
      totals: { totalDebit, totalCredit, currentBalance }
    });
  };

  const handleExportCSV = () => {
    const custName = customerDetails?.name || 'Customer';
    const headers = ['Date', 'Description / Transaction Reference', 'Posting Type', 'Debit Cash (Dr)', 'Credit Cash (Cr)', 'Balance After'];
    const rows = displayLedger.map(l => [
      l.date,
      l.description || '',
      l.type,
      l.type === 'Debit' ? l.amount : 0,
      l.type === 'Credit' ? l.amount : 0,
      l.balanceAfter
    ]);
    exportToCSV(`Customer_Ledger_${custName.replace(/\s+/g, '_')}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4F46E5] dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">{t("Dedicated Report Page")}</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">{t("Customer Portfolio Ledger")}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {customerDetails ? `${customerDetails.name} — ${t('General Statement Ledger')}` : t('Customer General Ledger')}
          </h1>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <button
            onClick={() => fetchCustomerLedger(selectedCustomerId)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all"
            title={t("Refresh Ledger")}
          >
            <RefreshCw size={16} />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
          >
            <Download size={14} />
            <span>{t("Export CSV")}</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
          >
            <Download size={14} />
            <span>{t("PDF")}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Printer size={14} />
            <span>{t("Print Ledger")}</span>
          </button>
        </div>
      </div>

      {/* Printable Letterhead & Account Summary */}
      <PrintReportHeader
        title={t("CUSTOMER ACCOUNT STATEMENT / KHATA")}
        period={`${startDate || t('All-Time')} ${t('to')} ${endDate || t('Present')}`}
        filters={[
          { label: 'Customer', value: `${customerDetails?.name || 'General Customer'}${customerDetails?.phone ? ` (${customerDetails.phone})` : ''}` },
          ...(postingType !== 'All' ? [{ label: 'Posting Type', value: postingType }] : [])
        ]}
        summaryMetrics={[
          { label: 'Total Purchases (Debit)', value: `Rs. ${totalDebit.toLocaleString()}` },
          { label: 'Total Payments (Credit)', value: `Rs. ${totalCredit.toLocaleString()}` },
          {
            label: 'Closing Balance',
            value: `Rs. ${Math.abs(currentBalance).toLocaleString()} ${currentBalance > 0 ? '(Dr - Receivable)' : currentBalance < 0 ? '(Cr - Advance)' : '(Nil)'}`
          }
        ]}
      />

      {/* Customer Selection & Summary Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 print:hidden">
        {/* Customer Select Dropdown */}
        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <User size={13} />{t("Select Customer Portfolio")}</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#4F46E5]"
          >
            <option value="">{t("-- Choose Customer --")}</option>
            {customers.map(c => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {c.name} ({c.phone || t('No phone')}{t(") - Bal: Rs.")}{' '}{c.currentBalance?.toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {/* Total Debit (Purchases) */}
        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("Total Sales Billed (Debit)")}</span>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">Rs. {totalDebit.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">{t("Sum of filtered purchase vouchers")}</p>
        </div>

        {/* Total Credit (Payments) */}
        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("Total Payments Received (Credit)")}</span>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">Rs. {totalCredit.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">{t("Sum of cash & bank receipts")}</p>
        </div>

        {/* Current Net Balance */}
        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("Net Account Balance")}</span>
          <p className={`text-xl font-black ${currentBalance > 0 ? 'text-indigo-600 dark:text-indigo-400' : currentBalance < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
            Rs. {Math.abs(currentBalance).toLocaleString()}
            <span className="text-xs font-bold ml-1">{currentBalance > 0 ? t('(Receivable)') : currentBalance < 0 ? t('(Advance / Credit)') : ''}</span>
          </p>
          <p className="text-[10px] text-slate-400">{t("Current closing ledger status")}</p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Filter size={15} className="text-[#4F46E5]" />
          <span>{t("Ledger Statement Filters & Range")}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t("Start Date")}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-semibold outline-none focus:border-[#4F46E5]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t("End Date")}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-semibold outline-none focus:border-[#4F46E5]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t("Posting Type")}</label>
            <select
              value={postingType}
              onChange={(e) => setPostingType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#4F46E5]"
            >
              <option value="All">{t("All Transactions (Debit & Credit)")}</option>
              <option value="Debit">{t("Debit (Sales Purchases Only)")}</option>
              <option value="Credit">{t("Credit (Payments Received Only)")}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t("Transaction Sort Order")}</label>
            <div className="flex bg-slate-100 dark:bg-[#0F172A] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSortOrder('newest')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                  sortOrder === 'newest'
                    ? 'bg-[#4F46E5] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ArrowDown size={12} />
                <span>{t("Newest First")}</span>
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('oldest')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                  sortOrder === 'oldest'
                    ? 'bg-[#4F46E5] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ArrowUp size={12} />
                <span>{t("Oldest First")}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t("Search Keywords")}</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("Search voucher description...")}
                className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 font-semibold outline-none focus:border-[#4F46E5]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t("Statement Posting Entries (")}{displayLedger.length})
            </h3>
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[#4F46E5] dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40 text-[10px] font-bold transition-all hover:bg-indigo-100"
            >
              <ArrowUpDown size={11} />
              <span>{t(sortOrder === 'newest' ? 'Sorted: Newest First' : 'Sorted: Oldest First')}</span>
            </button>
          </div>
          {(startDate || endDate || postingType !== 'All' || searchTerm) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setPostingType('All'); setSearchTerm(''); }}
              className="text-[10px] font-bold text-[#4F46E5] hover:underline"
            >{t("Clear Filters")}</button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0F172A]/50 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 uppercase font-black tracking-wider">
                <th className="py-3.5 px-4">{t("Date")}</th>
                <th className="py-3.5 px-4">{t("Transaction Entry / Reference Description")}</th>
                <th className="py-3.5 px-4">{t("Posting Type")}</th>
                <th className="py-3.5 px-4 text-right">{t("Debit Cash (Dr)")}</th>
                <th className="py-3.5 px-4 text-right">{t("Credit Cash (Cr)")}</th>
                <th className="py-3.5 px-4 text-right">{t("Balance After")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />{t("Fetching Customer Ledger Entries...")}</td>
                </tr>
              ) : displayLedger.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 italic">{t("No ledger transaction entries found matching your search.")}</td>
                </tr>
              ) : (
                displayLedger.map((l, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono">{l.date}</td>
                    <td className="py-3.5 px-4">{l.description}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        l.type === 'Debit' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {t(l.type)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {l.type === 'Debit' ? `Rs. ${l.amount?.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {l.type === 'Credit' ? `Rs. ${l.amount?.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-[#4F46E5] dark:text-indigo-400">
                      Rs. {l.balanceAfter?.toLocaleString()}
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
}
