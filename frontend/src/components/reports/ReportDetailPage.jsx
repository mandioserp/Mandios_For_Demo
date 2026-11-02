import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api.js';
import {
  ArrowLeft,
  ExternalLink,
  Printer,
  Download,
  FileSpreadsheet,
  Filter,
  ChevronDown,
  ChevronUp,
  Info,
  Database,
  ShieldCheck,
  Calculator,
  ListFilter,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import jsPDF from 'jspdf';
import PrintReportHeader from '../common/PrintReportHeader.jsx';
import autoTable from 'jspdf-autotable';
import { drawPdfReportHeader, getBusinessProfileForReport, downloadLocalizedPdf } from '../../utils/pdfExport.js';
import { buildOwnTradingOutput } from '../../utils/ownTradingReportOutput.js';
import { outputOwnTradingReport } from '../../utils/ownTradingReportPrint.js';
import OwnTradingLotDetails from './OwnTradingLotDetails.jsx';
import { REPORTS_CONFIG } from '../../config/reportsConfig';
import { useLanguage } from '../../context/LanguageContext.jsx';
import i18n from '../../i18n.js';

// Helper function for local date formatting to avoid UTC conversion shifts
const formatLocalDate = (d = new Date()) => {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ReportDetailPage({ user }) {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();

  const config = REPORTS_CONFIG[id];

  // State for filters
  const todayStr = formatLocalDate(new Date());
  const [datePreset, setDatePreset] = useState(id === 'own-trading' ? 'All Dates' : id === 'monthly-profit' ? 'This Year' : 'Today');
  const [startDate, setStartDate] = useState(() => {
    if (id === 'monthly-profit') {
      const now = new Date();
      return formatLocalDate(new Date(now.getFullYear(), 0, 1));
    }
    return id === 'own-trading' ? '' : todayStr;
  });
  const [endDate, setEndDate] = useState(() => {
    if (id === 'monthly-profit') {
      const now = new Date();
      return formatLocalDate(new Date(now.getFullYear(), 11, 31));
    }
    return id === 'own-trading' ? '' : todayStr;
  });
  const [asOfDate, setAsOfDate] = useState(todayStr);

  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyCategory, setPartyCategory] = useState('All Parties');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [transactionType, setTransactionType] = useState('All');
  const [paymentMode, setPaymentMode] = useState('All');
  const [expenseCategory, setExpenseCategory] = useState('All');
  const [riskThreshold, setRiskThreshold] = useState('All Lots');
  const [entityType, setEntityType] = useState('Top Buyers');
  const [purchaseReference, setPurchaseReference] = useState('');
  const [sourceMandi, setSourceMandi] = useState('');
  const [saleStatus, setSaleStatus] = useState('All');
  const [dateBasis, setDateBasis] = useState('Purchase Date');
  const [detailLotId, setDetailLotId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('All');

  // Master lists for dropdowns
  const [partiesList, setPartiesList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [stockList, setStockList] = useState([]);

  // Data fetching state
  const [reportData, setReportData] = useState(null);
  const reportRequest = useRef(0);
  const [outputBusy, setOutputBusy] = useState(false);
  const [outputError, setOutputError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Commented code of Peshgi / Advance Report
  // const [inspectingParty, setInspectingParty] = useState(null);

  // Sorting state
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');

  // Collapsible metadata panel
  const [showMetadata, setShowMetadata] = useState(false);

  // Check role access
  const userRole = user?.role || 'Clerk';
  const hasAccess = useMemo(() => {
    if (!config) return false;
    if (userRole === 'super_admin' || userRole === 'Super Admin') return true;
    return config.allowedRoles.some(r => r.toLowerCase() === userRole.toLowerCase());
  }, [config, userRole]);

  // Handle Date Presets
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset === 'All Dates') { setStartDate(''); setEndDate(''); return; }
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

  // Fetch Dropdown Master Lists
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [supRes, custRes, prodRes, stockRes] = await Promise.allSettled([
          api.get('/suppliers'),
          api.get('/customers'),
          api.get('/products'),
          api.get('/stock')
        ]);

        const sups = supRes.status === 'fulfilled' ? (supRes.value.data || []) : [];
        const custs = custRes.status === 'fulfilled' ? (custRes.value.data || []) : [];
        const prods = prodRes.status === 'fulfilled' ? (prodRes.value.data || []) : [];
        const stocks = stockRes.status === 'fulfilled' ? (stockRes.value.data || []) : [];

        // Build comprehensive products list from both product catalog and unique stock entries
        const existingProdIds = new Set(prods.map(p => p.id || p._id));
        const combinedProds = [...prods];
        stocks.forEach(st => {
          if (st.productName && !existingProdIds.has(st.productId) && !combinedProds.some(p => p.name?.toLowerCase() === st.productName?.toLowerCase())) {
            combinedProds.push({
              id: st.productId || st.productName,
              name: st.productName
            });
          }
        });

        setSuppliersList(sups);
        setCustomersList(custs);
        setProductsList(combinedProds);
        setStockList(stocks);

        // Combined parties list
        const combined = [
          ...custs.map(c => ({ id: c.id || c._id, name: `${c.name} (Buyer)` })),
          ...sups.map(s => ({ id: s.id || s._id, name: `${s.name} (Beopari/Grower)` }))
        ];
        setPartiesList(combined);

        if (combined.length > 0 && id === 'party-ledger') {
          setSelectedPartyId(current => current || combined[0].id);
        }
      } catch (err) {
        console.error('Failed to load dropdown master data:', err);
      }
    };

    fetchMasterData();
  }, [id]);

  // Compute available lots depending on selected supplier
  const availableLots = useMemo(() => {
    let list = id === 'own-trading' ? stockList.filter(stock => stock.businessMode === 'Own Trading') : stockList;
    if (selectedSupplierId) {
      list = list.filter(st => st.supplierId === selectedSupplierId);
    }
    return list.map((st, idx) => {
      const lotId = st.id || st._id;
      const lotNumber = st.lotNumber ? `#${st.lotNumber}` : (st.supplierName ? `${st.supplierName.substring(0, 3).toUpperCase()}-${lotId.slice(-4)}` : `LOT-${idx + 101}`);
      const label = `${lotNumber} - ${st.productName || 'Produce'} (${st.supplierName || 'Beopari/Grower'}) - ${st.date || ''}`;
      return {
        id: lotId,
        label,
        supplierId: st.supplierId
      };
    });
  }, [stockList, selectedSupplierId, id]);

  // If selected lot no longer belongs to newly chosen supplier, reset it
  const handleSupplierChange = (newSupplierId) => {
    setSelectedSupplierId(newSupplierId);
    if (selectedLotId && newSupplierId) {
      const lotStillValid = stockList.some(st => (st.id || st._id) === selectedLotId && st.supplierId === newSupplierId);
      if (!lotStillValid) {
        setSelectedLotId('');
      }
    }
  };

  // Fetch Report Data from API
  const loadReportData = useCallback(async () => {
    if (!config || !hasAccess) return;
    const requestId = ++reportRequest.current;
    setLoading(true);
    setError(null);

    try {
      const params = {
        reportId: id,
        startDate,
        endDate,
        asOfDate,
        partyId: selectedPartyId,
        partyCategory,
        partyType: partyCategory,
        productId: selectedProductId,
        supplierId: selectedSupplierId,
        customerId: selectedCustomerId,
        lotId: selectedLotId,
        transactionType,
        paymentMode,
        expenseCategory,
        riskThreshold,
        entityType,
        purchaseReference,
        sourceMandi,
        paymentStatus, saleStatus, dateBasis
      };

      const res = await api.get('/reports/data', { params });

      if (requestId === reportRequest.current) setReportData({ ...res.data, appliedFilters: params });
    } catch (err) {
      console.error('Error fetching report data:', err);
      if (requestId === reportRequest.current) setError(err.response?.data?.error || i18n.t('Failed to load report data.'));
    } finally {
      if (requestId === reportRequest.current) setLoading(false);
    }
  }, [
    config,
    hasAccess,
    id,
    startDate,
    endDate,
    asOfDate,
    selectedPartyId,
    partyCategory,
    selectedProductId,
    selectedSupplierId,
    selectedCustomerId,
    selectedLotId,
    transactionType,
    paymentMode,
    expenseCategory,
    riskThreshold,
    entityType,
    purchaseReference,
    sourceMandi,
    paymentStatus, saleStatus, dateBasis
  ]);

  useEffect(() => {
    const timeoutId = setTimeout(loadReportData, 0);
    return () => clearTimeout(timeoutId);
  }, [loadReportData]);

  // Handle Table Sorting
  const sortedRows = useMemo(() => {
    if (!reportData?.rows) return [];
    if (!sortKey) return reportData.rows;

    return [...reportData.rows].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reportData, sortKey, sortOrder]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const ownReportContext = id === 'own-trading' && reportData ? Object.entries(reportData.appliedFilters || {}).filter(([key, value]) => ['startDate', 'endDate', 'productId', 'supplierId', 'lotId', 'purchaseReference', 'sourceMandi', 'paymentStatus', 'saleStatus', 'dateBasis'].includes(key) && value && value !== 'All').map(([key, value]) => ({ label: key, value })) : [];
  const ownSummary = id === 'own-trading' ? Object.entries(reportData?.summary || {}).map(([key, value]) => ({ label: key.replace(/([A-Z])/g, ' $1'), value: `Rs. ${Number(value).toLocaleString()}` })) : [];

  const outputOwnReport = async mode => {
    if (loading || error || outputBusy || !reportData) return;
    // Reserve the window in the click handler so async profile loading cannot block it.
    const printWindow = mode === 'print' ? window.open('', '', 'width=1200,height=850') : null;
    if (mode === 'print' && !printWindow) { setOutputError(t('Allow popups to print the report.')); return; }
    setOutputBusy(true); setOutputError('');
    const model = buildOwnTradingOutput({ report: reportData, rows: sortedRows, columns: config.columns,
      suppliers: suppliersList, products: productsList, lots: stockList, t });
    try {
      const profile = await getBusinessProfileForReport();
      await outputOwnTradingReport({ model, profile, mode, printWindow, language: document.documentElement.lang || 'en' });
    } catch (error) {
      printWindow?.close();
      setOutputError(error.message || t('Failed to generate report.'));
    } finally { setOutputBusy(false); }
  };

  // CSV Export
  const exportCSV = () => {
    if (!config || !sortedRows.length) return;

    const headers = config.columns.map(c => t(c.label)).join(',');
    const rows = sortedRows.map(row => {
      return config.columns.map(c => {
        let val = row[c.key];
        if (val === undefined || val === null) val = '';
        val = String(val).replace(/^[=+@-]/, "'$&").replace(/"/g, '""');
        return `"${val}"`;
      }).join(',');
    });

    const csvCell = value => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    const metadata = id === 'own-trading' ? [[config.name, reportData.generatedAt], ...ownReportContext.map(x => [x.label, x.value]), ...ownSummary.map(x => [x.label, x.value])].map(row => row.map(csvCell).join(',')) : [];
    const totalRow = config.columns.map((column, index) => csvCell(index === 0 ? 'Totals' : reportData?.totals?.[column.key] ?? '')).join(',');
    const csvContent = 'data:text/csv;charset=utf-8,' + [...metadata, headers, ...rows, ...(id === 'own-trading' ? [totalRow] : [])].join('\n');
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent.slice('data:text/csv;charset=utf-8,'.length));
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${config.id}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export
  const exportPDF = async () => {
    if (id === 'own-trading') return outputOwnReport('pdf');
    if (!config || !sortedRows.length) return;

    const businessProfile = await getBusinessProfileForReport();
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    const headerBottom = drawPdfReportHeader(doc, {
      title: t(config.name),
      period: `${startDate} to ${endDate}`,
      businessProfile
    });

    const head = [config.columns.map(c => t(c.label))];
    const body = sortedRows.map(row => {
      return config.columns.map(c => {
        let val = row[c.key];
        if (c.format === 'currency' || c.format === 'currency_red') {
          return `Rs. ${Number(val || 0).toLocaleString()}`;
        }
        return val !== undefined && val !== null ? String(val) : '-';
      });
    });

    if (await downloadLocalizedPdf({
      title: t(config.name),
      period: `${startDate} ${t('to')} ${endDate}`,
      columns: config.columns.map(column => t(column.label)),
      rows: body,
      businessProfile,
    })) return;

    autoTable(doc, {
      startY: headerBottom + 5,
      margin: { top: headerBottom + 5, bottom: 12 },
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawPdfReportHeader(doc, {
          title: t(config.name),
          period: `${startDate} to ${endDate}`,
          businessProfile
        });
      }
    });

    doc.save(`${config.id}_${startDate}_to_${endDate}.pdf`);
  };

  // Helper for human-friendly summary titles
  const formatSummaryCardTitle = (key) => {
    const titles = {
      totalPurchaseValue: 'Total Purchase Cost',
      totalSalesRevenue: 'Total Sales Revenue',
      grossTradingProfit: 'Total Realized Profit',
      totalAllocatedExpenses: 'Total Expenses',
      outstandingSupplierPayables: 'Outstanding Supplier Payables',
      remainingStockValue: 'Current Unsold Stock Value',
      // Commented code of Peshgi / Advance Report
      /*
      supplierAdvanceGiven: 'Beopari/Grower Advance Given (زمیندار پیشگی)',
      supplierDeductions: 'Beopari/Grower Deductions (زمیندار کٹوتیاں)',
      netSupplierAdvance: 'Net Beopari/Grower Advance (بقایا پیشگی)',
      customerAdvanceReceived: 'Customer Advance Recv (خریدار پیشگی)',
      customerAdvanceAdjusted: 'Customer Adjusted (خریدار کٹوتی)',
      netCustomerAdvance: 'Net Customer Advance (بقایا ایڈوانس)',
      */
      supplierInward: 'Beopari/Grower Inward (آمد کریٹ)',
      supplierReturned: 'Beopari/Grower Dispatched (واپسی کریٹ)',
      netSupplierOwed: 'Net Beopari/Grower Owed (زمیندار بقایا)',
      customerOutward: 'Customer Outward (جاری کریٹ)',
      customerReturned: 'Customer Received (وصولی کریٹ)',
      netCustomerPending: 'Net Customer Pending (گاہک بقایا)',
      totalCommissionEarned: 'Total Commission Earned (مجموعی کمیشن)',
      totalCustomerCommission: 'Customer Commission (خریدار کمیشن)',
      totalSupplierCommission: 'Beopari/Grower Commission (زمیندار کمیشن)',
      totalTradeValue: 'Total Mandi Trade Value (کل تجارتی حجم)',
      totalGrossValue: 'Total Gross Realization (کل مالیت)',
      totalCommissionDeductions: 'Commission Deductions (کمیشن کٹوتی)',
      totalLotExpenses: 'Lot Expenses Deducted (گاڑی خرچے)',
      totalDeductions: 'Total Deductions (کل کٹوتیاں)',
      netPayableToSuppliers: 'Net Payable to Beopari/Growers (خالص رقم)',
      totalConsignmentCrates: 'Total Arrived Crates (کل آمد کریٹ)',
      totalSoldCrates: 'Sold Crates (فروخت شدہ کریٹ)',
      totalRemainingCrates: 'Remaining Crates (بقایا کریٹ)',
      assessedTurnover: 'Assessed Turnover (کل نیلامی کاروبار)',
      totalMarketFeeDue: 'Total Market Fee (کل مارکیٹ فیس)',
      lotsAssessed: 'Assessed Lots (کل لاٹس)',
      averageFeePerLot: 'Average Fee per Lot (فی لاٹ اوسط فیس)',
      selectedCommodity: 'Audited Commodity (منتخب جنس)',
      overallAvgRate: 'Overall Avg Rate (اوسط ریٹ)',
      minRateObserved: 'Min Price (کم ترین ریٹ)',
      maxRateObserved: 'Max Price (زیادہ ترین ریٹ)',
      totalVolumeSold: 'Total Volume Sold (کل فروخت)',
      totalSalesValue: 'Total Turnover (کل رقم)',
      totalGrossCommission: 'Total Commission (کل کمیشن آمدنی)',
      totalMiscIncome: 'Misc Income (متفرق آمدنی)',
      totalExpenses: 'Total Expenses (کل اخراجات)',
      netProfit: 'Net Profit (خالص منافع)',
      profitMargin: 'Profit Margin (منافع کا تناسب)'
    };
    return titles[key] || key.replace(/([A-Z])/g, ' $1').trim();
  };

  // Summary Card Formatter
  const renderSummaryVal = (key, val) => {
    if (typeof val !== 'number') return String(val);
    if (config?.id === 'bardana') {
      return `${val.toLocaleString()} Crates`;
    }
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('qty') || lowerKey.includes('volume') || lowerKey.includes('crates') || lowerKey.includes('count') || lowerKey.includes('units') || lowerKey.includes('lots')) {
      return val.toLocaleString();
    }
    if (lowerKey.includes('margin') || lowerKey.includes('rate') || lowerKey.includes('percent')) {
      return `${val}%`;
    }
    if (val < 0) {
      return `-Rs. ${Math.abs(val).toLocaleString()}`;
    }
    return `Rs. ${val.toLocaleString()}`;
  };

  // Value Formatter helper
  const renderCellValue = (col, val, row) => {
    if (val === undefined || val === null) return '-';
    if (id === 'own-trading' && col.key === 'lotId') return <button className="text-emerald-600 underline print:text-black" onClick={() => setDetailLotId(row.stockEntryId)}>{val}</button>;
    if (id === 'own-trading' && col.key === 'paymentStatus' && val === 'Partial') return t('Partially Paid');

    if (col.key === 'netProfit') {
      const num = Number(val) || 0;
      if (num < 0) {
        return <span className="font-bold text-rose-600 dark:text-rose-400">-Rs. {Math.abs(num).toLocaleString()}</span>;
      }
      return <span className="font-bold text-emerald-600 dark:text-emerald-400">Rs. {num.toLocaleString()}</span>;
    }

    if (col.format === 'profitMargin' || col.key === 'profitMargin') {
      const strVal = String(val);
      const num = parseFloat(strVal.replace('%', '')) || 0;
      const isPos = num >= 0;
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
          isPos
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
        }`}>
          {strVal}
        </span>
      );
    }

    if (col.format === 'currency') {
      return <span className="font-semibold text-slate-900 dark:text-slate-100">Rs. {Number(val).toLocaleString()}</span>;
    }
    if (col.format === 'currency_red') {
      return <span className="font-semibold text-red-600 dark:text-red-400">Rs. {Number(val).toLocaleString()}</span>;
    }
    if (col.key === 'commissionRate') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          {t(String(val))}
        </span>
      );
    }
    if (col.format === 'progressBadge') {
      const pct = parseInt(String(val).replace('%', '')) || 0;
      let colorClass = 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
      if (pct === 0) colorClass = 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/30';
      else if (pct < 50) colorClass = 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
      else if (pct < 100) colorClass = 'text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border-indigo-500/30';

      return (
        <div className="flex flex-col items-center gap-1 min-w-[75px]">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${colorClass}`}>
            {t(String(val))}
          </span>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
            <div
              className={`h-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : pct > 0 ? 'bg-amber-500' : 'bg-transparent'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      );
    }
    if (col.format === 'badge') {
      const str = String(val).toLowerCase();
      let badgeStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

      if (str.includes('walk-in') || str === 'cash' || str === 'settled') {
        badgeStyle = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      } else if (str.includes('customer') || str.includes('receipt') || str.includes('خریدار') || str === 'bank') {
        badgeStyle = 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30';
      } else if (str.includes('supplier') || str.includes('payment') || str.includes('owed') || str.includes('pending') || str.includes('زمیندار')) {
        badgeStyle = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
      } else if (str.includes('active') || str.includes('bal:')) {
        badgeStyle = 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
      } else if (str.includes('expense') || str.includes('risk')) {
        badgeStyle = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
      }

      return (
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle}`}>
          {t(String(val))}
        </span>
      );
    }
    if (col.format === 'riskBadge') {
      let bg = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      if (val === 'Caution') bg = 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      if (val === 'High Risk') bg = 'bg-red-500/10 text-red-600 border-red-500/30';
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${bg}`}>
          {val}
        </span>
      );
    }
    if (col.format === 'number_bold') {
      const num = Number(val) || 0;
      if (config?.id === 'bardana') {
        return <span className="font-bold text-slate-900 dark:text-white">{num.toLocaleString()} <span className="text-[11px] text-slate-400 font-normal">{t("Crates")}</span></span>;
      }
      return <span className="font-bold text-slate-900 dark:text-white">{num.toLocaleString()}</span>;
    }
    if (col.format === 'number') {
      const num = Number(val) || 0;
      if (config?.id === 'bardana' && (col.key === 'baseQuantity' || col.key === 'settledQuantity')) {
        return <span>{num.toLocaleString()} <span className="text-[11px] text-slate-400 font-normal">{t("Crates")}</span></span>;
      }
      if (row?.unit && (col.key === 'quantity' || col.key === 'soldQuantity' || col.key === 'remainingQuantity')) {
        return <span>{num.toLocaleString()} <span className="text-[11px] text-slate-400 font-normal">{t(row.unit)}</span></span>;
      }
      return <span>{num.toLocaleString()}</span>;
    }

    return String(val);
  };

  if (!config) {
    return (
      <div className="p-8 text-center max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t("Report Not Found")}</h2>
        <p className="text-sm text-slate-500 mt-2">{t('The requested report ID "')}{id}{t('" does not exist in Mandi OS configuration.')}</p>
        <button onClick={() => navigate('/reports')} className="mt-6 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium text-sm">{t("Return to Reports Hub")}</button>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-8 text-center max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow">
        <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t("Access Restricted")}</h2>
        <p className="text-sm text-slate-500 mt-2">{t('Your user role is not authorized to view this report.')}</p>
        <button onClick={() => navigate('/reports')} className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-xl font-medium text-sm">{t("Return to Reports Hub")}</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto print:p-0 print:m-0 print:space-y-4">

      {id === 'own-trading' && <>
        <p className="text-xs text-slate-500">{t('Dates select purchases; balances and profit include all linked transactions through today. Choose Purchase or Activity Date to include older purchases with sales, approved returns or payments in the selected period. Supplier payments and balances are allocated to lots by purchase value. Expenses are already included in landed cost.')}</p>
        {detailLotId && <OwnTradingLotDetails lotId={detailLotId} onClose={() => setDetailLotId(null)} />}
      </>}
      {/* PRINT-ONLY MANDI OS BUSINESS LETTERHEAD & SUMMARY */}
      <PrintReportHeader
        title={config?.name || 'BUSINESS REPORT'}
        period={id === 'own-trading' ? `${reportData?.appliedFilters?.dateBasis || dateBasis}: ${reportData?.appliedFilters?.startDate || 'All dates'} to ${reportData?.appliedFilters?.endDate || 'present'}` : config?.dateModel === 'as_of' ? asOfDate : `${startDate || asOfDate} ${t('to')} ${endDate || asOfDate}`}
        filters={[
          ...ownReportContext,
          ...(selectedPartyId ? [{ label: 'Party', value: partiesList.find(p => p.id === selectedPartyId)?.name || selectedPartyId }] : []),
          ...(selectedSupplierId ? [{ label: 'Beopari/Grower', value: suppliersList.find(s => (s.id || s._id) === selectedSupplierId)?.name || selectedSupplierId }] : []),
          ...(selectedCustomerId ? [{ label: 'Customer', value: customersList.find(c => (c.id || c._id) === selectedCustomerId)?.name || selectedCustomerId }] : []),
          ...(selectedProductId ? [{ label: 'Product', value: productsList.find(p => (p.id || p._id) === selectedProductId)?.name || selectedProductId }] : []),
          ...(paymentMode !== 'All' ? [{ label: 'Payment Mode', value: paymentMode }] : []),
          ...(transactionType !== 'All' ? [{ label: 'Type', value: transactionType }] : [])
        ]}
        summaryMetrics={
          id === 'own-trading' ? ownSummary : reportData?.summaryCards?.length > 0
            ? reportData.summaryCards.map(c => ({ label: c.title, value: c.value }))
            : [
                { label: 'Total Records', value: `${sortedRows?.length || 0} Entries` },
                { label: 'Report Tier', value: config?.tier || 'Audit' },
                { label: 'Audited Status', value: 'Verified' }
              ]
        }
      />

      {/* SECTION 1: Report Title & Purpose */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => navigate('/reports')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t("Reports Hub")}</span>
              </button>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {t(config.tier)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t(config.name)}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {t(config.purpose)}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => window.open(`/reports/${config.id}`, '_blank')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title={t("Open in a standalone window")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t("New Window")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("Report Filters")}</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[...(id === 'own-trading' ? ['All Dates'] : []), 'Today', 'Yesterday', 'This Week', 'This Month', 'This Year'].map(preset => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  datePreset === preset
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

          {/* Date Range Start & End */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t("Start Date")}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDatePreset('Custom'); }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t("End Date")}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDatePreset('Custom'); }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Dynamic Filters based on config.availableFilters */}
          {config.availableFilters.map(f => {
            if (f.id === 'dateRange') return null;

            if (f.type === 'text') {
              const value = f.id === 'purchaseReference' ? purchaseReference : sourceMandi;
              const setter = f.id === 'purchaseReference' ? setPurchaseReference : setSourceMandi;
              return <div key={f.id}><label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t(f.label)}</label><input type="search" value={value} onChange={event => setter(event.target.value)} placeholder={t(f.label)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white" /></div>;
            }

            if (f.type === 'partySelect') {
              let currentPartyOptions = partiesList;
              let defaultOptionLabel = 'All Parties';

              const isSupFilter = partyCategory.toLowerCase().includes('supplier') || partyCategory.includes('زمیندار');
              const isCustFilter = partyCategory.toLowerCase().includes('customer') || partyCategory.toLowerCase().includes('buyer') || partyCategory.includes('خریدار');

              if (isSupFilter) {
                currentPartyOptions = suppliersList.map(s => ({ id: s.id || s._id, name: `${s.name} (Beopari/Grower)` }));
                defaultOptionLabel = 'All Beopari/Growers';
              } else if (isCustFilter) {
                currentPartyOptions = customersList.map(c => ({ id: c.id || c._id, name: `${c.name} (Buyer)` }));
                defaultOptionLabel = 'All Buyers / Customers';
              }

              return (
                <div key={f.id}>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t(f.label)}</label>
                  <select
                    value={selectedPartyId}
                    onChange={(e) => setSelectedPartyId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {id !== 'party-ledger' && <option value="">{defaultOptionLabel}</option>}
                    {currentPartyOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (f.type === 'productSelect') {
              return (
                <div key={f.id}>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{f.label}</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">{t("All Commodities")}</option>
                    {productsList.map(p => (
                      <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (f.type === 'supplierSelect') {
              return (
                <div key={f.id}>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{f.label}</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">{t("All Beopari/Growers")}</option>
                    {suppliersList.map(s => (
                      <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (f.type === 'lotSelect') {
              return (
                <div key={f.id}>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    {f.label} {selectedSupplierId ? '(Beopari/Grower Lots)' : '(All Lots)'}
                  </label>
                  <select
                    value={selectedLotId}
                    onChange={(e) => setSelectedLotId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">{selectedSupplierId ? 'All Lots for Selected Beopari/Grower' : 'All Consignment Lots'}</option>
                    {availableLots.map(lot => (
                      <option key={lot.id} value={lot.id}>{lot.label}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (f.type === 'customerSelect') {
              return (
                <div key={f.id}>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{f.label}</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">{t('All Buyers')}</option>
                    {customersList.map(c => (
                      <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (f.type === 'select') {
              let val = transactionType;
              let setter = setTransactionType;
              if (f.id === 'partyCategory') {
                val = partyCategory;
                setter = (newVal) => {
                  setPartyCategory(newVal);
                  setSelectedPartyId('');
                };
              } else if (f.id === 'paymentMode') {
                val = paymentMode;
                setter = setPaymentMode;
              } else if (f.id === 'expenseCategory') {
                val = expenseCategory;
                setter = setExpenseCategory;
              } else if (f.id === 'riskThreshold') {
                val = riskThreshold;
                setter = setRiskThreshold;
              } else if (f.id === 'entityType') {
                val = entityType;
                setter = setEntityType;
              } else if (f.id === 'saleStatus') {
                val = saleStatus; setter = setSaleStatus;
              } else if (f.id === 'dateBasis') {
                val = dateBasis; setter = setDateBasis;
              } else if (f.id === 'paymentStatus') {
                val = paymentStatus;
                setter = setPaymentStatus;
              }

              return (
                <div key={f.id}>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t(f.label)}</label>
                  <select
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {f.options.map(opt => (
                      <option key={opt} value={opt}>{t(opt)}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (f.type === 'date') {
              return (
                <div key={f.id}>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{f.label}</label>
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              );
            }

            return null;
          })}
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={loadReportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('Refresh')}</span>
          </button>

          <button
            disabled={loading || Boolean(error) || outputBusy}
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/30"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t('Export CSV')}</span>
          </button>

          <button
            disabled={loading || Boolean(error) || outputBusy}
            onClick={exportPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors border border-indigo-500/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('Export PDF')}</span>
          </button>

          <button
            disabled={loading || Boolean(error) || outputBusy}
            onClick={() => id === 'own-trading' ? outputOwnReport('print') : window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('Print Report')}</span>
          </button>
        </div>
      </div>

      {outputBusy && <p role="status" className="text-sm text-slate-500">{t('Preparing landscape report...')}</p>}
      {outputError && <p role="alert" className="text-sm text-rose-600">{outputError}</p>}
      {/* SECTION 3: Visualized Report Area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('Generating report query and aggregations...')}</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 bg-red-50 dark:bg-red-950/20 rounded-xl p-4 border border-red-200 dark:border-red-900/30">
            <p className="font-semibold text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* Summary Cards if available */}
            {reportData?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(reportData.summary).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                    <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {formatSummaryCardTitle(key)}
                    </span>
                    <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block">
                      {renderSummaryVal(key, val)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Chart Visualization if applicable */}
            {config.visualizationType === 'chart_and_table' && reportData?.chartData && reportData.chartData.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 print:hidden">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">{t("Visual Trend Analytics")}</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {config.chartType === 'line' ? (
                      <LineChart data={reportData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                        <YAxis stroke="#888888" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#ffffff', borderRadius: '8px' }}
                          formatter={(value, name) => [
                            `Rs. ${Number(value).toLocaleString()}`,
                            name === 'AvgRate' ? 'Avg Selling Rate (اوسط ریٹ)' : name === 'MinRate' ? 'Min Rate (کم ترین ریٹ)' : name === 'MaxRate' ? 'Max Rate (زیادہ ترین ریٹ)' : name
                          ]}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Line type="monotone" name="Avg Selling Rate (اوسط ریٹ)" dataKey="AvgRate" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        {reportData.chartData.some(d => d.MinRate !== undefined) && (
                          <Line type="monotone" name="Min Rate (کم ترین)" dataKey="MinRate" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} />
                        )}
                        {reportData.chartData.some(d => d.MaxRate !== undefined) && (
                          <Line type="monotone" name="Max Rate (زیادہ ترین)" dataKey="MaxRate" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} />
                        )}
                      </LineChart>
                    ) : id === 'monthly-profit' ? (
                      <BarChart data={reportData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                        <YAxis stroke="#888888" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#ffffff', borderRadius: '8px' }}
                          formatter={(value, name) => [
                            `Rs. ${Number(value).toLocaleString()}`,
                            name === 'CustomerComm' ? 'Customer Comm (خریدار کمیشن)' :
                            name === 'SupplierComm' ? 'Beopari/Grower Comm (زمیندار کمیشن)' :
                            name === 'GrossCommission' || name === 'Commission' ? 'Total Comm (کل کمیشن)' :
                            name === 'Expenses' ? 'Total Expenses (کل اخراجات)' :
                            name === 'NetProfit' ? 'Net Profit (خالص منافع)' : name
                          ]}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar dataKey="CustomerComm" name="Customer Comm (خریدار کمیشن)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="SupplierComm" name="Supplier Comm (زمیندار کمیشن)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Expenses" name="Total Expenses (کل اخراجات)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="NetProfit" name="Net Profit (خالص منافع)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : (
                      <BarChart data={reportData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                        <YAxis stroke="#888888" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#ffffff', borderRadius: '8px' }} />
                        <Bar dataKey={Object.keys(reportData.chartData[0])[1]} fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Commented code of Peshgi / Advance Report */}
            {/*
            {id === 'advance' && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                    <CreditCard size={15} className="text-emerald-500" />
                    <span>Peshgi Advance Hub (پیشگی کھاتہ جات)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    زمیندار فصل پیشگی اور خریدار ایڈوانس سیکیورٹی ڈپازٹس کا الگ الگ انتظام و آٹو کٹوتیاں
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
                  {[
                    { label: 'All Advances (2-Way)', val: 'All Advances (2-Way View)' },
                    { label: '🌾 Beopari/Grower Peshgi (زمیندار پیشگی)', val: 'Supplier Peshgi (زمیندار پیشگی)' },
                    { label: '🛒 Customer Advance (خریدار پیشگی)', val: 'Customer Advance (خریدار پیشگی)' }
                  ].map(tab => (
                    <button
                      key={tab.val}
                      type="button"
                      onClick={() => setPartyCategory(tab.val)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                        partyCategory === tab.val
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            */}

            {/* Table Area */}
            {sortedRows.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{t("No transactions found for this period or filter parameters.")}</p>
                <p className="text-xs text-slate-400 mt-1">{t("Try widening your date range or clearing specific filter dropdowns.")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto print:overflow-visible rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white dark:bg-slate-800">
                      {config.columns.map(col => (
                        <th
                          key={col.key}
                          onClick={() => col.sortable !== false && handleSort(col.key)}
                          className={`p-3 font-semibold uppercase tracking-wider text-[11px] select-none ${
                            col.sortable !== false ? 'cursor-pointer hover:bg-slate-800' : ''
                          } ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                            <span>{col.label}</span>
                            {sortKey === col.key && (
                              <span className="text-emerald-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </th>
                      ))}
                      {/* Commented code of Peshgi / Advance Report */}
                      {/*
                      {id === 'advance' && (
                        <th className="p-3 text-center font-semibold uppercase tracking-wider text-[11px] select-none">
                          Actions
                        </th>
                      )}
                      */}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {config.columns.map(col => (
                          <td
                            key={col.key}
                            className={`p-3 ${
                              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                            }`}
                          >
                            {renderCellValue(col, row[col.key], row)}
                          </td>
                        ))}
                        {/* Commented code of Peshgi / Advance Report */}
                        {/*
                        {id === 'advance' && (
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectingParty(row);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                            >
                              <Eye size={12} />
                              <span>Audit Lots</span>
                            </button>
                          </td>
                        )}
                        */}
                      </tr>
                    ))}
                  </tbody>

                  {/* Totals Row */}
                  {reportData?.totals && Object.keys(reportData.totals).length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                        {config.columns.map((col, idx) => {
                          if (idx === 0) {
                            return <td key={col.key} className="p-3 text-left">{t("TOTALS")}</td>;
                          }
                          const totVal = reportData.totals[col.key];
                          if (totVal !== undefined) {
                            return (
                              <td key={col.key} className={`p-3 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                                {col.format === 'currency' || col.format === 'currency_red'
                                  ? (Number(totVal) < 0 ? `-Rs. ${Math.abs(Number(totVal)).toLocaleString()}` : `Rs. ${Number(totVal).toLocaleString()}`)
                                  : typeof totVal === 'number'
                                    ? totVal.toLocaleString()
                                    : String(totVal)}
                              </td>
                            );
                          }
                          return <td key={col.key} className="p-3">-</td>;
                        })}
                        {/* Commented code of Peshgi / Advance Report */}
                        {/* {id === 'advance' && <td className="p-3">-</td>} */}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* SECTION 4: Collapsible Report Details Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm print:hidden">
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className="w-full p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">{t('Report Specifications & Audit Metadata')}</span>
          </div>
          {showMetadata ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {showMetadata && (
          <div className="p-6 space-y-5 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Data Source & Security */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                    <Database className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{t('Data Source Collections')}</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {config.dataSources.map(ds => (
                      <span key={ds} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                        {t(ds)}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{t('Authorized Roles')}</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {config.allowedRoles.map(r => (
                      <span key={r} className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold">
                        {t(r)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fields & Filters */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                    <ListFilter className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('Included Column Fields')}</span>
                  </h4>
                  <p className="text-slate-500 leading-relaxed">
                    {config.columns.map(c => `${t(c.label)} (${c.key})`).join(', ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Calculation Logic */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                <Calculator className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t('Calculation Logic & Formulas')}</span>
              </h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {t(config.calculationLogic)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Commented code of Peshgi / Advance Report */}
      {/*
      {inspectingParty && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-50 dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                  inspectingParty.rawPartyType === 'Supplier'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                }`}>
                  <CreditCard size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {inspectingParty.partyName}
                    </h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      inspectingParty.rawPartyType === 'Supplier'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    }`}>
                      {inspectingParty.partyType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Peshgi Advance Statement & Auto-Deductions Audit (تفصیل پیشگی و کٹوتیاں)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectingParty(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Total Advance Disbursed</span>
                  <strong className="text-base font-black text-slate-900 dark:text-white block mt-0.5">
                    Rs. {Number(inspectingParty.totalAdvance || 0).toLocaleString()}
                  </strong>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <span className="block text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Total Deductions / Recovered</span>
                  <strong className="text-base font-black text-emerald-700 dark:text-emerald-300 block mt-0.5">
                    Rs. {Number(inspectingParty.adjustedAmount || 0).toLocaleString()}
                  </strong>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <span className="block text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Net Remaining Balance</span>
                  <strong className="text-base font-black text-amber-700 dark:text-amber-300 block mt-0.5">
                    Rs. {Number(inspectingParty.remainingAdvance || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <TrendingUp size={13} className="text-emerald-500" />
                    <span>Advance Recovery Rate</span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">
                    {inspectingParty.recoveryRate} Recovered
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, inspectingParty.recoveryPercent || 0)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <History size={13} className="text-emerald-500" />
                    <span>Consignment Lot Auto-Deductions ({inspectingParty.deductionsHistory?.length || 0})</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    کٹوتیاں برائے مال نیلامی / بلتی
                  </span>
                </div>

                {inspectingParty.deductionsHistory && inspectingParty.deductionsHistory.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-[9px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Lot / Invoice #</th>
                          <th className="p-2">Crop / Produce</th>
                          <th className="p-2">Type / Action</th>
                          <th className="p-2 text-right">Auto-Deducted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {inspectingParty.deductionsHistory.map((d, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-mono">{d.date}</td>
                            <td className="p-2 font-mono font-bold text-slate-900 dark:text-white">#{d.lotNumber}</td>
                            <td className="p-2">{d.productName}</td>
                            <td className="p-2 text-[10px] text-slate-500">{t(d.type)}</td>
                            <td className="p-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                              Rs. {Number(d.amount).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-400 italic text-[11px]">
                    No auto-deductions recorded on consignment lots yet for this account.
                  </div>
                )}
              </div>

              {inspectingParty.disbursementsHistory && inspectingParty.disbursementsHistory.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                    <Truck size={13} className="text-amber-500" />
                    <span>Advance Disbursements Log ({inspectingParty.disbursementsHistory.length})</span>
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-[9px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Voucher #</th>
                          <th className="p-2">Method</th>
                          <th className="p-2">Description</th>
                          <th className="p-2 text-right">Disbursed (Rs)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {inspectingParty.disbursementsHistory.map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-mono">{p.date}</td>
                            <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{p.voucherNumber}</td>
                            <td className="p-2 font-medium">{t(p.paymentMethod)}</td>
                            <td className="p-2 text-slate-500 text-[10px]">{p.description}</td>
                            <td className="p-2 text-right font-bold text-slate-900 dark:text-white">
                              Rs. {Number(p.amount).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-[#0F172A] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const path = inspectingParty.rawPartyType === 'Supplier'
                    ? `/suppliers?id=${inspectingParty.partyId}`
                    : `/customers?id=${inspectingParty.partyId}`;
                  navigate(path);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#4F46E5] dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all"
              >
                <span>Open Full Party Ledger (کھاتہ نقل)</span>
                <ExternalLink size={13} />
              </button>

              <button
                type="button"
                onClick={() => setInspectingParty(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
      */}

    </div>
  );
}
