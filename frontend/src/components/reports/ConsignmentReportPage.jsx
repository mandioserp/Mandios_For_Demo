import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext';
import { exportToCSV } from '../../utils/navigation';
import { Printer, Download, Filter, Search, DollarSign, RefreshCw, ShoppingBag } from 'lucide-react';
import PrintReportHeader from '../common/PrintReportHeader.jsx';

export default function ConsignmentReportPage() {
  const { t } = useLanguage();

  const [sales, setSales] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [supplierFilter, setSupplierFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchConsignmentData();
  }, []);

  const fetchConsignmentData = async () => {
    try {
      setLoading(true);
      const [salesRes, supRes, custRes] = await Promise.all([
        api.get('/sales').catch(() => ({ data: [] })),
        api.get('/suppliers').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] }))
      ]);

      setSales(salesRes.data || []);
      setSuppliers(supRes.data || []);
      setCustomers(custRes.data || []);
    } catch (err) {
      console.error('Failed to load consignment report data', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered sales
  const filteredSales = sales.filter(item => {
    if (supplierFilter && item.supplierId !== supplierFilter) return false;
    if (customerFilter && item.customerId !== customerFilter) return false;
    if (lotFilter && (item.stockLotNumber !== lotFilter && item.stockEntryId !== lotFilter)) return false;
    if (startDate && item.date < startDate) return false;
    if (endDate && item.date > endDate) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const invMatch = (item.invoiceNumber || item.id || '').toLowerCase().includes(term);
      const custMatch = item.customerName?.toLowerCase().includes(term);
      const supMatch = item.supplierName?.toLowerCase().includes(term);
      const prodMatch = item.productName?.toLowerCase().includes(term);
      if (!invMatch && !custMatch && !supMatch && !prodMatch) return false;
    }
    return true;
  });

  // Totals
  const totalGrossTurnover = filteredSales.reduce((acc, s) => acc + (s.grossSale || (s.quantity * s.saleRate) || 0), 0);
  const totalCommission = filteredSales.reduce((acc, s) => acc + (s.commissionAmount || 0), 0);
  const totalUnits = filteredSales.reduce((acc, s) => acc + (s.quantity || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Invoice No', 'Sale Date', 'Lot #', 'Beopari/Grower', 'Customer', 'Product', 'Quantity', 'Rate (Rs)', 'Gross Sale (Rs)', 'Commission (Rs)', 'Net Total (Rs)'];
    const rows = filteredSales.map(s => [
      s.invoiceNumber || (s.id || s._id || '').substring(0, 6),
      s.date,
      s.stockLotNumber || 'N/A',
      s.supplierName,
      s.customerName,
      s.productName,
      s.quantity,
      s.saleRate,
      s.grossSale || (s.quantity * s.saleRate),
      s.commissionAmount || 0,
      s.netTotal || s.grossSale
    ]);
    exportToCSV('Consignment_Sales_Report', headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4F46E5] dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">{t("Dedicated Report Page")}</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">{t("Consignment Sales & Turnover")}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">{t("Sold Consignments & Mandi Turnover Report")}</h1>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <button
            onClick={fetchConsignmentData}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all"
            title={t("Refresh Consignment Data")}
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
            onClick={handlePrint}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Printer size={14} />
            <span>{t("Print Consignment Report")}</span>
          </button>
        </div>
      </div>

      {/* Printable Header */}
      <PrintReportHeader
        title={t("CONSIGNMENT SALES & BROKERAGE TURNOVER REPORT")}
        period={`${startDate || t('All-Time')} ${t('to')} ${endDate || t('Present')}`}
        filters={[
          ...(supplierFilter ? [{ label: 'Beopari/Grower', value: suppliers.find(s => s._id === supplierFilter)?.name || supplierFilter }] : []),
          ...(customerFilter ? [{ label: 'Customer', value: customers.find(c => c._id === customerFilter)?.name || customerFilter }] : []),
          ...(lotFilter ? [{ label: 'Lot #', value: lotFilter }] : [])
        ]}
        summaryMetrics={[
          { label: 'Billed Vouchers', value: `${filteredSales.length} Invoices` },
          { label: 'Quantity Billed', value: `${totalUnits.toLocaleString()} Units` },
          { label: 'Gross Billed Amount', value: `Rs. ${totalRevenue.toLocaleString()}` },
          { label: 'Brokerage Commission', value: `Rs. ${totalCommission.toLocaleString()}` }
        ]}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("Billed Consignments")}</span>
          <p className="text-lg font-black text-slate-900 dark:text-white">{filteredSales.length}{' '}{t("Sales Vouchers")}</p>
          <p className="text-[10px] text-slate-400">{t("Total transaction vouchers")}</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("Total Quantity Billed")}</span>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{totalUnits.toLocaleString()}{' '}{t("Units")}</p>
          <p className="text-[10px] text-slate-400">{t("Total items sold across lots")}</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("Gross Sales Turnover")}</span>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">Rs. {totalGrossTurnover.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">{t("Total market turnover")}</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("Brokerage Commission Revenue")}</span>
          <p className="text-lg font-black text-[#4F46E5] dark:text-indigo-400">Rs. {totalCommission.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">{t("Net commission earned")}</p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Filter size={15} className="text-[#4F46E5]" />
          <span>{t("Consignment Report Filters")}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t("Beopari/Grower")}</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#4F46E5]"
            >
              <option value="">{t("All Beopari/Growers")}</option>
              {suppliers.map(s => (
                <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t("Customer")}</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#4F46E5]"
            >
              <option value="">{t("All Customers")}</option>
              {customers.map(c => (
                <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
              ))}
            </select>
          </div>

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
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t("Search Keywords")}</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("Search Invoice#, Customer...")}
                className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 font-semibold outline-none focus:border-[#4F46E5]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Consignment Sales Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t("Consignment Vouchers Ledger (")}{filteredSales.length})
          </h3>
          {(supplierFilter || customerFilter || startDate || endDate || searchTerm) && (
            <button
              onClick={() => { setSupplierFilter(''); setCustomerFilter(''); setStartDate(''); setEndDate(''); setSearchTerm(''); }}
              className="text-[10px] font-bold text-[#4F46E5] hover:underline"
            >{t("Clear Filters")}</button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0F172A]/50 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 uppercase font-black tracking-wider">
                <th className="py-3.5 px-4">{t("Invoice No")}</th>
                <th className="py-3.5 px-4">{t("Sale Date")}</th>
                <th className="py-3.5 px-4">{t("Lot Ref")}</th>
                <th className="py-3.5 px-4">{t("Beopari/Grower")}</th>
                <th className="py-3.5 px-4">{t("Customer")}</th>
                <th className="py-3.5 px-4">{t("Product")}</th>
                <th className="py-3.5 px-4 text-right">{t("Quantity")}</th>
                <th className="py-3.5 px-4 text-right">{t("Rate")}</th>
                <th className="py-3.5 px-4 text-right">{t("Gross Sale")}</th>
                <th className="py-3.5 px-4 text-right">{t("Commission")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />{t("Fetching Consignment Vouchers...")}</td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400 italic">{t("No consignment vouchers found matching filters.")}</td>
                </tr>
              ) : (
                filteredSales.map((s, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold">INV-{s.invoiceNumber || (s.id || s._id || '').substring(0, 6)}</td>
                    <td className="py-3.5 px-4">{s.date}</td>
                    <td className="py-3.5 px-4 font-mono">#{s.stockLotNumber || 'N/A'}</td>
                    <td className="py-3.5 px-4 font-bold">{s.supplierName}</td>
                    <td className="py-3.5 px-4 font-bold">{s.customerName}</td>
                    <td className="py-3.5 px-4">{s.productName}</td>
                    <td className="py-3.5 px-4 text-right">{s.quantity}</td>
                    <td className="py-3.5 px-4 text-right">Rs. {s.saleRate?.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white">
                      Rs. {(s.grossSale || (s.quantity * s.saleRate)).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                      Rs. {(s.commissionAmount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredSales.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white">
                  <td colSpan="6" className="py-3 px-4 font-black">{t("TOTALS (")}{filteredSales.length}{' '}{t("Invoices)")}</td>
                  <td className="py-3 px-4 text-right font-black">{totalUnits.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">-</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">Rs. {totalRevenue.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-black text-indigo-600 dark:text-indigo-400">Rs. {totalCommission.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
