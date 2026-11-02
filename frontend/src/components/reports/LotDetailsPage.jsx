import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext';
import { exportToCSV } from '../../utils/navigation';
import { downloadLotVoucherPDF } from '../../utils/pdfExport';
import { Printer, Download, RefreshCw, Boxes, DollarSign, Calendar, Save, CheckCircle2, AlertCircle, Users, User, Layers, ShoppingBag, ArrowRight } from 'lucide-react';
import PrintReportHeader from '../common/PrintReportHeader.jsx';

export default function LotDetailsPage() {
  const { t } = useLanguage();
  const searchParams = new URLSearchParams(window.location.search);
  const initialLotId = searchParams.get('lotId') || searchParams.get('id') || '';

  const [stockEntries, setStockEntries] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState(initialLotId);
  const [activeStock, setActiveStock] = useState(null);
  const [lotSales, setLotSales] = useState([]);
  const [lotReturns, setLotReturns] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Settlement Inputs
  const [lotFinCommType, setLotFinCommType] = useState('Percentage');
  const [lotFinCommValue, setLotFinCommValue] = useState(0);
  const [lotFinMarketFee, setLotFinMarketFee] = useState(0);
  const [lotFinExpenses, setLotFinExpenses] = useState({});
  const [savingLotFin, setSavingLotFin] = useState(false);
  const [recordingSettlement, setRecordingSettlement] = useState(false);
  const [lotFinMessage, setLotFinMessage] = useState(null);

  useEffect(() => {
    fetchLotData();
  }, [selectedLotId]);

  const fetchLotData = async () => {
    try {
      setLoading(true);
      const [stockRes, salesRes, expCatRes, returnsRes] = await Promise.all([
        api.get('/stock').catch(() => ({ data: [] })),
        api.get('/sales').catch(() => ({ data: [] })),
        api.get('/settings/expense-categories').catch(() => ({ data: [] })),
        api.get('/returns').catch(() => ({ data: [] }))
      ]);

      const stockList = stockRes.data || [];
      const allSales = salesRes.data || [];
      const allReturns = returnsRes.data || [];
      setStockEntries(stockList);
      setExpenseCategories((expCatRes.data || []).filter(c => c.status !== 'Inactive'));

      let lotToUse = null;
      if (selectedLotId) {
        lotToUse = stockList.find(s => String(s.id || s._id) === String(selectedLotId) || (s.lotNumber && String(s.lotNumber) === String(selectedLotId)));
      }
      if (!lotToUse && stockList.length > 0) {
        lotToUse = stockList[0];
        setSelectedLotId(lotToUse.id || lotToUse._id);
      }

      setActiveStock(lotToUse || null);

      if (lotToUse) {
        const lotIdToMatch = String(lotToUse.id || lotToUse._id || '');
        const lotNumToMatch = lotToUse.lotNumber ? String(lotToUse.lotNumber) : null;

        const linkedSales = allSales.filter(s => {
          const sStockId = s.stockEntryId ? String(s.stockEntryId) : null;
          const sLotNum = s.stockLotNumber ? String(s.stockLotNumber) : null;

          if (sStockId && lotIdToMatch) {
            return sStockId === lotIdToMatch;
          }
          if (sLotNum && lotNumToMatch) {
            return sLotNum === lotNumToMatch;
          }
          return false;
        });
        setLotSales(linkedSales);

        const linkedReturns = allReturns.filter(r => {
          const rStockId = r.stockEntryId ? String(r.stockEntryId) : null;
          const rSaleId = r.saleId ? String(r.saleId) : null;
          const matchesStock = rStockId && lotIdToMatch && rStockId === lotIdToMatch;
          const matchesSale = rSaleId && linkedSales.some(s => String(s.id || s._id) === rSaleId);
          return (matchesStock || matchesSale) && (r.status === 'Approved') && (!r.isDeleted);
        });
        setLotReturns(linkedReturns);

        // Sync settlement fields
        setLotFinCommType(lotToUse.supplierCommissionType || 'Percentage');
        setLotFinCommValue(lotToUse.supplierCommissionValue !== undefined ? lotToUse.supplierCommissionValue : 0);
        setLotFinMarketFee(lotToUse.marketFeeFixedAmount !== undefined ? lotToUse.marketFeeFixedAmount : (lotToUse.marketFeeAmount > 0 ? lotToUse.marketFeeAmount : (lotToUse.marketFeeRate ?? lotToUse.marketFeePercentage ?? 0)));
        setLotFinExpenses(lotToUse.lotExpenses || {});
      }
    } catch (err) {
      console.error('Failed to load lot details page', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculations (Net of produce returns)
  const rawLotGrossSales = lotSales.reduce((acc, curr) => acc + (curr.grossSale || (curr.quantity * curr.saleRate)), 0);
  const rawLotQtySold = lotSales.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  const returnedLotGross = lotReturns.reduce((acc, r) => acc + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
  const returnedLotQty = lotReturns.reduce((acc, r) => acc + (Number(r.produceReturnedQty) || 0), 0);

  const lotGrossSales = Math.max(0, Math.round((rawLotGrossSales - returnedLotGross) * 100) / 100);
  const lotQtySold = Math.max(0, rawLotQtySold - returnedLotQty);
  const arrivedQty = activeStock?.totalQuantity || activeStock?.quantity || 0;
  const remainingQty = Math.max(0, arrivedQty - lotQtySold);
  const lotClearanceRate = arrivedQty > 0 ? Math.min(100, Math.round((lotQtySold / arrivedQty) * 100)) : 0;

  const rawBuyerCommission = lotSales.reduce((acc, curr) => acc + (curr.commissionAmount || curr.commission || 0), 0);
  const returnedBuyerCommission = lotReturns.reduce((acc, r) => {
    let rev = Number(r.commissionReversedAmount) || 0;
    if (!rev && Number(r.produceReturnedQty) > 0) {
      const matchingSale = lotSales.find(s => String(s.id || s._id) === String(r.saleId));
      if (matchingSale && matchingSale.quantity > 0 && matchingSale.commissionAmount > 0) {
        rev = Number(r.produceReturnedQty) * (Number(matchingSale.commissionAmount) / Number(matchingSale.quantity));
      } else {
        const commRate = parseFloat(String(r.commissionRate || 0).replace(/[^\d.]/g, '')) || 0;
        const retGross = Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0));
        rev = retGross * (commRate / 100);
      }
    }
    return acc + (rev || 0);
  }, 0);
  const netBuyerCommission = Math.max(0, Math.round((rawBuyerCommission - returnedBuyerCommission) * 100) / 100);

  // Date-wise breakdown calculation adjusted for returns
  const dateGroupsMap = lotSales.reduce((acc, sale) => {
    const sDate = sale.date || (sale.createdAt ? new Date(sale.createdAt).toISOString().split('T')[0] : 'Unknown Date');
    if (!acc[sDate]) {
      acc[sDate] = {
        date: sDate,
        sales: [],
        totalQty: 0,
        walkInQty: 0,
        registeredQty: 0,
        grossValue: 0,
        commission: 0
      };
    }
    acc[sDate].sales.push(sale);
    const qty = sale.quantity || 0;
    acc[sDate].totalQty += qty;
    if (sale.isWalkIn) {
      acc[sDate].walkInQty += qty;
    } else {
      acc[sDate].registeredQty += qty;
    }
    acc[sDate].grossValue += (sale.grossSale || (sale.quantity * sale.saleRate) || 0);
    acc[sDate].commission += (sale.commissionAmount || sale.commission || 0);
    return acc;
  }, {});

  // Deduct returns from date groups
  lotReturns.forEach(r => {
    const matchingSale = lotSales.find(s => String(s.id || s._id) === String(r.saleId));
    const rDate = matchingSale?.date || r.date || 'Unknown Date';
    const rQty = Number(r.produceReturnedQty) || 0;
    const rGross = Number(r.grossReturnAmount) || (rQty * Number(r.saleRate || 0));
    let rComm = Number(r.commissionReversedAmount) || 0;
    if (!rComm && rQty > 0) {
      if (matchingSale && matchingSale.quantity > 0 && matchingSale.commissionAmount > 0) {
        rComm = rQty * (Number(matchingSale.commissionAmount) / Number(matchingSale.quantity));
      } else {
        const commRate = parseFloat(String(r.commissionRate || 0).replace(/[^\d.]/g, '')) || 0;
        rComm = rGross * (commRate / 100);
      }
    }

    if (dateGroupsMap[rDate]) {
      dateGroupsMap[rDate].totalQty = Math.max(0, dateGroupsMap[rDate].totalQty - rQty);
      dateGroupsMap[rDate].grossValue = Math.max(0, dateGroupsMap[rDate].grossValue - rGross);
      dateGroupsMap[rDate].commission = Math.max(0, Math.round((dateGroupsMap[rDate].commission - rComm) * 100) / 100);
    } else {
      const altDate = r.date || 'Unknown Date';
      if (dateGroupsMap[altDate]) {
        dateGroupsMap[altDate].totalQty = Math.max(0, dateGroupsMap[altDate].totalQty - rQty);
        dateGroupsMap[altDate].grossValue = Math.max(0, dateGroupsMap[altDate].grossValue - rGross);
        dateGroupsMap[altDate].commission = Math.max(0, Math.round((dateGroupsMap[altDate].commission - rComm) * 100) / 100);
      }
    }
  });

  const sortedDateGroups = Object.values(dateGroupsMap).sort((a, b) => new Date(b.date) - new Date(a.date));

  const commValNum = Number(lotFinCommValue) || 0;
  let computedSupplierCommDeduction = 0;
  if (lotFinCommType === 'Percentage') {
    computedSupplierCommDeduction = lotGrossSales * (commValNum / 100);
  } else if (lotFinCommType === 'Per Unit') {
    computedSupplierCommDeduction = lotQtySold * commValNum;
  } else if (lotFinCommType === 'Fixed Amount') {
    computedSupplierCommDeduction = commValNum;
  }
  computedSupplierCommDeduction = Math.round(computedSupplierCommDeduction * 100) / 100;

  const marketFeeFixedAmount = Number(lotFinMarketFee) || 0;
  const computedMarketFeeDeduction = Math.round(marketFeeFixedAmount * 100) / 100;

  let computedTotalExpenses = 0;
  if (lotFinExpenses && typeof lotFinExpenses === 'object') {
    Object.values(lotFinExpenses).forEach(val => {
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        computedTotalExpenses += num;
      }
    });
  }
  computedTotalExpenses = Math.round(computedTotalExpenses * 100) / 100;

  const computedTotalDeductions = Math.round((computedSupplierCommDeduction + computedMarketFeeDeduction + computedTotalExpenses) * 100) / 100;
  const computedNetPayable = Math.round((lotGrossSales - computedTotalDeductions) * 100) / 100;
  const totalBrokerCommission = Math.round((netBuyerCommission + computedSupplierCommDeduction) * 100) / 100;

  const handleSaveLotFinancials = async () => {
    if (!activeStock) return;
    const stockId = activeStock.id || activeStock._id;
    setSavingLotFin(true);
    setLotFinMessage(null);
    try {
      await api.put(`/stock/${stockId}/lot-financials`, {
        supplierCommissionType: lotFinCommType,
        supplierCommissionValue: Number(lotFinCommValue) || 0,
        marketFeeFixedAmount: Number(lotFinMarketFee) || 0,
        lotExpenses: lotFinExpenses
      });
      setLotFinMessage({ text: 'Beopari/Grower Lot Settlement configuration saved successfully!', type: 'success' });
      fetchLotData();
    } catch (err) {
      setLotFinMessage({ text: err.response?.data?.error || 'Failed to save lot settlement', type: 'error' });
    } finally {
      setSavingLotFin(false);
    }
  };

  const handleRecordLotSettlement = async () => {
    if (!activeStock) return;
    const stockId = activeStock.id || activeStock._id;
    if (activeStock.isSettled) {
      alert('This consignment lot settlement has already been recorded to Outstanding Payables and Beopari/Grower Supply Value.');
      return;
    }
    setRecordingSettlement(true);
    setLotFinMessage(null);
    try {
      const res = await api.post(`/stock/${stockId}/record-settlement`, {
        supplierCommissionType: lotFinCommType,
        supplierCommissionValue: Number(lotFinCommValue) || 0,
        marketFeeFixedAmount: Number(lotFinMarketFee) || 0,
        lotExpenses: lotFinExpenses
      });
      setLotFinMessage({ 
        text: res.data.message || `Successfully recorded Rs. ${res.data.applicableAmount?.toLocaleString()} to Outstanding Payables and Beopari/Grower Supply Value!`,
        type: 'success' 
      });
      fetchLotData();
    } catch (err) {
      setLotFinMessage({ 
        text: err.response?.data?.error || 'Failed to record lot settlement', 
        type: 'error' 
      });
    } finally {
      setRecordingSettlement(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!activeStock) return;
    const lotNum = activeStock.lotNumber || 'Lot';
    const headers = ['Lot Number', 'Beopari/Grower', 'Product', 'Invoice No', 'Sale Date', 'Customer', 'Customer Type', 'Quantity Sold', 'Rate (Rs)', 'Gross Amount', 'Commission (Rs)'];
    const rows = lotSales.map(s => [
      lotNum,
      activeStock.supplierName || '',
      activeStock.productName || '',
      s.invoiceNumber || (s.id || s._id || '').substring(0, 8),
      s.date,
      s.customerName || s.walkInName || 'Walk-In',
      s.isWalkIn ? 'Walk-In' : 'Registered',
      s.quantity,
      s.saleRate,
      s.grossSale || (s.quantity * s.saleRate),
      s.commissionAmount || s.commission || 0
    ]);
    exportToCSV(`Lot_Sheet_${lotNum}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4F46E5] dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">{t("Consignment Lot Ledger Report")}</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">{t("Date-Wise Sales Breakdown")}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {activeStock ? `Consignment Lot #${activeStock.lotNumber} — ${activeStock.productName}` : 'Consignment Lot Details'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleRecordLotSettlement}
            disabled={recordingSettlement || activeStock?.isSettled || !activeStock || (computedNetPayable <= 0 && lotGrossSales <= 0)}
            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md ${
              activeStock?.isSettled
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>
              {recordingSettlement
                ? 'Settling...'
                : (activeStock?.isSettled
                    ? `✓ Settled in Payables (Rs. ${(activeStock?.settledAmount || computedNetPayable || 0).toLocaleString()})`
                    : 'Submit to Payables (Bikri Parchi)')}
            </span>
          </button>

          <button
            onClick={() => downloadLotVoucherPDF({
              lot: activeStock,
              lotSales: lotSales,
              lotReturns: lotReturns,
              supplier: {
                name: activeStock?.supplierName,
                phone: activeStock?.supplierPhone || activeStock?.supplier?.phone
              },
              stock: activeStock
            })}
            disabled={!activeStock}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
          >
            <Download size={14} />
            <span>{t("Download PDF Voucher")}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!activeStock}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            <Download size={14} />
            <span>{t("Export CSV")}</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!activeStock}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
          >
            <Printer size={14} />
            <span>{t("Print Lot Sheet")}</span>
          </button>
        </div>
      </div>

      {/* Lot Selector for Quick Navigation */}
      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">{t("Select Consignment Lot Sheet")}</label>
        <select
          value={selectedLotId}
          onChange={(e) => setSelectedLotId(e.target.value)}
          className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#4F46E5]"
        >
          {stockEntries.map(s => (
            <option key={s.id || s._id} value={s.id || s._id}>{t("Lot #")}{s.lotNumber}{' '}{t("| Beopari/Grower:")}{' '}{s.supplierName}{' '}{t("| Product:")}{' '}{s.productName} ({s.quantity} {s.unit || 'units'}{t(") - Arrived:")}{' '}{s.arrivalDate || s.date}
            </option>
          ))}
        </select>
      </div>

      {/* Printable Letterhead Header */}
      <PrintReportHeader
        title={`CONSIGNMENT LOT SETTLEMENT SHEET — LOT #${activeStock?.lotNumber || ''}`}
        period={`${t('Arrival')}: ${activeStock?.arrivalDate || activeStock?.date || t('N/A')}`}
        filters={[
          { label: 'Beopari/Grower', value: activeStock?.supplierName || 'N/A' },
          { label: 'Produce Item', value: `${activeStock?.productName || t('Produce')} (${t(activeStock?.unit || 'units')})` },
          { label: 'Clearance Status', value: `${lotClearanceRate}% Cleared` }
        ]}
        summaryMetrics={[
          { label: 'Total Received', value: `${activeStock?.quantity || 0} ${t(activeStock?.unit || 'units')}` },
          { label: 'Units Sold', value: `${lotQtySold.toLocaleString()} units` },
          { label: 'Gross Sales Value', value: `Rs. ${lotGrossSales.toLocaleString()}` },
          { label: 'Net Beopari/Grower Payable', value: `Rs. ${computedNetPayable.toLocaleString()}` }
        ]}
      />

      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />{t("Loading Consignment Lot Sheet Data...")}</div>
      ) : !activeStock ? (
        <div className="py-16 text-center text-slate-400 italic bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800">{t("No consignment lot record found.")}</div>
      ) : (
        <div className="space-y-6">
          {/* Lot Overview KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-black uppercase text-slate-500 block">{t("Arrived Qty")}</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1">
                {arrivedQty} <span className="text-[10px] font-normal text-slate-500">{t(activeStock.unit || 'units')}</span>
              </p>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-black uppercase text-slate-500 block">{t("Net Sold Qty")}</span>
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {lotQtySold} <span className="text-[10px] font-normal text-slate-500">{t(activeStock.unit || 'units')}</span>
              </p>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-black uppercase text-slate-500 block">{t("Returned Produce")}</span>
              <p className="text-base font-black text-rose-600 dark:text-rose-400 mt-1">
                {returnedLotQty} <span className="text-[10px] font-normal text-slate-500">{t(activeStock.unit || 'units')}</span>
              </p>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-black uppercase text-slate-500 block">{t("Remaining Balance")}</span>
              <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-1">
                {remainingQty} <span className="text-[10px] font-normal text-slate-500">{t(activeStock.unit || 'units')}</span>
              </p>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-black uppercase text-slate-500 block">{t("Net Gross Turnover")}</span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1">
                Rs. {lotGrossSales.toLocaleString()}
              </p>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-black uppercase text-slate-500 block">{t("Broker Commission")}</span>
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1">
                Rs. {totalBrokerCommission.toLocaleString()}
              </p>
              <p className="text-[9px] opacity-60 font-semibold uppercase mt-0.5">{t("Buyer: Rs.")}{netBuyerCommission.toLocaleString()}{' '}{t("| Supp: Rs.")}{' '}{Math.round(computedSupplierCommDeduction).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Date-Wise Consignment Sales Breakdown */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                <Calendar size={16} className="text-[#4F46E5]" />
                <span>{t("Date-Wise Consignment Sales & Record Batch Invoices Breakdown")}</span>
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                {sortedDateGroups.length}{t("Active Sales Date(s) Recorded")}</span>
            </div>

            {sortedDateGroups.length === 0 ? (
              <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 italic">{t("No batch sales recorded for this lot yet.")}</div>
            ) : (
              sortedDateGroups.map((dateGroup) => (
                <div key={dateGroup.date} className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-0">
                  {/* Date Header Banner */}
                  <div className="bg-slate-50 dark:bg-[#0F172A]/80 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-[#4F46E5]/10 text-[#4F46E5]">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{t("Sales Date:")}{dateGroup.date}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {dateGroup.sales.length}{t("Batch Invoice(s) Created On This Date")}</p>
                      </div>
                    </div>

                    {/* Date Summary Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-xl font-extrabold border border-indigo-500/20">{t("Total Sold:")}<span className="font-black text-slate-900 dark:text-white">{dateGroup.totalQty}</span> {t(activeStock.unit || 'units')}
                      </div>
                      <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-xl font-extrabold border border-amber-500/20">{t("Walk-In Customers:")}<span className="font-black text-slate-900 dark:text-white">{dateGroup.walkInQty}</span> {t(activeStock.unit || 'units')}
                      </div>
                      <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl font-extrabold border border-emerald-500/20">{t("Registered Customers:")}<span className="font-black text-slate-900 dark:text-white">{dateGroup.registeredQty}</span> {t(activeStock.unit || 'units')}
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl font-black text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">{t("Turnover: Rs.")}{(dateGroup.grossValue || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Date Invoices Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[9px] border-b border-slate-200 dark:border-slate-800">
                          <th className="py-3 px-4">{t("Invoice No")}</th>
                          <th className="py-3 px-4">{t("Buyer / Customer Name")}</th>
                          <th className="py-3 px-4">{t("Customer Type")}</th>
                          <th className="py-3 px-4 text-right">{t("Qty Sold")}</th>
                          <th className="py-3 px-4 text-right">{t("Sale Price")}</th>
                          <th className="py-3 px-4 text-right">{t("Gross Amount")}</th>
                          <th className="py-3 px-4 text-right text-indigo-500">{t("Commission")}</th>
                          <th className="py-3 px-4 text-right">{t("Net Receivable")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                        {dateGroup.sales.map((s, idx) => {
                          const invNum = s.invoiceNumber || (s.id || s._id || '').substring(0, 8).toUpperCase();
                          const gross = s.grossSale || (s.quantity * s.saleRate) || 0;
                          const comm = s.commissionAmount || s.commission || 0;
                          const net = s.netSale || s.totalAmount || (gross - comm);

                          return (
                            <tr key={s.id || s._id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4 font-mono font-black text-slate-900 dark:text-white">
                                INV-{invNum}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                                {s.customerName || s.walkInName || 'Walk-In Customer'}
                                {s.isWalkIn && s.walkInVehicle && (
                                  <span className="block text-[9px] opacity-60 font-mono text-slate-500">{t("Vehicle:")}{s.walkInVehicle}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-block text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  s.isWalkIn ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                                }`}>
                                  {s.isWalkIn ? 'Walk-In Customer' : 'Registered Customer'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                                {s.quantity} <span className="text-[9px] opacity-60 font-normal">{t(activeStock.unit || 'units')}</span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold">
                                Rs. {(s.saleRate || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                                Rs. {(gross || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                Rs. {(comm || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                                Rs. {(net || 0).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

