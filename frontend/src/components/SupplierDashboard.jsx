import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { openSafePrintWindow, openSafePrintWindowFromElement } from '../utils/safePrint.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { Eye, Printer, FileText, CheckCircle2, Clock, AlertCircle, X, ArrowUpDown, Download, Boxes } from 'lucide-react';
import HomeTab from './HomeTab.jsx';
import { openReportInNewTab, exportToCSV } from '../utils/navigation.js';
import { calculateSupplyFinancials } from '../utils/commission.js';
import SupplierAnalytics from './analytics/SupplierAnalytics.jsx';
import SupplierLotWiseReport from './supplier/SupplierLotWiseReport.jsx';
import BusinessProfile from './settings/BusinessProfile.jsx';
import { downloadLedgerPDF } from '../utils/pdfExport.js';

export default function SupplierDashboard({ tab, setCurrentTab }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [supplies, setSupplies] = useState([]);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [products, setProducts] = useState([]);
  const [returns, setReturns] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [supplierProfile, setSupplierProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [toast, setToast] = useState(null);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'

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
      const [suppliersRes, invoiceSettingsRes, productsRes, paymentsRes, salesRes, returnsRes] = await Promise.all([
        api.get('/suppliers').catch(() => ({ data: [] })),
        api.get('/settings/invoice').catch(() => ({ data: null })),
        api.get('/products').catch(() => ({ data: [] })),
        api.get('/payments').catch(() => ({ data: [] })),
        api.get('/sales').catch(() => ({ data: [] })),
        api.get('/returns').catch(() => ({ data: [] }))
      ]);
      setInvoiceSettings(invoiceSettingsRes.data || null);
      setProducts(productsRes.data || []);
      setSales(salesRes.data || []);
      const returnsArr = Array.isArray(returnsRes.data) ? returnsRes.data : (returnsRes.data?.returns || []);
      setReturns(returnsArr);
      const linkedSupplier = suppliersRes.data.find(s => s.userId === user.id || s.userId === user._id);

      if (linkedSupplier) {
        setSupplierProfile(linkedSupplier);
        
        const ledgerRes = await api.get(`/reports?type=custom&startDate=2000-01-01&endDate=2050-12-31&supplierId=${linkedSupplier.id || linkedSupplier._id}`);
        setLedger(ledgerRes.data?.supplierLedger || []);
        
        const stockRes = await api.get('/stock');
        const supStock = stockRes.data.filter(s => s.supplierId === linkedSupplier.id || s.supplierId === linkedSupplier._id);
        setSupplies(supStock);

        const suppPayments = (paymentsRes.data || []).filter(p => 
          (p.partyId === linkedSupplier.id || p.partyId === linkedSupplier._id) && p.partyType === 'Supplier'
        );
        setPayments(suppPayments);
      } else {
        showToast(t('No beopari/grower profile linked to this login.'), 'error');
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

  const triggerPrintSupplyReport = () => {
    let totalGross = 0;
    let totalComm = 0;
    let totalExp = 0;
    let totalNet = 0;
    let totalQty = 0;

    const rowsHtml = supplies.map(p => {
      const fin = calculateSupplyFinancials(p, products);
      if (p.isSettled) {
        totalGross += fin.grossAmount;
        totalComm += fin.commissionAmount;
        totalExp += fin.totalExpenses;
        totalNet += fin.netPayable;
        totalQty += Number(p.quantity) || 0;
      }

      const commLabel = `${fin.commVal}${fin.commType === 'Percentage' ? '%' : (fin.commType === 'Per Unit' ? ` ${t('Rs/Unit')}` : ` ${t('Rs Fixed')}`)}`;
      const statusLabel = p.isSettled
        ? `<span style="color: #10B981; font-weight: 800;">${t('Recorded')}</span>`
        : `<span style="color: #F59E0B; font-weight: 700;">${t('Pending Settlement')}</span>`;

      return `
        <tr style="border-bottom: 1px solid #E2E8F0;">
          <td style="padding: 8px;">${p.date}</td>
          <td style="padding: 8px; font-weight: 600;">${p.productName}</td>
          <td style="padding: 8px; text-align: center;">${statusLabel}</td>
          <td style="padding: 8px; text-align: right;">${p.quantity}</td>
          <td style="padding: 8px; text-align: right;">${t('Rs.')} ${p.purchaseRate}</td>
          <td style="padding: 8px; text-align: right; font-weight: 600;">${t('Rs.')} ${fin.grossAmount.toLocaleString()}</td>
          <td style="padding: 8px; text-align: right;">${commLabel} (${t('Rs.')} ${fin.commissionAmount.toLocaleString()})</td>
          <td style="padding: 8px; text-align: right;">${t('Rs.')} ${fin.totalExpenses.toLocaleString()}</td>
          <td style="padding: 8px; text-align: right; font-weight: 800; color: #4F46E5;">${t('Rs.')} ${fin.netPayable.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const logoHtml = invoiceSettings?.companyLogo 
      ? `<img src="${invoiceSettings.companyLogo}" style="height: 40px; margin-bottom: 8px;" />` 
      : `<h2 style="font-size: 18px; font-weight: 900; color: #4F46E5; margin: 0;">${invoiceSettings?.header || t('Lahore Sabzi & Fruit Mandi Commission Agent')}</h2>`;

    const title = `${t('Supply History & Commission Report')} - ${supplierProfile?.name || t('Beopari/Grower')}`;
    const html = `
      <html>
        <head>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #1E293B; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #F8FAFC; text-align: start; padding: 8px; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #CBD5E1; color: #64748B; }
            .header { border-bottom: 2px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 16px; }
            .totals-box { margin-top: 20px; border-top: 2px solid #1E293B; padding-top: 12px; font-size: 11px; }
            .flex-between { display: flex; justify-content: space-between; padding: 4px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; margin: 4px 0 0 0;">${t('Official Agricultural Supply History & Commission Settlement Report')}</h3>
            <p style="margin: 4px 0 0 0; color: #64748B;">${t('Beopari/Grower:')} <strong>${supplierProfile?.name || t('N/A')}</strong> | ${t('Phone:')} ${supplierProfile?.phone || t('N/A')}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>${t('Date')}</th>
                <th>${t('Produce Name')}</th>
                <th style="text-align: center;">${t('Settlement Status')}</th>
                <th style="text-align: right;">${t('Qty')}</th>
                <th style="text-align: right;">${t('Purchase Rate')}</th>
                <th style="text-align: right;">${t('Gross Supply Amount')}</th>
                <th style="text-align: right;">${t('Commission Rate & Amt')}</th>
                <th style="text-align: right;">${t('Other Expenses')}</th>
                <th style="text-align: right;">${t('Net Payable Amount')}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="totals-box" style="width: 320px; margin-inline-start: auto;">
            <div class="flex-between"><span>${t('Recorded Shipments:')}</span> <strong>${supplies.filter(s => s.isSettled).length} ${t('of')} ${supplies.length} ${t('lots')} (${totalQty} ${t('units')})</strong></div>
            <div class="flex-between"><span>${t('Total Gross Supply Value:')}</span> <strong>${t('Rs.')} ${totalGross.toLocaleString()}</strong></div>
              <div class="flex-between" style="color: #E11D48;"><span>${t('Less Total Beopari/Grower Commission:')}</span> <strong>- ${t('Rs.')} ${totalComm.toLocaleString()}</strong></div>
            ${totalExp > 0 ? `<div class="flex-between" style="color: #E11D48;"><span>${t('Less Other Lot Expenses:')}</span> <strong>- ${t('Rs.')} ${totalExp.toLocaleString()}</strong></div>` : ''}
            <div class="flex-between" style="border-top: 1px solid #CBD5E1; margin-top: 6px; padding-top: 6px; font-size: 13px; font-weight: 900; color: #4F46E5;">
              <span>${t('Net Payable to Beopari/Grower:')}</span>
              <span>${t('Rs.')} ${totalNet.toLocaleString()}</span>
            </div>
          </div>

          <div style="margin-top: 40px; display: flex; justify-content: space-between; color: #94A3B8; font-size: 9px;">
            <span>${t('Report Generated on:')} ${new Date().toLocaleString(language === 'ur' ? 'ur-PK' : 'en-PK')}</span>
            <span style="border-top: 1px solid #CBD5E1; padding-top: 4px; width: 140px; text-align: center;">${t('Authorized Signatory')}</span>
          </div>
        </body>
      </html>
    `;
    const win = openSafePrintWindow(title, html, 'height=800,width=1000');
    if (!win) return;
    win.document.close();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  const handleExportSupplyCSV = () => {
    const supName = supplierProfile?.name || 'Beopari/Grower';
    const headers = [
      t('Date'),
      t('Produce Name'),
      t('Quantity Supplied'),
      t('Farmer Purchase Rate (Rs)'),
      t('Gross Supply Amount (Rs)'),
      t('Commission Rate/Type'),
      t('Commission Amount (Rs)'),
      t('Other Expenses (Rs)'),
      t('Net Payable Amount (Rs)')
    ];
    const rows = supplies.map(p => {
      const fin = calculateSupplyFinancials(p, products);
      const commLabel = `${fin.commVal}${fin.commType === 'Percentage' ? '%' : (fin.commType === 'Per Unit' ? ' Rs/Unit' : ' Fixed')}`;
      return [
        p.date,
        p.productName,
        p.quantity,
        p.purchaseRate,
        fin.grossAmount,
        commLabel,
        fin.commissionAmount,
        fin.totalExpenses,
        fin.netPayable
      ];
    });
    exportToCSV(`Supply_History_Report_${supName.replace(/\s+/g, '_')}`, headers, rows);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">{t("Opening Beopari/Grower Desk...")}</p>
      </div>
    );
  }

  if (!supplierProfile) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center space-x-3">
        <AlertCircle size={20} />
        <div>
          <h4 className="text-sm font-bold uppercase">{t("Account Link Error")}</h4>
          <p className="text-xs opacity-80 mt-0.5">{t("We could not locate an active Beopari/Grower Profile linked to your username. Contact Lahore Mandi Admin to link your login account!")}</p>
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

      {/* ----------------- TAB: BUSINESS PROFILE ----------------- */}
      {(tab === 'business_profile' || tab === 'business') && (
        <BusinessProfile showToast={showToast} />
      )}

      {/* ----------------- TAB: HOME ----------------- */}
      {tab === 'home' && (
        <HomeTab setCurrentTab={setCurrentTab} />
      )}

      {/* ----------------- TAB: DASHBOARD ----------------- */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <SupplierAnalytics
            supplies={supplies}
            payments={payments}
            supplierProfile={supplierProfile}
            products={products}
            ledger={ledger}
          />
        </div>
      )}

      {/* ----------------- TAB: SUPPLY HISTORY ----------------- */}
      {tab === 'supplies' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider">{t("My Agricultural Supply History")}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("Review all crop and vegetable shipments supplied to Lahore Mandi broker with commission settlement")}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                type="button"
                onClick={handleExportSupplyCSV}
                className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
              >
                <Download size={14} />
                <span>{t("EXPORT CSV")}</span>
              </button>
              <button 
                type="button"
                onClick={triggerPrintSupplyReport}
                className="flex items-center space-x-1.5 bg-[#4F46E5] hover:bg-[#4F46E5] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                <Printer size={14} />
                <span>{t("PRINT REPORT")}</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                    <th className="py-4 px-5">{t("Date")}</th>
                    <th className="py-4 px-5">{t("Produce Name")}</th>
                    <th className="py-4 px-5 text-center">{t("Settlement Status")}</th>
                    <th className="py-4 px-5 text-right">{t("Quantity")}</th>
                    <th className="py-4 px-5 text-right">{t("Purchase Rate")}</th>
                    <th className="py-4 px-5 text-right">{t("Gross Supply Value")}</th>
                    <th className="py-4 px-5 text-right">{t("Commission Rate & Amt")}</th>
                    <th className="py-4 px-5 text-right">{t("Other Lot Expenses")}</th>
                    <th className="py-4 px-5 text-right">{t("Net Payable Amount")}</th>
                    <th className="py-4 px-5 text-right">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/30 text-slate-700 dark:text-slate-300">
                  {supplies.map(p => {
                    const fin = calculateSupplyFinancials(p, products);
                    const commLabel = `${fin.commVal}${fin.commType === 'Percentage' ? '%' : (fin.commType === 'Per Unit' ? ' Rs/Unit' : ' Rs Fixed')}`;
                    return (
                      <tr key={p.id || p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                        <td className="py-3.5 px-5 font-bold text-slate-500 dark:text-slate-400">{p.date}</td>
                        <td className="py-3.5 px-5 font-semibold text-[#1E293B] dark:text-slate-100">{p.productName}</td>
                        <td className="py-3.5 px-5 text-center">
                          {p.isSettled ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              {t("✓ Recorded")}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              {t("Pending Settlement")}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-blue-400">{p.quantity}</td>
                        <td className="py-3.5 px-5 text-right">{t("Rs.")} {p.purchaseRate}</td>
                        <td className="py-3.5 px-5 text-right font-bold text-slate-800 dark:text-slate-200">
                          {p.isSettled ? `Rs. ${fin.grossAmount.toLocaleString()}` : <span className="text-slate-400 italic">{t("Unrecorded")}</span>}
                        </td>
                        <td className="py-3.5 px-5 text-right font-semibold text-rose-500 dark:text-rose-400">
                          {p.isSettled ? `${commLabel} (-Rs. ${fin.commissionAmount.toLocaleString()})` : '-'}
                        </td>
                        <td className="py-3.5 px-5 text-right font-semibold text-rose-500 dark:text-rose-400">
                          {p.isSettled ? (
                            fin.totalExpenses > 0 ? (
                              <div className="flex flex-col items-end">
                                <span>{t("-Rs.")} {fin.totalExpenses.toLocaleString()}</span>
                                {p.lotExpenses && typeof p.lotExpenses === 'object' && Object.keys(p.lotExpenses).length > 0 && (
                                  <span className="text-[9px] text-slate-400 font-normal">
                                    ({Object.entries(p.lotExpenses).filter(([_, v]) => Number(v) > 0).map(([k, v]) => `${k}: Rs.${v}`).join(', ')})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-normal">{t("Rs. 0")}</span>
                            )
                          ) : (
                            <span className="text-slate-400 font-normal italic">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right font-black text-[#4F46E5] dark:text-indigo-400">
                          {p.isSettled ? `Rs. ${fin.netPayable.toLocaleString()}` : <span className="text-slate-400 font-normal italic">{t("Pending")}</span>}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button 
                            type="button"
                            onClick={() => setSelectedInvoice(p)}
                            className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] px-2.5 py-1.5 rounded-lg ml-auto"
                          >
                            <Eye size={12} />
                            <span>{t("RECEIPT")}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB: LOT WISE REPORT ----------------- */}
      {tab === 'lot_report' && (
        <SupplierLotWiseReport
          supplies={supplies}
          sales={sales}
          returns={returns}
          products={products}
          supplierProfile={supplierProfile}
          invoiceSettings={invoiceSettings}
          onRefreshData={fetchData}
          showToast={showToast}
        />
      )}

      {/* ----------------- TAB: LEDGER HISTORY ----------------- */}
      {tab === 'ledger' && (() => {
        const handleDownloadPDF = () => {
          const totalDebit = ledger.filter(e => e.type === 'Debit').reduce((sum, e) => sum + (e.amount || 0), 0);
          const totalCredit = ledger.filter(e => e.type === 'Credit').reduce((sum, e) => sum + (e.amount || 0), 0);
          downloadLedgerPDF({
            partyType: 'Supplier',
            partyDetails: supplierProfile || { name: user?.name || 'Beopari/Grower' },
            ledgerEntries: displayLedger,
            totals: { totalDebit, totalCredit, currentBalance: supplierProfile?.currentBalance }
          });
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider">{t("My Comprehensive General Ledger")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("Posting transaction histories, payments received, shipments, and opening balances")}</p>
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

            <div id="printable-ledger" className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden p-6 text-xs text-slate-700 dark:text-slate-300">
              <div className="hidden print:block border-b-2 border-slate-300 pb-4 mb-5">
                <h2 className="text-lg font-black uppercase text-[#4F46E5] dark:text-indigo-400">{t("Lahore Sabzi & Fruit Mandi Commission Agent")}</h2>
                <h3 className="text-xs font-bold uppercase mt-1">{t("Personal Beopari/Grower Account Statement Ledger")}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{t("Account Owner:")} <strong>{supplierProfile?.name}</strong> {t("| Phone:")} {supplierProfile?.phone}</p>
              </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                  <th className="py-3 px-2">{t("Date")}</th>
                  <th className="py-3 px-2">{t("Reference Posting / Memo Description")}</th>
                  <th className="py-3 px-2">{t("Type")}</th>
                  <th className="py-3 px-2 text-right">{t("Debit Cash (Shipments Supplied)")}</th>
                  <th className="py-3 px-2 text-right">{t("Credit Cash (Payments Received)")}</th>
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
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 p-6 space-y-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider">{t("OFFICIAL SHIPMENT RECEIPT")}</h3>
              <div className="flex items-center space-x-2">
                <button type="button" onClick={() => setSelectedInvoice(null)} className="text-slate-500 dark:text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
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
                    {t("No: RECV-")}{selectedInvoice.id?.substring(0, 5) || selectedInvoice._id?.substring(0, 5)}
                  </p>
                  <p className="text-[10px] text-slate-500">{t("Date:")} {selectedInvoice.date}</p>
                </div>
              </div>

              <div className={`grid ${invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'grid-cols-1 space-y-2' : 'grid-cols-2 gap-4'} py-3 border-b border-slate-200 text-[10px]`}>
                <div>
                  <span className="text-slate-500 font-bold block text-[8px]">{t("Received From Farmer:")}</span>
                  <p className="font-bold text-sm text-slate-800">{selectedInvoice.supplierName}</p>
                </div>
                <div className={invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'text-left' : 'text-right'}>
                  <span className="text-slate-500 font-bold block text-[8px]">{t("Category:")}</span>
                  <p className="text-slate-600 text-[9px]">{t("Mandi Trade Account Seller")}</p>
                </div>
              </div>

              {(() => {
                const invFin = calculateSupplyFinancials(selectedInvoice, products);
                return (
                  <>
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-300 font-bold uppercase text-slate-500 text-[8px]">
                          <th className="py-1">{t("Description")}</th>
                          <th className="py-1 text-right">{t("Qty")}</th>
                          <th className="py-1 text-right">{t("Purchase Rate")}</th>
                          <th className="py-1 text-right">{t("Gross Total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold text-slate-800 text-[10px]">
                          <td className="py-2">{selectedInvoice.productName}</td>
                          <td className="py-2 text-right">{selectedInvoice.quantity}</td>
                          <td className="py-2 text-right">{t("Rs.")} {selectedInvoice.purchaseRate}</td>
                          <td className="py-2 text-right">{t("Rs.")} {invFin.grossAmount.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="border-t border-slate-200 pt-3 flex justify-end">
                      <div className={`${invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'w-full' : 'w-2/3'} space-y-1.5 text-right font-bold text-[10px]`}>
                        <div className="flex justify-between text-slate-600">
                          <span>{t("Gross Supply Value:")}</span>
                          <span>{t("Rs.")} {invFin.grossAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-rose-600">
                          <span>{t("Beopari/Grower Commission (")}{invFin.commVal}${invFin.commType === 'Percentage' ? '%' : (invFin.commType === 'Per Unit' ? ' Rs/Unit' : ' Rs Fixed')}):</span>
                          <span>{t("- Rs.")} {invFin.commissionAmount.toLocaleString()}</span>
                        </div>
                        {invFin.totalExpenses > 0 && (
                          <>
                            <div className="flex justify-between text-rose-600">
                              <span>{t("Other Lot Expenses:")}</span>
                              <span>{t("- Rs.")} {invFin.totalExpenses.toLocaleString()}</span>
                            </div>
                            {selectedInvoice.lotExpenses && typeof selectedInvoice.lotExpenses === 'object' && Object.entries(selectedInvoice.lotExpenses).some(([_, v]) => Number(v) > 0) && (
                              <div className="pl-3 py-1 space-y-0.5 border-l-2 border-rose-200 dark:border-rose-900/40 text-[9px] text-slate-500">
                                {Object.entries(selectedInvoice.lotExpenses).filter(([_, v]) => Number(v) > 0).map(([k, v]) => (
                                  <div key={k} className="flex justify-between">
                                    <span className="capitalize">{k}:</span>
                                    <span>{t("- Rs.")} {Number(v).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between border-t border-slate-300 pt-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
                          <span>{t("Net Payable to Beopari/Grower:")}</span>
                          <span>{t("Rs.")} {invFin.netPayable.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

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
              <button type="button" onClick={() => setSelectedInvoice(null)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200">{t("Close Receipt")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
