import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext';
import { exportToCSV } from '../../utils/navigation';
import { formatBusinessDisplayName } from '../../utils/businessProfile.js';
import PrintReportHeader from '../common/PrintReportHeader.jsx';
import { Printer, Download, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';

export default function SaleInvoicePage() {
  const { t } = useLanguage();
  const searchParams = new URLSearchParams(window.location.search);
  const initialSaleId = searchParams.get('saleId') || searchParams.get('id') || '';

  const [sales, setSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState(initialSaleId);
  const [saleDetails, setSaleDetails] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [paperSize, setPaperSize] = useState('A4 Standard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoiceData();
  }, [selectedSaleId]);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      const [salesRes, settingsRes, bizRes] = await Promise.all([
        api.get('/sales').catch(() => ({ data: [] })),
        api.get('/settings/invoice').catch(() => ({ data: null })),
        api.get('/settings/business').catch(() => ({ data: null }))
      ]);

      const salesList = salesRes.data || [];
      setSales(salesList);

      const invSet = settingsRes.data || {};
      setInvoiceSettings(invSet);
      if (invSet.paperSize) setPaperSize(invSet.paperSize);

      if (bizRes?.data) {
        setBusinessProfile(bizRes.data);
      }

      let saleToUse = null;
      if (selectedSaleId) {
        saleToUse = salesList.find(s => (s.id || s._id) === selectedSaleId || s.invoiceNumber === selectedSaleId);
      }
      if (!saleToUse && salesList.length > 0) {
        saleToUse = salesList[0];
        setSelectedSaleId(saleToUse.id || saleToUse._id);
      }
      setSaleDetails(saleToUse || null);
    } catch (err) {
      console.error('Failed to load sale invoice data', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!saleDetails) return;
    const invNo = saleDetails.invoiceNumber || (saleDetails.id || saleDetails._id || '').substring(0, 8).toUpperCase();
    const headers = ['Invoice No', 'Date', 'Customer', 'Product', 'Quantity', 'Rate (Rs)', 'Gross Amount', 'Commission', 'Discount', 'Net Total'];
    const grossSub = saleDetails.grossSale || (saleDetails.quantity * saleDetails.saleRate) || 0;
    const comm = saleDetails.commissionAmount || 0;
    const disc = saleDetails.discountAmount || saleDetails.discount || 0;
    const netTotal = grossSub + comm - disc;
    const rows = [[
      invNo,
      saleDetails.date,
      saleDetails.customerName,
      saleDetails.productName,
      saleDetails.quantity,
      saleDetails.saleRate,
      grossSub,
      comm,
      disc,
      netTotal
    ]];
    exportToCSV(`Sale_Invoice_${invNo}`, headers, rows);
  };

  const invoiceNo = saleDetails?.invoiceNumber 
    ? `INV-${saleDetails.invoiceNumber}` 
    : (saleDetails?.id || saleDetails?._id) 
    ? `INV-${(saleDetails.id || saleDetails._id).substring(0, 8).toUpperCase()}` 
    : 'INV-00000';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4F46E5] dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">{t("Dedicated Invoice Page")}</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">{t("Billing Tax Invoice")}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {invoiceNo} {saleDetails ? `— ${saleDetails.customerName}` : ''}
          </h1>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          {/* Format Selector */}
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            className="bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#4F46E5]"
          >
            <option value="A4 Standard">{t("A4 Standard")}</option>
            <option value="A5">{t("A5 Half Sheet")}</option>
            <option value="Thermal 3-inch">{t("Thermal 3-inch Slip")}</option>
          </select>

          <button
            onClick={handleExportCSV}
            disabled={!saleDetails}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            <Download size={14} />
            <span>{t("Export CSV")}</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!saleDetails}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
          >
            <Printer size={14} />
            <span>{t("Print Invoice")}</span>
          </button>
        </div>
      </div>

      {/* Sale Selector Dropdown for quick lookup */}
      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">{t("Select Sale Voucher to Preview Invoice")}</label>
        <select
          value={selectedSaleId}
          onChange={(e) => setSelectedSaleId(e.target.value)}
          className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#4F46E5]"
        >
          {sales.map(s => (
            <option key={s.id || s._id} value={s.id || s._id}>
              INV-{s.invoiceNumber || (s.id || s._id).substring(0, 6)} | {s.date} | {s.customerName} | {s.productName} ({s.quantity}{' '}{t("units @ Rs.")}{' '}{s.saleRate}) = Rs. {s.grossSale || (s.quantity * s.saleRate)}
            </option>
          ))}
        </select>
      </div>

      {/* Main Printable Tax Invoice */}
      <div className="bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-lg mx-auto print:shadow-none print:border-none print:p-0 print:bg-white print:text-black">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />{t("Generating Invoice Document...")}</div>
        ) : !saleDetails ? (
          <div className="py-16 text-center text-slate-400 italic">{t("No sale voucher record found for invoice preview.")}</div>
        ) : (
          <div
            id="printable-area"
            className={`mx-auto ${
              paperSize === 'Thermal 3-inch'
                ? 'w-[76mm] max-w-[320px] font-mono text-[10px] space-y-3 p-2'
                : paperSize === 'A5'
                ? 'w-[148mm] max-w-md text-[11px] space-y-4 p-4'
                : 'w-full space-y-6 text-xs'
            }`}
          >
            <PrintReportHeader
              title={t('Sales Tax Invoice')}
              period={saleDetails.date}
              filters={[
                { label: t('Invoice #'), value: invoiceNo },
                ...(saleDetails.customerName ? [{ label: t('Customer'), value: saleDetails.customerName }] : [])
              ]}
              businessProfile={businessProfile}
            />
            {/* Invoice Header */}
            <div className={`print:hidden flex ${paperSize === 'Thermal 3-inch' ? 'flex-col items-center text-center' : 'justify-between items-start'} border-b-2 border-slate-200 dark:border-slate-700 pb-4`}>
              <div>
                {invoiceSettings?.companyLogo || businessProfile?.logo ? (
                  <img
                    src={invoiceSettings?.companyLogo || businessProfile?.logo}
                    alt={t("Company Logo")}
                    className="h-12 object-contain mb-2"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex items-center space-x-2 mb-1">
                    <img
                      src="/mandi_logo.jpg"
                      alt={t("Mandi Logo")}
                      referrerPolicy="no-referrer"
                      className="h-10 w-auto object-contain rounded"
                    />
                    <div>
                      <h2 className="text-lg font-black tracking-wider uppercase text-[#4F46E5] dark:text-indigo-400">
                        {formatBusinessDisplayName(businessProfile, invoiceSettings?.header || 'Sabzi & Fruit Mandi Trade Brokerage')}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-700 dark:text-slate-300 font-semibold">
                        {businessProfile?.ownerName && (
                          <span className="font-bold text-slate-900 dark:text-white">{t("Proprietor:")}{' '}{businessProfile.ownerName}</span>
                        )}
                        <span className="text-slate-500 uppercase tracking-widest font-bold">{t("Commission Agent")}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 space-y-0.5">
                  {(businessProfile?.address || invoiceSettings?.companyAddress) && (
                    <p>📍 {[businessProfile?.address || invoiceSettings?.companyAddress, businessProfile?.city].filter(Boolean).join(', ')}</p>
                  )}
                  {(businessProfile?.mobileNumber || businessProfile?.whatsAppNumber || invoiceSettings?.companyPhone) && (
                    <p>{t("📞 Tel/WhatsApp:")}{' '}{[businessProfile?.mobileNumber, businessProfile?.whatsAppNumber, invoiceSettings?.companyPhone].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' / ')}</p>
                  )}
                  {businessProfile?.businessCode && (
                    <p className="font-mono text-[9px] font-bold text-slate-500">{t("Mandi Arthi Code:")}{' '}{businessProfile.businessCode}</p>
                  )}
                </div>
              </div>

              <div className={paperSize === 'Thermal 3-inch' ? 'text-center mt-2 pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 w-full' : 'text-right'}>
                <span className="inline-block px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 font-black text-indigo-700 dark:text-indigo-300 text-xs rounded-lg uppercase tracking-wider mb-1">{t("OFFICIAL TAX INVOICE")}</span>
                <p className="font-mono font-black text-sm text-slate-900 dark:text-slate-100 mt-1">{invoiceNo}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("Date:")}{' '}{saleDetails.date}</p>
              </div>
            </div>

            {/* Customer & Transaction Info */}
            <div className={`grid ${paperSize === 'Thermal 3-inch' ? 'grid-cols-1 space-y-2' : 'grid-cols-2 gap-4'} py-3 border-b border-slate-200 dark:border-slate-700 text-[11px]`}>
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 block mb-0.5">{t("Billed Customer")}</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{saleDetails.customerName || 'Walk-in Buyer'}</p>
                {saleDetails.customerPhone && <p className="text-slate-600 dark:text-slate-400">{t("Phone:")}{' '}{saleDetails.customerPhone}</p>}
                {saleDetails.paymentMethod && <p className="text-slate-600 dark:text-slate-400">{t("Payment Terms:")}{' '}{t(saleDetails.paymentMethod)}</p>}
              </div>

              <div className={paperSize === 'Thermal 3-inch' ? 'text-left' : 'text-right'}>
                <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 block mb-0.5">{t("Consignment Beopari/Grower & Lot")}</span>
                <p className="font-bold text-slate-900 dark:text-slate-100">{saleDetails.supplierName || 'Mandi Stock'}</p>
                <p className="text-slate-600 dark:text-slate-400 font-mono">{t("Lot Ref: #")}{saleDetails.stockLotNumber || 'LOT-N/A'}</p>
              </div>
            </div>

            {/* Item Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-300 dark:border-slate-700 text-[10px] uppercase font-black text-slate-600 dark:text-slate-400">
                    <th className="py-2 px-2">{t("Product Description")}</th>
                    <th className="py-2 px-2 text-right">{t("Quantity")}</th>
                    <th className="py-2 px-2 text-right">{t("Unit Rate")}</th>
                    <th className="py-2 px-2 text-right">{t("Total Amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr>
                    <td className="py-3 px-2 font-bold text-slate-900 dark:text-slate-100">
                      {saleDetails.productName}
                      {saleDetails.unit && <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">({t(saleDetails.unit)})</span>}
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-slate-800 dark:text-slate-200">{saleDetails.quantity}</td>
                    <td className="py-3 px-2 text-right font-semibold text-slate-800 dark:text-slate-200">Rs. {saleDetails.saleRate?.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right font-black text-slate-900 dark:text-slate-100">
                      Rs. {(saleDetails.grossSale || (saleDetails.quantity * saleDetails.saleRate)).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Breakdown */}
            <div className="flex justify-end pt-3 border-t-2 border-slate-200 dark:border-slate-700">
              <div className={`${paperSize === 'Thermal 3-inch' ? 'w-full' : 'w-1/2'} space-y-1.5 text-right text-xs`}>
                {(() => {
                  const grossSub = saleDetails.grossSale || (saleDetails.quantity * saleDetails.saleRate) || 0;
                  const comm = saleDetails.commissionAmount || 0;
                  const disc = saleDetails.discountAmount || saleDetails.discount || 0;
                  const netTotal = grossSub + comm - disc;
                  return (
                    <>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>{t("Gross Subtotal:")}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Rs. {grossSub.toLocaleString()}</span>
                      </div>

                      {comm > 0 && (
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>{t("Buyer Commission:")}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">+ Rs. {comm.toLocaleString()}</span>
                        </div>
                      )}

                      {disc > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>{t("Discount Applied:")}</span>
                          <span>- Rs. {disc.toLocaleString()}</span>
                        </div>
                      )}

                      <div className="flex justify-between font-black text-sm text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-300 dark:border-slate-700">
                        <span>{t("NET TOTAL AMOUNT:")}</span>
                        <span className="text-[#4F46E5] dark:text-indigo-400">
                          Rs. {netTotal.toLocaleString()}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Terms and Signature */}
            <div className="pt-6 border-t border-dashed border-slate-300 space-y-4">
              {invoiceSettings?.termsAndConditions && (
                <div className="text-[9px] text-slate-500">
                  <span className="font-bold uppercase block mb-0.5">{t("Terms & Conditions")}</span>
                  <p className="whitespace-pre-line leading-normal">{invoiceSettings.termsAndConditions}</p>
                </div>
              )}

              <div className="flex justify-between items-end pt-4">
                <div className="text-[9px] text-slate-400">
                  <p>{t("Computer Generated Tax Voucher")}</p>
                  <p>{t("Mandi OS • Sabzi & Fruit Brokerage System")}</p>
                </div>

                <div className="text-center border-t border-slate-400 pt-1 px-6">
                  <span className="text-[10px] font-bold text-slate-700">
                    {invoiceSettings?.signature || 'Authorized Signatory'}
                  </span>
                </div>
              </div>

              {invoiceSettings?.footer && (
                <p className="text-center text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-200">
                  {invoiceSettings.footer}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
