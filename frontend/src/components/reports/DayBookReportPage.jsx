import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api.js';
import { useLanguage } from '../../context/LanguageContext';
import {
  BookOpen,
  ArrowLeft,
  Calendar,
  Filter,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  DollarSign,
  Boxes,
  Percent,
  Receipt,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  Coins
} from 'lucide-react';
import PrintReportHeader from '../common/PrintReportHeader.jsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawPdfReportHeader, getBusinessProfileForReport, downloadLocalizedPdf } from '../../utils/pdfExport.js';

// Helper function for local date formatting to avoid UTC conversion shifts
const formatLocalDate = (d = new Date()) => {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DayBookReportPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const todayStr = formatLocalDate(new Date());
  const [datePreset, setDatePreset] = useState('Today');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Filter States
  const [activeTab, setActiveTab] = useState('t-account'); // 't-account' | 'journal' | 'summary'
  const [transactionType, setTransactionType] = useState('All');
  const [paymentMode, setPaymentMode] = useState('All');
  const [partyType, setPartyType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Data States
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sorting for journal table
  const [sortKey, setSortKey] = useState('time');
  const [sortOrder, setSortOrder] = useState('asc');

  // Handle Preset Changes
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (preset === 'Today') {
      start = new Date(now);
      end = new Date(now);
    } else if (preset === 'Yesterday') {
      start.setDate(now.getDate() - 1);
      end.setDate(now.getDate() - 1);
    } else if (preset === 'This Week') {
      // Current week from Monday to Sunday
      const day = now.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + 6);
    } else if (preset === 'This Month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'This Year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }

    setStartDate(formatLocalDate(start));
    setEndDate(formatLocalDate(end));
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    handlePresetChange('Today');
    setTransactionType('All');
    setPaymentMode('All');
    setPartyType('All');
    setSearchTerm('');
  };

  const isAnyFilterActive = transactionType !== 'All' || paymentMode !== 'All' || partyType !== 'All' || searchTerm.trim() !== '' || datePreset !== 'Today';

  // Fetch Report Data
  const fetchDayBookData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        reportId: 'day-book',
        startDate,
        endDate,
        transactionType,
        paymentMode,
        partyType
      };

      const res = await api.get('/reports/data', { params });
      setReportData(res.data || null);
    } catch (err) {
      console.error('Error fetching day book report:', err);
      setError(err.response?.data?.error || 'Failed to load Day Book data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayBookData();
  }, [startDate, endDate, transactionType, paymentMode, partyType]);

  const summary = reportData?.summary || {
    openingBalance: 0,
    totalInflows: 0,
    totalOutflows: 0,
    closingBalance: 0,
    netCashFlow: 0,
    totalSalesVolume: 0,
    totalArrivalVolume: 0,
    totalSalesAmount: 0,
    totalCommissionEarned: 0,
    totalShopExpenses: 0,
    totalReturnedVolume: 0,
    totalReturnedAmount: 0,
    totalReturnedCount: 0
  };

  const rawRows = reportData?.rows || [];

  // Filtered rows for Search
  const filteredRows = useMemo(() => {
    if (!searchTerm) return rawRows;
    const term = searchTerm.toLowerCase();
    return rawRows.filter(r => {
      const party = (r.partyName || '').toLowerCase();
      const item = (r.item || '').toLowerCase();
      const type = (r.type || '').toLowerCase();
      const cat = (r.category || '').toLowerCase();
      const pMode = (r.paymentMethod || '').toLowerCase();
      return party.includes(term) || item.includes(term) || type.includes(term) || cat.includes(term) || pMode.includes(term);
    });
  }, [rawRows, searchTerm]);

  // Sorted Rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortKey, sortOrder]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // T-Account split: Inflows vs Outflows
  const inflowsList = useMemo(() => {
    return filteredRows.filter(r => r.direction === 'INFLOW' || (r.isCash && r.credit > 0));
  }, [filteredRows]);

  const outflowsList = useMemo(() => {
    return filteredRows.filter(r => r.direction === 'OUTFLOW' || (r.isCash && r.debit > 0));
  }, [filteredRows]);

  // Export CSV
  const handleExportCSV = () => {
    if (sortedRows.length === 0) return;
    const headers = ['Time/Date', 'Party / Entity', 'Type', 'Particulars', 'Payment Mode', 'Qty', 'Debit (Rs)', 'Credit (Rs)', 'Running Cash Balance (Rs)'];
    const csvRows = [headers.join(',')];

    sortedRows.forEach(row => {
      const values = [
        `"${row.time || row.date || ''}"`,
        `"${row.partyName || ''}"`,
        `"${row.type || ''}"`,
        `"${(row.item || '').replace(/"/g, '""')}"`,
        `"${row.paymentMethod || ''}"`,
        row.quantity || 0,
        row.debit || 0,
        row.credit || 0,
        row.runningBalance || 0
      ];
      csvRows.push(values.join(','));
    });

    const csvString = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvString);
    link.setAttribute('download', `DayBook_Roznamcha_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF
  const handleExportPDF = async () => {
    const businessProfile = await getBusinessProfileForReport();
    const doc = new jsPDF('landscape');
    const headerBottom = drawPdfReportHeader(doc, {
      title: 'MANDI OS — DAILY ROZNAMCHA / DAY BOOK REPORT',
      period: `${startDate} to ${endDate}`,
      businessProfile
    });

    // Summary Box
    const summaryTop = headerBottom + 2;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, summaryTop, 268, 18, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Opening Till: Rs. ${summary.openingBalance.toLocaleString()}`, 20, summaryTop + 10);
    doc.text(`Total Inflows (Jama): Rs. ${summary.totalInflows.toLocaleString()}`, 80, summaryTop + 10);
    doc.text(`Total Outflows (Banam): Rs. ${summary.totalOutflows.toLocaleString()}`, 150, summaryTop + 10);
    doc.text(`Closing Till: Rs. ${summary.closingBalance.toLocaleString()}`, 220, summaryTop + 10);

    const tableData = sortedRows.map(r => [
      r.time || r.date,
      r.partyName,
      r.type,
      r.item,
      r.paymentMethod,
      r.quantity > 0 ? r.quantity : '-',
      r.debit > 0 ? `Rs. ${r.debit.toLocaleString()}` : '-',
      r.credit > 0 ? `Rs. ${r.credit.toLocaleString()}` : '-',
      `Rs. ${r.runningBalance.toLocaleString()}`
    ]);

    if (await downloadLocalizedPdf({
      title: t('MANDI OS — DAILY ROZNAMCHA / DAY BOOK REPORT'),
      period: `${startDate} ${t('to')} ${endDate}`,
      summary: [
        ['Opening Till', `Rs. ${summary.openingBalance.toLocaleString()}`],
        ['Total Inflows (Jama)', `Rs. ${summary.totalInflows.toLocaleString()}`],
        ['Total Outflows (Banam)', `Rs. ${summary.totalOutflows.toLocaleString()}`],
        ['Closing Till', `Rs. ${summary.closingBalance.toLocaleString()}`],
      ],
      columns: ['Time', 'Party / Source', 'Type', 'Particulars', 'Mode', 'Qty', 'Debit / Banam', 'Credit / Jama', 'Cash Balance'],
      rows: tableData,
      businessProfile,
    })) return;

    autoTable(doc, {
      startY: summaryTop + 22,
      margin: { top: summaryTop + 22, bottom: 12 },
      head: [['Time', 'Party / Source', 'Type', 'Particulars', 'Mode', 'Qty', 'Debit / Banam', 'Credit / Jama', 'Cash Balance']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 2.5 },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawPdfReportHeader(doc, {
          title: 'MANDI OS — DAILY ROZNAMCHA / DAY BOOK REPORT',
          period: `${startDate} to ${endDate}`,
          businessProfile
        });
      }
    });

    doc.save(`DayBook_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto print:p-0 print:m-0 print:space-y-4">
      {/* ----------------- TOP NAVIGATION & TITLE ----------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t("Day Book / روزنامچہ (Roznamcha)")}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{t("Daily Financial Journal")}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("Comprehensive double-entry cash till balance, customer recoveries, payouts, daily shop expenses, and trade auctions.")}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchDayBookData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t("Refresh")}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t("Excel / CSV")}</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t("PDF Export")}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-emerald-600 dark:text-white hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t("Print Roznamcha")}</span>
          </button>
        </div>
      </div>

      {/* ----------------- DATE RANGE & PRESET FILTER BAR ----------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />{t("Period:")}</span>
            {['Today', 'Yesterday', 'This Week', 'This Month'].map(preset => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  datePreset === preset
                    ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">{t("From:")}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('Custom');
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('Custom');
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- 5 CORE SUMMARY KPI CARDS ----------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 print:hidden">
        {/* Card 1: Opening Till */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">{t("Opening Till (شروع کا کیش)")}</span>
          <h3 className={`text-xl font-black mt-1 ${summary.openingBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
            Rs. {summary.openingBalance.toLocaleString()}
          </h3>
          <span className="text-[10px] text-slate-400 mt-1 block">As of {startDate}</span>
        </div>

        {/* Card 2: Inflows / Jama */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{t("Total Inflows (جمع / وصولیاں)")}</span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg"><ArrowDownLeft size={14} /></div>
          </div>
          <h3 className="text-xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
            + Rs. {summary.totalInflows.toLocaleString()}
          </h3>
          <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-1 block">
            {inflowsList.length}{t("cash & recovery credits")}</span>
        </div>

        {/* Card 3: Outflows / Banam */}
        <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/40 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400">{t("Total Outflows (بنام / ادائیگیاں)")}</span>
            <div className="p-1.5 bg-rose-500/10 text-rose-600 rounded-lg"><ArrowUpRight size={14} /></div>
          </div>
          <h3 className="text-xl font-black mt-1 text-rose-600 dark:text-rose-400">
            - Rs. {summary.totalOutflows.toLocaleString()}
          </h3>
          <span className="text-[10px] text-rose-600/70 dark:text-rose-400/70 mt-1 block">
            {outflowsList.length}{t("payouts & shop expenses")}</span>
        </div>

        {/* Card 4: Net Closing Till */}
        <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/40 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">{t("Net Closing Till (باقی کیش)")}</span>
            <div className="p-1.5 bg-indigo-500/10 text-indigo-600 rounded-lg"><Wallet size={14} /></div>
          </div>
          <h3 className="text-xl font-black mt-1 text-indigo-600 dark:text-indigo-400">
            Rs. {summary.closingBalance.toLocaleString()}
          </h3>
          <span className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-1 block">{t("Net flow:")}{summary.netCashFlow >= 0 ? `+Rs. ${summary.netCashFlow.toLocaleString()}` : `-Rs. ${Math.abs(summary.netCashFlow).toLocaleString()}`}
          </span>
        </div>

        {/* Card 5: Commission Earned */}
        <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">{t("Broker Commission (کمیشن)")}</span>
            <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg"><Percent size={14} /></div>
          </div>
          <h3 className="text-xl font-black mt-1 text-amber-600 dark:text-amber-400">
            Rs. {summary.totalCommissionEarned.toLocaleString()}
          </h3>
          <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1 block">{t("From")}{summary.totalSalesVolume}{t("sales units")}</span>
        </div>
      </div>

      {/* ----------------- INTERACTIVE VIEW TABS ----------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden print:hidden">
        {/* Tab Headers & Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('t-account')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 't-account'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >{t("📖 T-Account Cash Book (دو طرفہ روزنامچہ)")}</button>
            <button
              onClick={() => setActiveTab('journal')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'journal'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >{t("📋 Master Chronological Journal (")}{rawRows.length})
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'summary'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >{t("📊 Daily Mandi Analytics")}</button>
          </div>

          {/* Mandi Standard Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. Universal Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t("Search party, lot, or item...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44 sm:w-52"
              />
            </div>

            {/* 2. Transaction Nature Filter */}
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              title={t("Filter by Transaction Nature")}
            >
              <option value="All">{t("All Transactions (تمام اندراجات)")}</option>
              <option value="Cash Flow Only / Rokar (نقد بہاؤ)">{t("🟢 Cash Flow Only / Rokar (نقد روکڑ)")}</option>
              <option value="Produce Returns (واپسی مال)">{t("↩️ Produce Returns (واپسی مال)")}</option>
              <option value="Customer Receipts (وصولیاں)">{t("📥 Customer Receipts (وصولیاں)")}</option>
              <option value="Supplier Payments (ادائیگیاں)">{t("📤 Beopari/Grower Payments (ادائیگیاں)")}</option>
              <option value="Walk-in Cash Sales (نقد فروخت)">{t("🛒 Walk-In Cash Sales (نقد فروخت)")}</option>
              <option value="Credit Invoices (ادھار بل)">{t("📑 Credit Invoices (ادھار بل)")}</option>
              <option value="Shop Expenses (اخراجات)">{t("💸 Shop Expenses (دکان خرچہ)")}</option>
              <option value="Consignment Arrivals (آمد مال)">{t("📦 Consignment Arrivals (آمد مال)")}</option>
            </select>

            {/* 3. Payment Mode / Account Filter */}
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              title={t("Filter by Payment Mode")}
            >
              <option value="All">{t("All Modes (تمام ذرائع)")}</option>
              <option value="Cash Till (نقد روکڑ)">{t("💵 Cash Till (نقد روکڑ)")}</option>
              <option value="Bank Account">{t("🏦 Bank Account (بینک)")}</option>
              <option value="Online / Wallet">{t("📱 Online / Wallet (ایزی پیسہ/جاز کیش)")}</option>
              <option value="Cheque">{t("📜 Cheque (چیک)")}</option>
              <option value="Credit / Udhar">{t("⏳ Credit / Udhar (ادھار)")}</option>
            </select>

            {/* 4. Party / Entity Type Filter */}
            <select
              value={partyType}
              onChange={(e) => setPartyType(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              title={t("Filter by Party Entity")}
            >
              <option value="All">{t("All Entities (تمام فریق)")}</option>
              <option value="Customer">{t("👤 Customers / Buyers (خریدار)")}</option>
              <option value="Supplier">{t("🚜 Beopari/Growers / Farmers (زمیندار/بیوپاری)")}</option>
              <option value="Expense">{t("🏢 Shop & Staff Expenses (دکان و عملہ)")}</option>
              <option value="Walk-In">{t("🚶 Walk-In Buyers (عام گاہک)")}</option>
            </select>

            {/* Reset Filters Action */}
            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 transition-colors"
                title={t("Reset all filters")}
              >{t("Clear Filters")}</button>
            )}
          </div>
        </div>

        {/* ----------------- TAB 1: T-ACCOUNT TWO-COLUMN VIEW ----------------- */}
        {activeTab === 't-account' && (
          <div className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* LEFT COLUMN: JAMA / INFLOWS */}
              <div className="border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-800/40">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">{t("JAMA / جمع (INFLOWS & RECEIPTS)")}</h3>
                  </div>
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">{t("Total: Rs.")}{summary.totalInflows.toLocaleString()}
                  </span>
                </div>

                {inflowsList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8 italic">{t("No cash inflows or receipts recorded for this period.")}</p>
                ) : (
                  <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                    {inflowsList.map((row, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/70 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-emerald-300 transition-colors"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {row.partyName}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                              {t(row.type)}
                            </span>
                            <span className="text-[10px] text-slate-400">{t(row.paymentMethod)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{row.item}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{row.time}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            +Rs. {(row.credit || row.amount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtotal Footer */}
                <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800/40 flex justify-between items-center text-xs font-bold">
                  <span className="text-emerald-900 dark:text-emerald-300">{t("Total Jama + Opening (")}{summary.openingBalance >= 0 ? '+' : ''}{summary.openingBalance.toLocaleString()})</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-black">
                    Rs. {(summary.openingBalance + summary.totalInflows).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* RIGHT COLUMN: BANAM / OUTFLOWS */}
              <div className="border border-rose-200 dark:border-rose-900/40 rounded-2xl p-4 bg-rose-50/20 dark:bg-rose-950/10 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-rose-200 dark:border-rose-800/40">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500" />
                    <h3 className="text-sm font-black text-rose-900 dark:text-rose-300 uppercase tracking-wider">{t("BANAM / بنام (OUTFLOWS & EXPENSES)")}</h3>
                  </div>
                  <span className="text-xs font-black text-rose-700 dark:text-rose-400">{t("Total: Rs.")}{summary.totalOutflows.toLocaleString()}
                  </span>
                </div>

                {outflowsList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8 italic">{t("No cash outflows or payouts recorded for this period.")}</p>
                ) : (
                  <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                    {outflowsList.map((row, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/70 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-rose-300 transition-colors"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {row.partyName}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                              {t(row.type)}
                            </span>
                            <span className="text-[10px] text-slate-400">{t(row.paymentMethod)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{row.item}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{row.time}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                            -Rs. {(row.debit || row.amount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtotal Footer */}
                <div className="pt-3 border-t border-rose-200 dark:border-rose-800/40 flex justify-between items-center text-xs font-bold">
                  <span className="text-rose-900 dark:text-rose-300">{t("Total Banam + Closing Till (")}{summary.closingBalance.toLocaleString()})</span>
                  <span className="text-rose-700 dark:text-rose-400 font-black">
                    Rs. {(summary.totalOutflows + summary.closingBalance).toLocaleString()}
                  </span>
                </div>
              </div>

            </div>

            {/* Reconciliation Strip */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">{t("Mandi Cash Till Balancing Equation:")}</span>
                <span className="text-slate-300 font-mono">{t("Opening (")}{summary.openingBalance}{t(") + Jama (")}{summary.totalInflows}{t(") - Banam (")}{summary.totalOutflows}{t(") = Closing (")}{summary.closingBalance})</span>
              </div>
              <div className="text-emerald-400 font-black text-sm">{t("Till Reconciled: Rs.")}{summary.closingBalance.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB 2: MASTER CHRONOLOGICAL JOURNAL ----------------- */}
        {activeTab === 'journal' && (
          <div className="p-4 space-y-4">
            {sortedRows.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{t("No transactions match your current search or filters.")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white dark:bg-slate-800 select-none">
                      <th onClick={() => handleSort('time')} className="p-3 font-semibold uppercase tracking-wider text-[11px] cursor-pointer hover:bg-slate-800">{t("Time / Date")}{sortKey === 'time' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th onClick={() => handleSort('partyName')} className="p-3 font-semibold uppercase tracking-wider text-[11px] cursor-pointer hover:bg-slate-800">{t("Party / Source")}{sortKey === 'partyName' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-center">{t("Type")}</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px]">{t("Particulars")}</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-center">{t("Mode")}</th>
                      <th onClick={() => handleSort('quantity')} className="p-3 font-semibold uppercase tracking-wider text-[11px] text-right cursor-pointer hover:bg-slate-800">{t("Qty")}{sortKey === 'quantity' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th onClick={() => handleSort('debit')} className="p-3 font-semibold uppercase tracking-wider text-[11px] text-right cursor-pointer hover:bg-slate-800 text-rose-300">{t("Debit / بنام (Rs)")}{sortKey === 'debit' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th onClick={() => handleSort('credit')} className="p-3 font-semibold uppercase tracking-wider text-[11px] text-right cursor-pointer hover:bg-slate-800 text-emerald-300">{t("Credit / جمع (Rs)")}{sortKey === 'credit' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-right">{t("Cash Balance")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {sortedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors font-sans">
                        <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {row.time}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {row.partyName}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.type === 'Receipt' || row.type === 'Cash Sale'
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : row.type === 'Payment' || row.type === 'Expense'
                              ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : row.type === 'Produce Return'
                              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              : 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          }`}>
                            {row.type === 'Produce Return' ? `↩ ${t('Produce Return')}` : t(row.type)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 text-xs">
                          {row.type === 'Produce Return' ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white">{row.productName || 'Produce'}</span>
                                {row.produceCondition && (
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    row.produceCondition === 'Damaged' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' :
                                    row.produceCondition === 'Spoiled' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' :
                                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  }`}>
                                    {row.produceCondition}
                                  </span>
                                )}
                                {row.returnNumber && (
                                  <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                    {row.returnNumber}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{row.item}</p>
                            </div>
                          ) : (
                            row.item
                          )}
                        </td>
                        <td className="p-3 text-center text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                          {t(row.paymentMethod)}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                          {row.quantity > 0 ? row.quantity.toLocaleString() : '-'}
                        </td>
                        <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">
                          {row.debit > 0 ? `Rs. ${row.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {row.credit > 0 ? `Rs. ${row.credit.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                          Rs. {row.runningBalance.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                      <td colSpan={5} className="p-3 text-left">{t("TOTALS FOR FILTERED ROWS")}</td>
                      <td className="p-3 text-right">{sortedRows.reduce((s, r) => s + (r.quantity || 0), 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-rose-600">Rs. {sortedRows.reduce((s, r) => s + (r.debit || 0), 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-600">Rs. {sortedRows.reduce((s, r) => s + (r.credit || 0), 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-black">Rs. {summary.closingBalance.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 3: DAILY MANDI TRADING & ANALYTICS ----------------- */}
        {activeTab === 'summary' && (
          <div className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Inflow vs Outflow Trend */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-500" />{t("Daily Cash Flow Dynamics (Inflows vs Outflows)")}</h3>
                <div className="h-64 w-full">
                  {reportData?.chartData && reportData.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={11} />
                        <YAxis stroke="#888888" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#ffffff', borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="Inflows" fill="#10b981" radius={[4, 4, 0, 0]} name="Inflows (Jama)" />
                        <Bar dataKey="Outflows" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Outflows (Banam)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-xs text-slate-400 py-20">{t("No trend data available for single moment query.")}</p>
                  )}
                </div>
              </div>

              {/* Operational Metrics Grid */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t("Consignment & Auction Operations Summary")}</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block font-semibold">{t("Total Stock Arrived")}</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
                        {summary.totalArrivalVolume.toLocaleString()}{t("crates")}</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block font-semibold">{t("Total Stock Auctioned / Sold")}</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
                        {summary.totalSalesVolume.toLocaleString()}{t("units")}</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block font-semibold">{t("Sales Turnover Value")}</span>
                      <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                        Rs. {summary.totalSalesAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block font-semibold">{t("Total Shop Kharcha / Expenses")}</span>
                      <span className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1 block">
                        Rs. {summary.totalShopExpenses.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 block font-semibold">{t("Produce Returns (واپسی مال)")}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                          {summary.totalReturnedCount || 0}{t("Return Vouchers")}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                          {summary.totalReturnedVolume?.toLocaleString() || 0}{t("crates returned")}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{t("(Value: Rs.")}{summary.totalReturnedAmount?.toLocaleString() || 0})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mandi Rules Note */}
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />{t("Mandi Commission Balancing Protocol")}</p>
                  <p className="text-[11px] leading-relaxed">{t("Physical consignment arrivals and credit invoices generate future settlement payables/receivables, while cash sales and cashier vouchers directly adjust the running till.")}</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ----------------- PRINTABLE MANDI STATEMENT (A4 ROZNAMCHA) ----------------- */}
      <div className="hidden print:block space-y-4 text-black bg-white">
        <PrintReportHeader
          title={t("DAILY ROZNAMCHA / DAY BOOK STATEMENT")}
          period={`${startDate} ${t('to')} ${endDate}`}
          filters={[
            ...(transactionType !== 'All' ? [{ label: 'Type', value: transactionType }] : []),
            ...(paymentMode !== 'All' ? [{ label: 'Payment Mode', value: paymentMode }] : []),
            ...(partyType !== 'All' ? [{ label: 'Party Type', value: partyType }] : [])
          ]}
          summaryMetrics={[
            { label: 'Opening Till', value: `Rs. ${summary.openingBalance.toLocaleString()}` },
            { label: 'Total Jama (Inflows)', value: `Rs. ${summary.totalInflows.toLocaleString()}` },
            { label: 'Total Banam (Outflows)', value: `Rs. ${summary.totalOutflows.toLocaleString()}` },
            { label: 'Closing Till Balance', value: `Rs. ${summary.closingBalance.toLocaleString()}` }
          ]}
        />

        {/* Printable Transactions */}
        <table className="w-full border-collapse border border-black text-[10px] mt-3">
          <thead>
            <tr className="bg-gray-200 font-bold border-b border-black">
              <th className="border border-black p-1 text-left">{t("Time")}</th>
              <th className="border border-black p-1 text-left">{t("Party / Entity")}</th>
              <th className="border border-black p-1 text-center">{t("Type")}</th>
              <th className="border border-black p-1 text-left">{t("Particulars")}</th>
              <th className="border border-black p-1 text-center">{t("Mode")}</th>
              <th className="border border-black p-1 text-right">{t("Debit (Banam)")}</th>
              <th className="border border-black p-1 text-right">{t("Credit (Jama)")}</th>
              <th className="border border-black p-1 text-right">{t("Cash Balance")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r, i) => (
              <tr key={i} className="border-b border-gray-300">
                <td className="border border-black p-1">{r.time}</td>
                <td className="border border-black p-1 font-bold">{r.partyName}</td>
                <td className="border border-black p-1 text-center">{t(r.type)}</td>
                <td className="border border-black p-1">{r.item}</td>
                <td className="border border-black p-1 text-center">{t(r.paymentMethod)}</td>
                <td className="border border-black p-1 text-right">{r.debit > 0 ? `Rs. ${r.debit.toLocaleString()}` : '-'}</td>
                <td className="border border-black p-1 text-right">{r.credit > 0 ? `Rs. ${r.credit.toLocaleString()}` : '-'}</td>
                <td className="border border-black p-1 text-right font-bold">Rs. {r.runningBalance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="pt-12 flex justify-between text-xs font-bold">
          <div className="border-t border-black w-48 text-center pt-1">{t("Munshi / Cashier Signature")}</div>
          <div className="border-t border-black w-48 text-center pt-1">{t("Commission Agent (Malik) Signature")}</div>
        </div>
      </div>

    </div>
  );
}
