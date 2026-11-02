import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { 
  Users, Search, CheckCircle, XCircle, Mail, Phone, Building2, Eye
} from 'lucide-react';

export default function UserOverview({
  users,
  loading,
  onToggleUserStatus,
  onViewUserDetails
}) {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q)) ||
      (u.businessName && u.businessName.toLowerCase().includes(q)) ||
      (u.tenantId && u.tenantId.toLowerCase().includes(q))
    );

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'super_admin':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300">{t('Super Admin')}</span>;
      case 'Admin':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300">{t('Tenant Admin')}</span>;
      case 'Clerk':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300">{t('Clerk')}</span>;
      case 'Customer':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300">{t('Customer')}</span>;
      case 'Supplier':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-300">{t('Beopari/Grower')}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">{role}</span>;
    }
  };

  const formatActivity = (timestamp) => {
    if (!timestamp) return t('No activity yet');
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return timestamp;
      return d.toLocaleString(language === 'ur' ? 'ur-PK' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-600" />
            {t('Platform Users Overview')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Cross-tenant user directory, account statuses and login activity')}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-xl">
            {t('Total Users: {{count}}', { count: users.length })}
          </span>
          <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl">
            {t('Active: {{count}}', { count: users.filter(u => u.status === 'Active').length })}
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t('Search by name, email, phone, or business...')}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 dark:text-white"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 dark:text-white"
          >
            <option value="all">{t('All Roles')}</option>
            <option value="Admin">{t('Tenant Admin')}</option>
            <option value="Clerk">{t('Clerk')}</option>
            <option value="Customer">{t('Customer')}</option>
            <option value="Supplier">{t('Beopari/Grower')}</option>
            <option value="super_admin">{t('Super Admin')}</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 dark:text-white"
          >
            <option value="all">{t('All Statuses')}</option>
            <option value="Active">{t('Active Only')}</option>
            <option value="Inactive">{t('Inactive Only')}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">{t('User Name')}</th>
                <th className="px-4 py-3.5">{t('Contact Details')}</th>
                <th className="px-4 py-3.5">{t('Role')}</th>
                <th className="px-4 py-3.5">{t('Associated Business / Tenant')}</th>
                <th className="px-4 py-3.5">{t('Last Login / Activity')}</th>
                <th className="px-4 py-3.5 text-center">{t('Status')}</th>
                <th className="px-4 py-3.5 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {paginatedUsers.map((u) => {
                const isSuperAdmin = u.role === 'super_admin';
                const isActive = u.status === 'Active';
                return (
                  <tr key={u.id || u._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{u.name}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        <div className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.email}</span>
                        </div>
                        {u.phone && (
                          <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 text-[11px]">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {getRoleBadge(u.role)}
                    </td>

                    <td className="px-4 py-3.5">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {u.businessName || t('Mandi Business')}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {t('Tenant')}: {u.tenantId || 'platform'}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                      {formatActivity(u.lastLogin)}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isActive 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {t(u.status || 'Active')}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewUserDetails(u)}
                          className="p-1.5 text-slate-600 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                          title={t('View User Details')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!isSuperAdmin && (
                          <button
                            onClick={() => onToggleUserStatus(u)}
                            className={`p-1.5 rounded-lg transition ${
                              isActive 
                                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30' 
                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                            }`}
                            title={t(isActive ? 'Deactivate User' : 'Activate User')}
                          >
                            {isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                    {loading ? t('Loading users...') : t('No users match the search criteria.')}
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
              {t('Showing {{from}} to {{to}} of {{count}} users', {
                from: (currentPage - 1) * itemsPerPage + 1,
                to: Math.min(currentPage * itemsPerPage, filteredUsers.length),
                count: filteredUsers.length,
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
