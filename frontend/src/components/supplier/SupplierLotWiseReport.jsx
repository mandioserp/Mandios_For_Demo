import React, { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { exportToCSV } from '../../utils/navigation.js';
import api from '../../utils/api.js';
import { buildPrintReportHeaderHtml } from '../common/PrintReportHeader.jsx';
import urduFontUrl from '../../assets/fonts/NotoNastaliqUrdu-wght.ttf?url';
import {
  Boxes, Layers, Search, Filter, ArrowUpDown, Eye, ArrowLeft, Printer,
  Download, CheckCircle2, Calendar, Clock, DollarSign, ShoppingBag,
  Check, RefreshCw, ShieldCheck
} from 'lucide-react';

export default function SupplierLotWiseReport({
  supplies = [],
  sales = [],
  returns = [],
  products = [],
  supplierProfile = null,
  invoiceSettings = null,
  onRefreshData,
  showToast
}) {
  const { t, language } = useLanguage();

  const [selectedLotId, setSelectedLotId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  const [businessProfile, setBusinessProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api.get('/settings/business')
      .then((res) => {
        if (isMounted && res.data) setBusinessProfile(res.data);
      })
      .catch(() => {
        // Keep optional business details blank if settings are unavailable.
      });
    return () => { isMounted = false; };
  }, []);

  // Map of lot IDs to linked sales
  const salesByLotMap = useMemo(() => {
    const map = {};
    (sales || []).forEach(sale => {
      const sStockId = sale.stockEntryId ? String(sale.stockEntryId) : null;
      const sLotNum = sale.stockLotNumber ? String(sale.stockLotNumber) : null;

      (supplies || []).forEach(lot => {
        const lotId = String(lot.id || lot._id || '');
        const lotNum = lot.lotNumber ? String(lot.lotNumber) : null;

        if ((sStockId && sStockId === lotId) || (sLotNum && lotNum && sLotNum === lotNum)) {
          if (!map[lotId]) map[lotId] = [];
          if (!map[lotId].some(s => (s.id || s._id) === (sale.id || sale._id))) {
            map[lotId].push(sale);
          }
        }
      });
    });
    return map;
  }, [sales, supplies]);

  // Map of lot IDs to linked approved returns
  const returnsByLotMap = useMemo(() => {
    const map = {};
    (returns || []).forEach(ret => {
      if (ret.status !== 'Approved' || ret.isDeleted) return;
      const rStockId = ret.stockEntryId ? String(ret.stockEntryId) : null;
      const rSaleId = ret.saleId ? String(ret.saleId) : null;

      // Find stockEntryId via sale if not directly on return
      let matchedStockId = rStockId;
      if (!matchedStockId && rSaleId) {
        const foundSale = (sales || []).find(s => String(s.id || s._id) === rSaleId);
        if (foundSale?.stockEntryId) {
          matchedStockId = String(foundSale.stockEntryId);
        }
      }

      (supplies || []).forEach(lot => {
        const lotId = String(lot.id || lot._id || '');
        const lotNum = lot.lotNumber ? String(lot.lotNumber) : null;
        const isMatched = (matchedStockId && matchedStockId === lotId) ||
                          (rStockId && rStockId === lotId) ||
                          (lotNum && ret.stockLotNumber && String(ret.stockLotNumber) === lotNum);

        if (isMatched) {
          if (!map[lotId]) map[lotId] = [];
          if (!map[lotId].some(r => (r.id || r._id) === (ret.id || ret._id))) {
            map[lotId].push(ret);
          }
        }
      });
    });
    return map;
  }, [returns, sales, supplies]);

  // Compute metrics for any given lot
  const getLotMetrics = (lot) => {
    const lotId = String(lot.id || lot._id || '');
    const lotSales = salesByLotMap[lotId] || [];
    const lotReturns = returnsByLotMap[lotId] || [];

    const arrivedQty = Number(lot.quantity) || 0;
    const rawSoldQty = lotSales.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
    const returnedQty = lotReturns.reduce((acc, curr) => acc + (Number(curr.produceReturnedQty) || 0), 0);
    const qtySold = Math.max(0, rawSoldQty - returnedQty);

    const remainingQty = lot.remainingQuantity !== undefined ? Number(lot.remainingQuantity) : Math.max(0, arrivedQty - qtySold);

    const rawGrossSales = lotSales.reduce((acc, curr) => acc + (Number(curr.grossSale) || (Number(curr.quantity) * Number(curr.saleRate)) || 0), 0);
    const returnedGrossValue = lotReturns.reduce((acc, curr) => acc + (Number(curr.grossReturnAmount) || (Number(curr.produceReturnedQty || 0) * Number(curr.saleRate || 0))), 0);
    const grossSales = Math.max(0, Math.round((rawGrossSales - returnedGrossValue) * 100) / 100);

    let statusKey = 'active'; // 'active' | 'partial' | 'fully_sold' | 'settled'
    if (lot.isSettled) {
      statusKey = 'settled';
    } else if (remainingQty <= 0 && qtySold > 0) {
      statusKey = 'fully_sold';
    } else if (qtySold > 0) {
      statusKey = 'partial';
    }

    const commType = lot.supplierCommissionType || 'Percentage';
    const commValNum = Number(lot.supplierCommissionValue) || 0;
    let computedComm = 0;
    if (commType === 'Percentage') {
      computedComm = grossSales * (commValNum / 100);
    } else if (commType === 'Per Unit') {
      computedComm = qtySold * commValNum;
    } else if (commType === 'Fixed Amount') {
      computedComm = commValNum;
    }

    let computedExpenses = 0;
    const expenseList = [];
    if (lot.lotExpenses && typeof lot.lotExpenses === 'object') {
      Object.entries(lot.lotExpenses).forEach(([key, val]) => {
        const num = Number(val);
        if (!isNaN(num) && num > 0) {
          computedExpenses += num;
          expenseList.push({ name: key, amount: num });
        }
      });
    }

    const totalDeductions = Math.round((computedComm + computedExpenses) * 100) / 100;
    const netPayable = Math.round(Math.max(0, grossSales - totalDeductions) * 100) / 100;

    return {
      lotSales,
      lotReturns,
      arrivedQty,
      rawSoldQty,
      returnedQty,
      qtySold,
      remainingQty,
      rawGrossSales,
      returnedGrossValue,
      grossSales,
      computedComm,
      computedExpenses,
      expenseList,
      totalDeductions,
      netPayable,
      commType,
      commValNum,
      statusKey
    };
  };

  // Currently selected lot object
  const selectedLot = useMemo(() => {
    if (!selectedLotId) return null;
    return supplies.find(s => String(s.id || s._id) === String(selectedLotId));
  }, [selectedLotId, supplies]);

  // Filtered and sorted supplies list for the cards grid
  const filteredSupplies = useMemo(() => {
    let result = [...supplies];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(lot => {
        const lotNumStr = lot.lotNumber ? String(lot.lotNumber).toLowerCase() : '';
        const prodNameStr = lot.productName ? lot.productName.toLowerCase() : '';
        const dateStr = lot.date ? String(lot.date).toLowerCase() : '';
        return lotNumStr.includes(term) || prodNameStr.includes(term) || dateStr.includes(term);
      });
    }

    if (statusFilter !== 'All') {
      result = result.filter(lot => {
        const metrics = getLotMetrics(lot);
        if (statusFilter === 'Settled') return metrics.statusKey === 'settled';
        if (statusFilter === 'Fully Sold') return metrics.statusKey === 'fully_sold';
        if (statusFilter === 'Partially Sold') return metrics.statusKey === 'partial';
        if (statusFilter === 'Active') return metrics.statusKey === 'active';
        return true;
      });
    }

    result.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      if (dateA !== dateB) {
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      }
      return sortOrder === 'newest' ? 1 : -1;
    });

    return result;
  }, [supplies, searchTerm, statusFilter, sortOrder, salesByLotMap]);

  // Read-only calculations for currently selected lot
  const activeLotMetrics = useMemo(() => {
    if (!selectedLot) return null;
    return getLotMetrics(selectedLot);
  }, [selectedLot, salesByLotMap, returnsByLotMap]);

  // Action: Print Lot Sheet
  const handlePrintLotSheet = () => {
    if (!selectedLot || !activeLotMetrics) return;
    const win = window.open('', '', 'height=800,width=1000');
    if (!win) return;

    const {
      lotSales, lotReturns, arrivedQty, rawSoldQty, returnedQty, qtySold, remainingQty, rawGrossSales,
      returnedGrossValue, grossSales, commValNum, commType, computedComm, computedExpenses, expenseList, netPayable
    } = activeLotMetrics;

    const rowsHtml = lotSales.map(s => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 8px;">${s.date}</td>
        <td style="padding: 8px; font-weight: 600;">${s.invoiceNumber || (s.id || s._id || '').substring(0, 8)}</td>
        <td style="padding: 8px;">${s.customerName || s.walkInName || t('Walk-In Buyer')}</td>
        <td style="padding: 8px; text-align: right; font-weight: 700;">${s.quantity}</td>
        <td style="padding: 8px; text-align: right;">Rs. ${Number(s.saleRate).toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; font-weight: 800; color: #1E293B;">Rs. ${(s.grossSale || (s.quantity * s.saleRate)).toLocaleString()}</td>
      </tr>
    `).join('');

    const returnsRowsHtml = (lotReturns || []).map(r => {
      const rGross = Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0));
      return `
        <tr style="border-bottom: 1px solid #FECACA; background: #FEF2F2; color: #DC2626;">
          <td style="padding: 8px;">${r.date || t('N/A')}</td>
          <td style="padding: 8px; font-weight: 600;">${r.returnNumber || 'RET'}</td>
          <td style="padding: 8px;">${r.customerName || t('Customer Return')}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;">-${r.produceReturnedQty || 0}</td>
          <td style="padding: 8px; text-align: right;">Rs. ${Number(r.saleRate || 0).toLocaleString()}</td>
          <td style="padding: 8px; text-align: right; font-weight: 800;">-Rs. ${rGross.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    win.document.write(`
      <html lang="${language}" dir="${language === 'ur' ? 'rtl' : 'ltr'}">
        <head>
          <title>${t('Consignment Lot Report')} — ${t('Lot Number')} ${selectedLot.lotNumber || (selectedLot.id || selectedLot._id).substring(0, 8)}</title>
          <style>
            @font-face { font-family: "Noto Nastaliq Urdu"; src: url("${urduFontUrl}") format("truetype"); font-weight: 100 900; }
            body { font-family: ${language === 'ur' ? '"Noto Nastaliq Urdu", "Noto Naskh Arabic", ' : ''}system-ui, -apple-system, sans-serif; font-size: 11px; color: #1E293B; padding: 24px; direction: ${language === 'ur' ? 'rtl' : 'ltr'}; line-height: ${language === 'ur' ? '1.8' : '1.5'}; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #F8FAFC; text-align: start; padding: 8px; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #CBD5E1; color: #64748B; }
            .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
            .stat-card { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px; border-radius: 8px; }
            .stat-title { font-size: 9px; text-transform: uppercase; color: #64748B; font-weight: 700; }
            .stat-val { font-size: 14px; font-weight: 900; color: #0F172A; margin-top: 2px; }
            .totals-box { margin-top: 20px; border-top: 2px solid #1E293B; padding-top: 12px; font-size: 11px; width: 360px; margin-inline-start: auto; }
            .flex-between { display: flex; justify-content: space-between; padding: 4px 0; }
            bdi, .numeric { direction: ltr; unicode-bidi: isolate; }
          </style>
        </head>
        <body>
          ${buildPrintReportHeaderHtml({
            title: `${t('Consignment Lot Sheet Report')} — ${t('Lot Number')} #${selectedLot.lotNumber || (selectedLot.id || selectedLot._id).substring(0, 8)}`,
            period: selectedLot.date || selectedLot.arrivalDate || '',
            filters: [
              { label: t('Beopari/Grower'), value: supplierProfile?.name || selectedLot.supplierName || '' },
              { label: t('Product'), value: selectedLot.productName || '' }
            ],
            profile: businessProfile
              ? { ...businessProfile, logo: businessProfile.logo || invoiceSettings?.companyLogo }
              : (invoiceSettings?.companyLogo ? { logo: invoiceSettings.companyLogo } : null),
            labels: {
              arthiCode: t('ARHTI CODE'),
              date: t('Date'),
              generated: t('Generated'),
              footer: t('MandiOS Business Report'),
              proprietor: t('Proprietor'),
              period: t('Report Period'),
              locale: language === 'ur' ? 'ur-PK' : 'en-GB'
            }
          })}

          <div class="grid-3">
            <div class="stat-card">
              <div class="stat-title">${t('Total Arrived Crates')}</div>
              <div class="stat-val"><bdi>${arrivedQty}</bdi> ${t('Crates')}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">${t('Crates Sold / Remaining')}</div>
              <div class="stat-val" style="color: #4F46E5;"><bdi>${qtySold}</bdi> ${t('Sold')} / <bdi>${remainingQty}</bdi> ${t('Remaining')}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">${t('Settlement Status')}</div>
              <div class="stat-val" style="color: ${selectedLot.isSettled ? '#10B981' : '#F59E0B'};">
                ${selectedLot.isSettled ? `✓ ${t('Settlement Recorded')}` : t('Pending Settlement')}
              </div>
            </div>
          </div>

          <h4 style="font-size: 11px; font-weight: 800; text-transform: uppercase; margin: 16px 0 8px 0; color: #334155;">
            ${t('Crate Sales Breakdown ({{count}} Transactions)', { count: lotSales.length })}
          </h4>

          <table>
            <thead>
              <tr>
                <th>${t('Date')}</th>
                <th>${t('Invoice #')}</th>
                <th>${t('Customer / Buyer')}</th>
                <th style="text-align: end;">${t('Qty Sold')}</th>
                <th style="text-align: end;">${t('Rate (Rs)')}</th>
                <th style="text-align: end;">${t('Gross Sale (Rs)')}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94A3B8;">${t('No sales recorded for this lot yet.')}</td></tr>`}
              ${returnsRowsHtml}
            </tbody>
          </table>

          <div class="totals-box">
            <div class="flex-between"><span>${t('Total Gross Crate Sales')}:</span> <strong><bdi>Rs. ${grossSales.toLocaleString()}</bdi></strong></div>
            ${returnedGrossValue > 0 ? `<div class="flex-between" style="color: #64748B; font-size: 10px;"><span>(${t('Raw Sales')}: <bdi>Rs. ${rawGrossSales.toLocaleString()}</bdi> - ${t('Returns')}: <bdi>Rs. ${returnedGrossValue.toLocaleString()}</bdi>)</span></div>` : ''}
            <div class="flex-between" style="color: #E11D48;"><span>${t('Less Beopari/Grower Commission ({{rate}})', { rate: `${commValNum}${commType === 'Percentage' ? '%' : (commType === 'Per Unit' ? ' Rs/Unit' : ' Fixed')}` })}:</span> <strong><bdi>- Rs. ${computedComm.toLocaleString()}</bdi></strong></div>
            ${computedExpenses > 0 ? `
              <div class="flex-between" style="color: #E11D48;"><span>${t('Less Other Lot Expenses')}:</span> <strong><bdi>- Rs. ${computedExpenses.toLocaleString()}</bdi></strong></div>
              ${expenseList.map(e => `<div class="flex-between" style="padding-inline-start: 12px; color: #64748B; font-size: 10px;"><span>• ${e.name}:</span> <span><bdi>- Rs. ${e.amount.toLocaleString()}</bdi></span></div>`).join('')}
            ` : ''}
            <div class="flex-between" style="border-top: 1px solid #CBD5E1; margin-top: 6px; padding-top: 6px; font-size: 12px; font-weight: 900; color: #4F46E5;">
              <span>${t('Net Payable to Beopari/Grower')}:</span>
              <span><bdi>Rs. ${netPayable.toLocaleString()}</bdi></span>
            </div>
          </div>

          <div style="margin-top: 40px; display: flex; justify-content: space-between; color: #94A3B8; font-size: 9px;">
            <span style="border-top: 1px solid #CBD5E1; padding-top: 4px; width: 140px; text-align: center;">${t('Authorized Signatory')}</span>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.document.fonts.ready.then(() => {
      win.print();
      win.close();
    });
  };

  // Action: Export Lot CSV
  const handleExportCSV = () => {
    if (!selectedLot || !activeLotMetrics) return;
    const lotNum = selectedLot.lotNumber || (selectedLot.id || selectedLot._id).substring(0, 8);
    const headers = [
      t('Lot Number'), t('Beopari/Grower'), t('Product'), t('Date'), t('Invoice No'),
      t('Customer Name'), t('Quantity Sold'), t('Sale Rate (Rs)'), t('Gross Sale (Rs)')
    ];
    const rows = activeLotMetrics.lotSales.map(s => [
      lotNum,
      supplierProfile?.name || selectedLot.supplierName,
      selectedLot.productName,
      s.date,
      s.invoiceNumber || (s.id || s._id || '').substring(0, 8),
      s.customerName || s.walkInName || t('Walk-In Buyer'),
      s.quantity,
      s.saleRate,
      s.grossSale || (s.quantity * s.saleRate)
    ]);
    (activeLotMetrics.lotReturns || []).forEach(r => {
      const rGross = Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0));
      rows.push([
        lotNum,
        supplierProfile?.name || selectedLot.supplierName,
        selectedLot.productName,
        r.date,
        r.returnNumber || t('RETURN'),
        r.customerName || t('Customer Return'),
        -(r.produceReturnedQty || 0),
        r.saleRate || 0,
        -rGross
      ]);
    });
    // Add summary calculations to CSV
    rows.push([]);
    rows.push([t('SUMMARY & DEDUCTIONS FOR LOT'), `#${lotNum}`, `${t('Product')}:`, selectedLot.productName]);
    rows.push([t('Total Gross Crate Sales (Rs)'), activeLotMetrics.grossSales]);
    rows.push([t('Beopari/Grower Commission (Rs)'), activeLotMetrics.computedComm]);
    rows.push([t('Total Other Lot Expenses (Rs)'), activeLotMetrics.computedExpenses]);
    activeLotMetrics.expenseList.forEach(e => {
      rows.push([`${t('Expense')}: ${e.name} (Rs)`, e.amount]);
    });
    rows.push([t('Net Payable to Beopari/Grower (Rs)'), activeLotMetrics.netPayable]);

    exportToCSV(`Lot_Report_${lotNum}`, headers, rows);
  };

  // Render Status Badge Component
  const renderStatusBadge = (statusKey) => {
    switch (statusKey) {
      case 'settled':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center space-x-1 shrink-0">
            <CheckCircle2 size={12} />
            <span>{t('Recorded Settlement')}</span>
          </span>
        );
      case 'fully_sold':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 flex items-center space-x-1 shrink-0">
            <Check size={12} />
            <span>{t('Fully Sold (Pending Settlement)')}</span>
          </span>
        );
      case 'partial':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center space-x-1 shrink-0">
            <Clock size={12} />
            <span>{t('Partially Sold')}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 flex items-center space-x-1 shrink-0">
            <Boxes size={12} />
            <span>{t('In Stock / Active')}</span>
          </span>
        );
    }
  };

  // --------------------------------------------------------------------------
  // VIEW 2: DETAILED LOT VIEW (READ ONLY)
  // --------------------------------------------------------------------------
  if (selectedLot && activeLotMetrics) {
    const {
      lotSales, lotReturns, arrivedQty, rawSoldQty, returnedQty, qtySold, remainingQty,
      rawGrossSales, returnedGrossValue, grossSales,
      commType, commValNum, computedComm, computedExpenses, expenseList,
      totalDeductions, netPayable
    } = activeLotMetrics;

    const lotNumLabel = selectedLot.lotNumber ? `#LOT-${selectedLot.lotNumber}` : `#LOT-${(selectedLot.id || selectedLot._id).substring(0, 8).toUpperCase()}`;

    return (
      <div className="space-y-6">
        {/* Top Control Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setSelectedLotId(null)}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all"
              title={t('Back to All Lots')}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5] dark:text-indigo-400 bg-[#4F46E5]/10 px-2.5 py-0.5 rounded-lg">
                  {lotNumLabel}
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{selectedLot.date}</span>
                <span className="text-slate-400 text-xs">•</span>
                {renderStatusBadge(selectedLot.isSettled ? 'settled' : (remainingQty <= 0 && qtySold > 0 ? 'fully_sold' : (qtySold > 0 ? 'partial' : 'active')))}
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {selectedLot.productName}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
            >
              <Download size={14} />
              <span>{t('EXPORT CSV')}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintLotSheet}
              className="flex items-center space-x-1.5 bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-500/10"
            >
              <Printer size={14} />
              <span>{t('PRINT LOT SHEET')}</span>
            </button>
          </div>
        </div>

        {/* 5 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('Total Arrived Crates')}</p>
            <h3 className="text-xl font-black mt-1 text-slate-900 dark:text-white"><bdi>{arrivedQty}</bdi> <span className="text-xs font-normal opacity-60">{t('Crates')}</span></h3>
            <p className="text-[10px] text-slate-400 mt-1">{t('Arrival Date')}: <bdi>{selectedLot.date}</bdi></p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('Crates Sold / Remaining')}</p>
            <h3 className="text-xl font-black mt-1 text-blue-500"><bdi>{qtySold}</bdi> <span className="text-xs text-slate-400 font-normal">/ <bdi>{remainingQty}</bdi> {t('left')}</span></h3>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${arrivedQty > 0 ? Math.min(100, (qtySold / arrivedQty) * 100) : 0}%` }} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('Gross Crate Sales')}</p>
            <h3 className="text-xl font-black mt-1 text-slate-900 dark:text-white">
              {grossSales > 0 ? <bdi>Rs. {grossSales.toLocaleString()}</bdi> : <span className="text-slate-400 font-semibold italic text-sm">{t('Not Available / Pending')}</span>}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">{t('Sales entries recorded', { count: lotSales.length })}</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('Commission Deducted')}</p>
            <h3 className="text-xl font-black mt-1 text-rose-500 dark:text-rose-400">
              <bdi>Rs. {computedComm.toLocaleString()}</bdi>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">{t('Rate')}: <bdi>{commValNum} {commType === 'Percentage' ? '%' : commType === 'Per Unit' ? t('Rs / unit') : t('Rs Fixed')}</bdi></p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('Other Lot Expenses')}</p>
            <h3 className="text-xl font-black mt-1 text-rose-500 dark:text-rose-400">
              <bdi>Rs. {computedExpenses.toLocaleString()}</bdi>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">{expenseList.length > 0 ? t('Itemized expenses', { count: expenseList.length }) : t('No extra charges')}</p>
          </div>
        </div>

        {/* Consignment Settlement Deductions & Other Lot Expenses Audit Panel */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
                <DollarSign size={16} className="text-[#4F46E5]" />
                <span>{t('Consignment Settlement Deductions & Other Lot Expenses')}</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('Broker commission and operational freight/labor expenses charged to this consignment lot')}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('Total Deductions')}</span>
              <span className="text-sm font-black text-rose-500"><bdi>-Rs. {totalDeductions.toLocaleString()}</bdi></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Beopari Commission Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t('Beopari/Grower Commission')}</span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('Rate')}: <span className="font-bold text-slate-900 dark:text-white"><bdi>{commValNum} {commType === 'Percentage' ? '%' : (commType === 'Per Unit' ? t('Rs/unit') : t('Rs Fixed'))}</bdi></span>
                </p>
              </div>
              <span className="text-base font-black text-rose-500"><bdi>-Rs. {computedComm.toLocaleString()}</bdi></span>
            </div>

            {/* Other Lot Expenses Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">{t('Total Other Lot Expenses')}</span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {expenseList.length > 0 ? t('Itemized expenses', { count: expenseList.length }) : t('No Additional Expenses')}
                </p>
              </div>
              <span className="text-base font-black text-rose-500"><bdi>-Rs. {computedExpenses.toLocaleString()}</bdi></span>
            </div>
          </div>

          {/* Itemized Other Lot Expenses if present */}
          {expenseList.length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">{t('Itemized Lot Charges Breakdown')}:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {expenseList.map((exp, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{t(exp.name)}</span>
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400"><bdi>Rs. {exp.amount.toLocaleString()}</bdi></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Net Settlement Math Summary */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
              <span className="text-xs font-bold">{t('Net Calculated Payable to Beopari/Grower for this Lot')}:</span>
            </div>
            <div className="text-right flex items-center space-x-2">
              <span className="text-[11px] text-slate-400 font-semibold">({t('Gross')}: <bdi>Rs. {grossSales.toLocaleString()}</bdi> - {t('Ded')}: <bdi>Rs. {totalDeductions.toLocaleString()}</bdi>) =</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400"><bdi>Rs. {netPayable.toLocaleString()}</bdi></span>
            </div>
          </div>
        </div>

        {/* Returned Stock Deductions Table (if any returns exist) */}
        {lotReturns && lotReturns.length > 0 && (
          <div className="bg-white dark:bg-[#1E293B] border border-rose-500/30 rounded-2xl overflow-hidden space-y-3 p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                <span>{t('Returned Stock Value Deductions', { count: lotReturns.length })}</span>
              </h3>
              <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                <bdi>-Rs. {returnedGrossValue.toLocaleString()}</bdi> ({returnedQty} {t('Crates Returned')})
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold uppercase text-[9px] border-b border-rose-200 dark:border-rose-900/50">
                    <th className="py-2.5 px-3">{t('Return #')}</th>
                    <th className="py-2.5 px-3">{t('Date')}</th>
                    <th className="py-2.5 px-3">{t('Customer')}</th>
                    <th className="py-2.5 px-3 text-right">{t('Returned Qty')}</th>
                    <th className="py-2.5 px-3 text-right">{t('Sale Rate')}</th>
                    <th className="py-2.5 px-3 text-right text-rose-600">{t('Gross Return Minus')}</th>
                    <th className="py-2.5 px-3">{t('Condition')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100 dark:divide-rose-900/30 text-slate-700 dark:text-slate-300">
                  {lotReturns.map((r, idx) => {
                    const rGross = Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0));
                    return (
                      <tr key={r.id || r._id || idx} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20 text-[11px]">
                        <td className="py-2.5 px-3 font-mono font-bold">{r.returnNumber || 'RET'}</td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500"><bdi>{r.date}</bdi></td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{r.customerName || t('Customer Return')}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-500"><bdi>-{r.produceReturnedQty || 0}</bdi> {t('Crates')}</td>
                        <td className="py-2.5 px-3 text-right"><bdi>Rs. {Number(r.saleRate || 0).toLocaleString()}</bdi></td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-600 dark:text-rose-400"><bdi>-Rs. {rGross.toLocaleString()}</bdi></td>
                        <td className="py-2.5 px-3">
                          <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-600">
                            {t(r.produceCondition || 'Good')} ({t('Restocked')})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Crate Sales Breakdown Table */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
              <ShoppingBag size={18} className="text-[#4F46E5]" />
              <span>{t('Crate Sales Breakdown ({{count}} Transactions)', { count: lotSales.length })}</span>
            </h3>
            <span className="text-xs text-slate-500 font-semibold"><bdi>{qtySold}</bdi> {t('Crates Sold')} / <bdi>{arrivedQty}</bdi> {t('Total')}</span>
          </div>

          {lotSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                    <th className="py-3 px-4">{t('Date')}</th>
                    <th className="py-3 px-4">{t('Invoice #')}</th>
                    <th className="py-3 px-4">{t('Customer / Buyer')}</th>
                    <th className="py-3 px-4 text-right">{t('Quantity Sold')}</th>
                    <th className="py-3 px-4 text-right">{t('Sale Rate (Rs)')}</th>
                    <th className="py-3 px-4 text-right">{t('Gross Sale Value')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/30 text-slate-700 dark:text-slate-300">
                  {lotSales.map((s, idx) => {
                    const gross = s.grossSale || (s.quantity * s.saleRate);
                    return (
                      <tr key={s.id || s._id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400"><bdi>{s.date}</bdi></td>
                        <td className="py-3 px-4 font-bold text-indigo-500"><bdi>{s.invoiceNumber || (s.id || s._id || '').substring(0, 8)}</bdi></td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{s.customerName || s.walkInName || t('Walk-In Buyer')}</td>
                        <td className="py-3 px-4 text-right font-bold text-blue-500"><bdi>{s.quantity}</bdi> {t('Crates')}</td>
                        <td className="py-3 px-4 text-right"><bdi>Rs. {Number(s.saleRate).toLocaleString()}</bdi></td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900 dark:text-white"><bdi>Rs. {gross.toLocaleString()}</bdi></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <Boxes size={32} className="mx-auto text-slate-400 opacity-60" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('No Crate Sales Recorded Yet')}</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {t('This lot is currently in stock. Available Information:')} <strong>{t('Arrived Quantity')}: <bdi>{arrivedQty}</bdi> {t('Crates')}</strong>.
                {t('Crate sales transactions & settlement data will automatically populate as sales occur.')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 1: CARDS GRID VIEW (All Lots Sent by Supplier)
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black uppercase tracking-wider flex items-center space-x-2 text-slate-900 dark:text-white">
            <Layers className="text-[#4F46E5]" size={22} />
            <span>{t('Lot Wise Consignment Reports')}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Read-only lot tracking, crate sales breakdown, and arrival logs for all lots sent by your account')}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshData}
          className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
        >
          <RefreshCw size={13} />
          <span>{t('REFRESH LOTS')}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('Search lots by Lot #, Product name, or Date...')}
            className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 rtl:pl-4 rtl:pr-10 py-2.5 text-xs outline-none focus:border-[#4F46E5] font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center space-x-1 bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
            <Filter size={14} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="All">{t('All Statuses')}</option>
              <option value="Active">{t('Active / In Stock')}</option>
              <option value="Partially Sold">{t('Partially Sold')}</option>
              <option value="Fully Sold">{t('Fully Sold')}</option>
              <option value="Settled">{t('Settlement Recorded')}</option>
            </select>
          </div>

          {/* Sort Order */}
          <button
            type="button"
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center space-x-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all"
          >
            <ArrowUpDown size={13} className="text-[#4F46E5]" />
            <span>{sortOrder === 'newest' ? t('Newest First') : t('Oldest First')}</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredSupplies.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSupplies.map(lot => {
            const lotId = String(lot.id || lot._id || '');
            const metrics = getLotMetrics(lot);
            const lotNum = lot.lotNumber ? `#LOT-${lot.lotNumber}` : `#LOT-${lotId.substring(0, 6).toUpperCase()}`;

            return (
              <div
                key={lotId}
                onClick={() => setSelectedLotId(lotId)}
                className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 hover:border-[#4F46E5]/50 dark:hover:border-[#4F46E5]/50 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                {/* Top Badge Row */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#4F46E5] dark:text-indigo-400 bg-[#4F46E5]/10 px-2.5 py-1 rounded-lg">
                    {lotNum}
                  </span>
                  {renderStatusBadge(metrics.statusKey)}
                </div>

                {/* Product Name & Date */}
                <div className="space-y-1">
                  <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400 transition-colors">
                    {lot.productName}
                  </h4>
                  <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <Calendar size={13} />
                    <span>{t('Arrival Date')}: <bdi>{lot.date}</bdi></span>
                  </div>
                </div>

                {/* Crates Progress Bar */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500 dark:text-slate-400">{t('Total Crates')}:</span>
                    <span className="text-slate-900 dark:text-white font-extrabold"><bdi>{metrics.arrivedQty}</bdi> {t('Units')}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#4F46E5] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${metrics.arrivedQty > 0 ? Math.min(100, (metrics.qtySold / metrics.arrivedQty) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>{t('Sold')}: <bdi>{metrics.qtySold}</bdi> {t('Crates')}</span>
                    <span>{t('Remaining')}: <bdi>{metrics.remainingQty}</bdi> {t('Crates')}</span>
                  </div>
                </div>

                {/* Sales, Commission & Expenses Summary Preview */}
                <div className="bg-slate-50 dark:bg-[#0F172A] p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('Gross Crate Sales')}</span>
                      <strong className="text-slate-900 dark:text-white">
                        {metrics.grossSales > 0 ? <bdi>Rs. {metrics.grossSales.toLocaleString()}</bdi> : <span className="text-slate-400 font-normal italic">{t('Pending')}</span>}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('Commission')}</span>
                      <strong className="text-rose-500 dark:text-rose-400 font-bold">
                        <bdi>-Rs. {metrics.computedComm.toLocaleString()}</bdi>
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px]">
                    <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
                      <span className="text-[10px] font-bold uppercase">{t('Other Exp')}:</span>
                      <span className="font-semibold text-rose-500 dark:text-rose-400">
                        {metrics.computedExpenses > 0 ? <bdi>-Rs. {metrics.computedExpenses.toLocaleString()}</bdi> : <bdi>{t('Rs. 0')}</bdi>}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">{t('Net')}:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                        <bdi>Rs. {metrics.netPayable.toLocaleString()}</bdi>
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Footer Action Link */}
                <div className="flex items-center justify-between text-xs font-bold text-[#4F46E5] dark:text-indigo-400 pt-1">
                  <span>{t('View Detailed Lot Sheet & Sales')}</span>
                  <Eye size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-3">
          <Boxes size={40} className="mx-auto text-slate-400 opacity-50" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{t('No Lot Reports Found')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'All'
              ? t('No consignment lots match your current search or filter criteria. Try clearing search keywords.')
              : t('You have not sent any crop or vegetable consignment lots to Lahore Mandi yet.')}
          </p>
        </div>
      )}
    </div>
  );
}
