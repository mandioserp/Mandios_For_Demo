import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext';
import { exportToCSV } from '../../utils/navigation';
import { Printer, Download, Filter, Search, RefreshCw } from 'lucide-react';
import PrintReportHeader from '../common/PrintReportHeader.jsx';

export default function StockReportPage() {
  const { t } = useLanguage();

  const [stockEntries, setStockEntries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [supplierFilter, setSupplierFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStockData = useCallback(async () => {
    try {
      setLoading(true);
      const [stockRes, supRes, prodRes, salesRes] = await Promise.all([
        api.get('/stock').catch(() => ({ data: [] })),
        api.get('/suppliers').catch(() => ({ data: [] })),
        api.get('/products').catch(() => ({ data: [] })),
        api.get('/sales').catch(() => ({ data: [] }))
      ]);

      const extractArray = (data) => Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : (Array.isArray(data?.data) ? data.data : []));
      setStockEntries(extractArray(stockRes.data));
      setSuppliers(extractArray(supRes.data));
      setProducts(extractArray(prodRes.data));
      setSales(extractArray(salesRes.data));
    } catch (err) {
      console.error('Failed to load stock report data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchStockData();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchStockData]);

  // Enhance stock entries with sold quantity calculations
  const enhancedStock = stockEntries.map(stock => {
    const stockId = stock.id || stock._id;
    const stockIdStr = stockId ? String(stockId) : null;
    const stockLotNumStr = stock.lotNumber ? String(stock.lotNumber) : null;
    const linkedSales = sales.filter(s => {
      const sStockId = s.stockEntryId ? String(s.stockEntryId) : null;
      const sLotNum = s.stockLotNumber ? String(s.stockLotNumber) : null;

      if (sStockId && stockIdStr) {
        return sStockId === stockIdStr;
      }
      if (sLotNum && stockLotNumStr) {
        return sLotNum === stockLotNumStr;
      }
      return false;
    });
    const soldQty = linkedSales.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    const totalQty = stock.totalQuantity || stock.quantity || 0;
    const remainingQty = Math.max(0, totalQty - soldQty);
    const isDepleted = remainingQty === 0;

    return {
      ...stock,
      soldQty,
      remainingQty,
      status: isDepleted ? 'Depleted' : 'In-Stock'
    };
  });

  // Filtered Stock Entries
  const filteredStock = enhancedStock.filter(item => {
    if (supplierFilter && item.supplierId !== supplierFilter) return false;
    if (productFilter && item.productId !== productFilter && item.productName !== productFilter) return false;
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (startDate && item.arrivalDate < startDate) return false;
    if (endDate && item.arrivalDate > endDate) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const lotMatch = item.lotNumber?.toLowerCase().includes(term);
      const supMatch = item.supplierName?.toLowerCase().includes(term);
      const prodMatch = item.productName?.toLowerCase().includes(term);
      const truckMatch = item.vehicleNumber?.toLowerCase().includes(term);
      if (!lotMatch && !supMatch && !prodMatch && !truckMatch) return false;
    }
    return true;
  });

  // Totals
  const totalReceivedQty = filteredStock.reduce((acc, s) => acc + (s.totalQuantity || s.quantity || 0), 0);
  const totalSoldQty = filteredStock.reduce((acc, s) => acc + s.soldQty, 0);
  const totalRemainingQty = filteredStock.reduce((acc, s) => acc + s.remainingQty, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      t('Lot Number'), t('Arrival Date'), t('Beopari/Grower'), t('Product'), t('Vehicle No'),
      t('Total Qty'), t('Sold Qty'), t('Remaining Qty'), t('Status')
    ];
    const rows = filteredStock.map(s => [
      s.lotNumber,
      s.arrivalDate,
      s.supplierName,
      s.productName,
      s.vehicleNumber || t('N/A'),
      s.totalQuantity || s.quantity || 0,
      s.soldQty,
      s.remainingQty,
      t(s.status)
    ]);
    exportToCSV('Inventory_Stock_Report', headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4F46E5] dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
              {t('Dedicated Report Page')}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">{t('Inventory & Stock Supplies')}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {t('Mandi Stock Supplies & Consignment Inventory Report')}
          </h1>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <button
            onClick={fetchStockData}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all"
            title={t('Refresh Stock Data')}
          >
            <RefreshCw size={16} />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
          >
            <Download size={14} />
            <span>{t('Export CSV')}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Printer size={14} />
            <span>{t('Print Stock Report')}</span>
          </button>
        </div>
      </div>

      {/* Printable Header */}
      <PrintReportHeader
        title={t('INVENTORY STOCK ARRIVAL & WAREHOUSE BALANCE REPORT')}
        period={`${startDate || t('All-Time')} ${t('to')} ${endDate || t('Present')}`}
        filters={[
          ...(supplierFilter ? [{ label: t('Beopari/Grower'), value: suppliers.find(s => s._id === supplierFilter)?.name || supplierFilter }] : []),
          ...(productFilter ? [{ label: t('Produce Item'), value: products.find(p => p._id === productFilter)?.name || productFilter }] : []),
          ...(statusFilter !== 'All' ? [{ label: t('Stock Status'), value: t(statusFilter) }] : [])
        ]}
        summaryMetrics={[
          { label: t('Consignment Lots'), value: `${filteredStock.length} ${t('Lots')}` },
          { label: t('Total Received Qty'), value: `${totalReceivedQty.toLocaleString()} ${t('Units')}` },
          { label: t('Total Sold Qty'), value: `${totalSoldQty.toLocaleString()} ${t('Units')}` },
          { label: t('Remaining Warehouse Stock'), value: `${totalRemainingQty.toLocaleString()} ${t('Units')}` }
        ]}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Total Arrival Lots')}</span>
          <p className="text-lg font-black text-slate-900 dark:text-white">{filteredStock.length} {t('Consignments')}</p>
          <p className="text-[10px] text-slate-400">{t('Total lots in current report view')}</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Total Stock Received')}</span>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{totalReceivedQty.toLocaleString()} {t('Units')}</p>
          <p className="text-[10px] text-slate-400">{t('Total arrival weight/quantity')}</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Total Quantity Sold')}</span>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{totalSoldQty.toLocaleString()} {t('Units')}</p>
          <p className="text-[10px] text-slate-400">{t('Billed in batch sales')}</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Remaining Warehouse Inventory')}</span>
          <p className={`text-lg font-black ${totalRemainingQty > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
            {totalRemainingQty.toLocaleString()} {t('Units')}
          </p>
          <p className="text-[10px] text-slate-400">{t('Available for future sales')}</p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Filter size={15} className="text-[#4F46E5]" />
          <span>{t('Stock Report Filters')}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('Beopari/Grower')}</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#4F46E5]"
            >
              <option value="">{t('All Beopari/Growers')}</option>
              {suppliers.map(s => (
                <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('Product')}</label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#4F46E5]"
            >
              <option value="">{t('All Products')}</option>
              {products.map(p => (
                <option key={p.id || p._id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('Stock Status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#4F46E5]"
            >
              <option value="All">{t('All Statuses')}</option>
              <option value="In-Stock">{t('In-Stock (Available Inventory)')}</option>
              <option value="Depleted">{t('Fully Sold / Depleted')}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('Start Date')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-semibold outline-none focus:border-[#4F46E5]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('Search Keyword')}</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('Search Lot#, truck...')}
                className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 font-semibold outline-none focus:border-[#4F46E5]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {t('Warehouse Inventory Lot Ledger (')} {filteredStock.length})
          </h3>
          {(supplierFilter || productFilter || statusFilter !== 'All' || startDate || endDate || searchTerm) && (
            <button
              onClick={() => { setSupplierFilter(''); setProductFilter(''); setStatusFilter('All'); setStartDate(''); setEndDate(''); setSearchTerm(''); }}
              className="text-[10px] font-bold text-[#4F46E5] hover:underline"
            >
              {t('Clear Filters')}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0F172A]/50 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 uppercase font-black tracking-wider">
                <th className="py-3.5 px-4">{t('Lot #')}</th>
                <th className="py-3.5 px-4">{t('Arrival Date')}</th>
                <th className="py-3.5 px-4">{t('Beopari/Grower')}</th>
                <th className="py-3.5 px-4">{t('Product Commodity')}</th>
                <th className="py-3.5 px-4">{t('Vehicle No')}</th>
                <th className="py-3.5 px-4 text-right">{t('Arrived Qty')}</th>
                <th className="py-3.5 px-4 text-right">{t('Sold Qty')}</th>
                <th className="py-3.5 px-4 text-right">{t('Remaining Inventory')}</th>
                <th className="py-3.5 px-4 text-center">{t('Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    {t('Fetching Inventory Stock Records...')}
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400 italic">
                    {t('No stock inventory entries found matching filters.')}
                  </td>
                </tr>
              ) : (
                filteredStock.map((s, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#4F46E5] dark:text-indigo-400">#{s.lotNumber}</td>
                    <td className="py-3.5 px-4">{s.arrivalDate}</td>
                    <td className="py-3.5 px-4 font-bold">{s.supplierName}</td>
                    <td className="py-3.5 px-4">{s.productName}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">{s.vehicleNumber || 'N/A'}</td>
                    <td className="py-3.5 px-4 text-right font-bold">{s.totalQuantity || s.quantity} {t(s.unit || 'units')}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">{s.soldQty} {t(s.unit || 'units')}</td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white">{s.remainingQty} {t(s.unit || 'units')}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'In-Stock' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {t(s.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredStock.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white">
                  <td colSpan="5" className="py-3 px-4 font-black">{t('TOTALS (')} {filteredStock.length} {t('Consignment Lots')}</td>
                  <td className="py-3 px-4 text-right font-black">{totalReceivedQty.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-black text-indigo-600 dark:text-indigo-400">{totalSoldQty.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-black text-amber-600 dark:text-amber-400">{totalRemainingQty.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
