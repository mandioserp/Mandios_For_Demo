import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { 
  FileText, Search, Shield, Clock, RefreshCw
} from 'lucide-react';

export default function SuperAdminAuditLogs({ logs, loading, onRefresh }) {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredLogs = logs.filter(l => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.performedBy && l.performedBy.toLowerCase().includes(q)) ||
      (l.businessName && l.businessName.toLowerCase().includes(q)) ||
      (l.tenantId && l.tenantId.toLowerCase().includes(q)) ||
      (l.details && l.details.toLowerCase().includes(q))
    );

    const matchesAction = actionFilter === 'all' || l.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getActionBadge = (action) => {
    if (action.includes('REGISTER') || action.includes('CREATED')) {
      return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{t(action)}</span>;
    }
    if (action.includes('ACTIVATED')) {
      return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{t(action)}</span>;
    }
    if (action.includes('SUSPENDED') || action.includes('DEACTIVATED') || action.includes('DELETE')) {
      return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{t(action)}</span>;
    }
    if (action.includes('EXTEND') || action.includes('PLAN') || action.includes('SUBSCRIPTION')) {
      return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{t(action)}</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">{t(action)}</span>;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return t('N/A');
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString(language === 'ur' ? 'ur-PK' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            {t('Super Admin Activity & Audit Logs')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Immutable platform action records and administrative events trail')}
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition self-start md:self-auto"
          title={t('Refresh logs')}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t('Search by action, performed by, tenant, or details...')}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>

        <div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
          >
            <option value="all">{t('All Actions')}</option>
            <option value="BUSINESS_REGISTERED">{t('BUSINESS_REGISTERED')}</option>
            <option value="BUSINESS_EDITED">{t('BUSINESS_EDITED')}</option>
            <option value="BUSINESS_ACTIVATED">{t('BUSINESS_ACTIVATED')}</option>
            <option value="BUSINESS_SUSPENDED">{t('BUSINESS_SUSPENDED')}</option>
            <option value="SUBSCRIPTION_EXTENDED">{t('SUBSCRIPTION_EXTENDED')}</option>
            <option value="SUBSCRIPTION_CHANGED">{t('SUBSCRIPTION_CHANGED')}</option>
            <option value="USER_ACTIVATED">{t('USER_ACTIVATED')}</option>
            <option value="USER_DEACTIVATED">{t('USER_DEACTIVATED')}</option>
            <option value="PASSWORD_RESET">{t('PASSWORD_RESET')}</option>
            <option value="SETTINGS_UPDATED">{t('SETTINGS_UPDATED')}</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">{t('Action')}</th>
                <th className="px-4 py-3.5">{t('Performed By')}</th>
                <th className="px-4 py-3.5">{t('Target Business / Tenant')}</th>
                <th className="px-4 py-3.5">{t('Timestamp')}</th>
                <th className="px-4 py-3.5">{t('Details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {paginatedLogs.map((log) => (
                <tr key={log.id || log._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {getActionBadge(log.action)}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{log.performedBy}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {log.businessName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {log.tenantId}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                    <span className="line-clamp-2">{log.details || t('N/A')}</span>
                  </td>
                </tr>
              ))}

              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                    {t('No audit records match the current filters.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
            <span>
              {t('Showing {{from}} to {{to}} of {{count}} logs', {
                from: (currentPage - 1) * itemsPerPage + 1,
                to: Math.min(currentPage * itemsPerPage, filteredLogs.length),
                count: filteredLogs.length,
              })}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {t('Previous')}
              </button>
              <span className="px-2 font-medium text-slate-800 dark:text-white">
                {t('Page {{current}} of {{total}}', { current: currentPage, total: totalPages })}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {t('Next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
