import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext';
import { exportToCSV } from '../../utils/navigation';
import { Printer, Download, Filter, Search, RefreshCw } from 'lucide-react';
import PrintReportHeader from '../common/PrintReportHeader.jsx';

export default function AuditReportPage() {
  const { t } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit').catch(() => ({ data: [] }));
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchAuditLogs();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchAuditLogs]);

  // Filtered logs
  const filteredLogs = logs.filter(log => {
    if (roleFilter !== 'All' && log.role !== roleFilter) return false;
    if (actionFilter !== 'All' && log.action !== actionFilter) return false;
    if (startDate && log.timestamp < startDate) return false;
    if (endDate && log.timestamp > endDate) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const userMatch = log.user?.toLowerCase().includes(term);
      const detailsMatch = log.details?.toLowerCase().includes(term);
      const actionMatch = log.action?.toLowerCase().includes(term);
      if (!userMatch && !detailsMatch && !actionMatch) return false;
    }
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [t('Timestamp'), t('User Name'), t('Role'), t('Action Type'), t('Event Details'), t('IP Address')];
    const rows = filteredLogs.map(l => [
      l.timestamp,
      l.user || t('System'),
      l.role ? t(l.role) : t('N/A'),
      l.action ? t(l.action) : '',
      l.details || '',
      l.ipAddress || '127.0.0.1'
    ]);
    exportToCSV('System_Audit_Log_Report', headers, rows);
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
            <span className="text-xs text-slate-500 font-medium">{t('System Compliance & Security')}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {t('System Activity & Financial Audit Statement')}
          </h1>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <button
            onClick={fetchAuditLogs}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all"
            title={t('Refresh Audit Logs')}
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
            <span>{t('Print Audit Log')}</span>
          </button>
        </div>
      </div>

      {/* Printable Header */}
      <PrintReportHeader
        title={t('SYSTEM ACTIVITY & SECURITY AUDIT TRAIL STATEMENT')}
        period={`${startDate || t('All-Time')} ${t('to')} ${endDate || t('Present')}`}
        filters={[
          ...(roleFilter !== 'All' ? [{ label: t('User Role'), value: t(roleFilter) }] : []),
          ...(actionFilter !== 'All' ? [{ label: t('Event Action'), value: t(actionFilter) }] : [])
        ]}
        summaryMetrics={[
          { label: t('Audit Records'), value: `${filteredLogs.length} ${t('Events')}` },
          { label: t('Security Level'), value: t('Tenant Isolated') },
          { label: t('Audit Protocol'), value: t('Immutable System Log') }
        ]}
      />

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Filter size={15} className="text-[#4F46E5]" />
          <span>{t('Audit Trail Filters')}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('User Role')}</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#4F46E5]"
            >
              <option value="All">{t('All User Roles')}</option>
              <option value="Admin">{t('Administrator')}</option>
              <option value="Clerk">{t('Mandi Clerk')}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('Event Action')}</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#4F46E5]"
            >
              <option value="All">{t('All Actions')}</option>
              {[...new Set(logs.map(log => log.action).filter(Boolean))].map(action => (
                <option key={action} value={action}>{t(action)}</option>
              ))}
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
                placeholder={t('Search user, event description...')}
                className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 font-semibold outline-none focus:border-[#4F46E5]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {t('System Event Log Statements (')} {filteredLogs.length})
          </h3>
          {(roleFilter !== 'All' || actionFilter !== 'All' || startDate || endDate || searchTerm) && (
            <button
              onClick={() => { setRoleFilter('All'); setActionFilter('All'); setStartDate(''); setEndDate(''); setSearchTerm(''); }}
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
                <th className="py-3.5 px-4">{t('Timestamp')}</th>
                <th className="py-3.5 px-4">{t('Operator / User')}</th>
                <th className="py-3.5 px-4">{t('Role')}</th>
                <th className="py-3.5 px-4">{t('Action Type')}</th>
                <th className="py-3.5 px-4">{t('Event Details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    {t('Fetching System Audit Log Entries...')}
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 italic">
                    {t('No system audit logs found.')}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono">{l.timestamp}</td>
                    <td className="py-3.5 px-4 font-bold">{l.user || t('System')}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {t(l.role || 'Admin')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{t(l.action)}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{l.details}</td>
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
