import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext';
import { exportToCSV } from '../../utils/navigation';
import { Printer, Download, Filter, Search, RefreshCw } from 'lucide-react';
import PrintReportHeader from '../common/PrintReportHeader.jsx';

export default function LogisticsReportPage() {
  const { t } = useLanguage();

  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTruckLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/trucks').catch(() => ({ data: [] }));
      setTrucks(res.data || []);
    } catch (err) {
      console.error('Failed to load truck logs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchTruckLogs();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchTruckLogs]);

  // Filtered truck logs
  const filteredTrucks = trucks.filter(item => {
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (startDate && item.arrivalDate < startDate) return false;
    if (endDate && item.arrivalDate > endDate) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const numMatch = item.truckNumber?.toLowerCase().includes(term);
      const driverMatch = item.driverName?.toLowerCase().includes(term);
      const transporterMatch = item.transporter?.toLowerCase().includes(term);
      const supplierMatch = (item.beoparis || []).some(entry => (entry.supplierName || '').toLowerCase().includes(term) || (entry.products || []).some(product => (product.productName || '').toLowerCase().includes(term)));
      if (!numMatch && !driverMatch && !transporterMatch && !supplierMatch) return false;
    }
    return true;
  });

  // Totals
  const totalFreight = filteredTrucks.reduce((acc, t) => acc + (t.freightAmount || 0), 0);
  const totalLabor = filteredTrucks.reduce((acc, t) => acc + (t.laborCharges || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      t('Truck Number'), t('Arrival Date'), t('Driver Name'), t('Transporter'), t('Beopari/Grower'),
      t('Freight Charges (Rs)'), t('Labor Charges (Rs)'), t('Status')
    ];
    const rows = filteredTrucks.map(truck => [
      truck.truckNumber,
      truck.arrivalDate || truck.date || '',
      truck.driverName || t('N/A'),
      truck.transporter || t('N/A'),
      (truck.beoparis || []).map(entry => `${entry.supplierName || truck.supplierName || t('N/A')}: ${(entry.products || []).map(product => `${product.productName} (${product.quantity} ${product.unit})`).join(', ')}`).join('; ') || truck.supplierName || t('N/A'),
      truck.freightAmount || 0,
      truck.laborCharges || 0,
      truck.status ? t(truck.status) : t('Received')
    ]);
    exportToCSV('Truck_Logistics_Report', headers, rows);
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
            <span className="text-xs text-slate-500 font-medium">{t('Logistics & Truck Freight Statement')}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {t('Truck Logs & Freight Logistics Report')}
          </h1>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <button
            onClick={fetchTruckLogs}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all"
            title={t('Refresh Logistics Data')}
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
            <span>{t('Print Logistics Report')}</span>
          </button>
        </div>
      </div>

      {/* Printable Header */}
      <PrintReportHeader
        title={t('TRUCK FREIGHT LOGISTICS & UNLOADING AUDIT STATEMENT')}
        period={`${startDate || t('All-Time')} ${t('to')} ${endDate || t('Present')}`}
        filters={[
          ...(statusFilter !== 'All' ? [{ label: t('Status'), value: t(statusFilter) }] : [])
        ]}
        summaryMetrics={[
          { label: t('Total Arrived Trucks'), value: `${filteredTrucks.length} ${t('Vehicles')}` },
          { label: t('Total Freight Disbursed'), value: `Rs. ${totalFreight.toLocaleString()}` },
          { label: t('Total Labor / Unloading Charges'), value: `Rs. ${totalLabor.toLocaleString()}` }
        ]}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Total Arrived Trucks')}</span>
          <p className="text-lg font-black text-slate-900 dark:text-white">{filteredTrucks.length} {t('Vehicles')}</p>
          <p className="text-[10px] text-slate-400">{t('Truck arrivals in report view')}</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Total Freight Disbursed')}</span>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">Rs. {totalFreight.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">{t('Sum of truck freight charges')}</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Total Labor / Unloading Charges')}</span>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">Rs. {totalLabor.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">{t('Sum of unloading charges')}</p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Filter size={15} className="text-[#4F46E5]" />
          <span>{t('Logistics Filters')}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('Logistics Status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#4F46E5]"
            >
              <option value="All">{t('All Statuses')}</option>
              <option value="Arrived">{t('Arrived')}</option>
              <option value="Unloading">{t('Unloading')}</option>
              <option value="Cleared">{t('Cleared')}</option>
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
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('End Date')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-semibold outline-none focus:border-[#4F46E5]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('Search Keywords')}</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('Truck #, Driver, Transporter...')}
                className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 font-semibold outline-none focus:border-[#4F46E5]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Logistics Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {t('Logistics Truck Movement Entries (')} {filteredTrucks.length})
          </h3>
          {(statusFilter !== 'All' || startDate || endDate || searchTerm) && (
            <button
              onClick={() => { setStatusFilter('All'); setStartDate(''); setEndDate(''); setSearchTerm(''); }}
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
                <th className="py-3.5 px-4">{t('Truck Number')}</th>
                <th className="py-3.5 px-4">{t('Arrival Date')}</th>
                <th className="py-3.5 px-4">{t('Driver Name')}</th>
                <th className="py-3.5 px-4">{t('Transporter Company')}</th>
                <th className="py-3.5 px-4">{t('Beopari/Grower Name')}</th>
                <th className="py-3.5 px-4 text-right">{t('Freight Charges')}</th>
                <th className="py-3.5 px-4 text-right">{t('Labor Charges')}</th>
                <th className="py-3.5 px-4 text-center">{t('Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    {t('Fetching Logistics Truck Records...')}
                  </td>
                </tr>
              ) : filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400 italic">
                    {t('No truck logistics records found.')}
                  </td>
                </tr>
              ) : (
                filteredTrucks.map((truck, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#4F46E5] dark:text-indigo-400">{truck.truckNumber}</td>
                    <td className="py-3.5 px-4">{truck.arrivalDate || truck.date}</td>
                    <td className="py-3.5 px-4 font-bold">{truck.driverName || t('N/A')}</td>
                    <td className="py-3.5 px-4">{truck.transporter || t('N/A')}</td>
                    <td className="py-3.5 px-4 font-bold">{(truck.beoparis || []).map(entry => <div key={entry.supplierId || entry.supplierName}><span>{entry.supplierName || truck.supplierName || t('N/A')}</span><small className="block font-normal text-slate-500">{(entry.products || []).map(product => `${product.productName} (${product.quantity} ${product.unit})`).join(', ')}</small></div>) }{!truck.beoparis?.length && (truck.supplierName || t('N/A'))}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                      Rs. {(truck.freightAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                      Rs. {(truck.laborCharges || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {t(truck.status || 'Cleared')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredTrucks.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white">
                  <td colSpan="5" className="py-3 px-4 font-black">{t('TOTALS (')} {filteredTrucks.length} {t('Trucks')}</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">Rs. {totalFreight.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">Rs. {totalLabor.toLocaleString()}</td>
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
