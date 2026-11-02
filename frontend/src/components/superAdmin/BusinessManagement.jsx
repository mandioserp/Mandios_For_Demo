import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { 
  Building2, Search, Filter, Plus, Edit2, Eye, 
  Calendar, Clock, Key,
  LogIn, CheckCircle, XCircle, RefreshCw, Sparkles, MapPin, Phone, Mail, User
} from 'lucide-react';

export default function BusinessManagement({
  businesses,
  loading,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  planFilter,
  setPlanFilter,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenViewModal,
  onOpenExtendModal,
  onOpenResetPasswordModal,
  onToggleStatus,
  onImpersonate,
  onRefresh
}) {
  const { t, language } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter businesses
  const filtered = businesses.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.businessName && b.businessName.toLowerCase().includes(q)) ||
      (b.ownerName && b.ownerName.toLowerCase().includes(q)) ||
      (b.businessCode && b.businessCode.toLowerCase().includes(q)) ||
      (b.arthiCode && b.arthiCode.toLowerCase().includes(q)) ||
      (b.email && b.email.toLowerCase().includes(q)) ||
      (b.phone && b.phone.toLowerCase().includes(q)) ||
      (b.city && b.city.toLowerCase().includes(q)) ||
      (b.tenantId && b.tenantId.toLowerCase().includes(q))
    );

    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'Active' && b.status === 'Active') ||
      (statusFilter === 'Suspended' && b.status === 'Suspended') ||
      (statusFilter === 'Expired' && b.status === 'Expired') ||
      (statusFilter === 'Trial' && (b.plan === 'Trial' || b.subscriptionPlan === 'Trial'));

    const matchesPlan = planFilter === 'all' || (b.plan === planFilter || b.subscriptionPlan === planFilter);

    return matchesSearch && matchesStatus && matchesPlan;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedBusinesses = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status, plan) => {
    if (status === 'Suspended') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          <XCircle className="w-3 h-3" /> {t('Suspended')}
        </span>
      );
    }
    if (status === 'Expired') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <Clock className="w-3 h-3" /> {t('Expired')}
        </span>
      );
    }
    if (plan === 'Trial' || status === 'Trial') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
          <Sparkles className="w-3 h-3" /> {t('Trial')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        <CheckCircle className="w-3 h-3" /> {t('Active')}
      </span>
    );
  };

  const getPlanBadge = (plan) => {
    const p = plan || 'Pro';
    switch (p) {
      case 'Enterprise':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700">{t('Enterprise')}</span>;
      case 'Pro':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300 dark:border-blue-700">{t('Pro')}</span>;
      case 'Basic':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">{t('Basic')}</span>;
      case 'Trial':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">{t('Trial')}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{p}</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return t('N/A');
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
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
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            {t('Registered Businesses (Tenants)')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Manage multi-tenant isolation, subscriptions, accounts and statuses')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition"
            title={t('Refresh list')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('Register Business')}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t('Search by business name, reg #, owner, email, phone, city...')}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white appearance-none"
          >
            <option value="all">{t('All Statuses')}</option>
            <option value="Active">{t('Active Only')}</option>
            <option value="Trial">{t('Trial Only')}</option>
            <option value="Expired">{t('Expired')}</option>
            <option value="Suspended">{t('Suspended')}</option>
          </select>
        </div>

        {/* Plan Filter */}
        <div className="relative">
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          >
            <option value="all">{t('All Subscription Plans')}</option>
            <option value="Trial">{t('Trial')}</option>
            <option value="Basic">{t('Basic')}</option>
            <option value="Pro">{t('Pro')}</option>
            <option value="Enterprise">{t('Enterprise')}</option>
          </select>
        </div>
      </div>

      {/* Business Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">{t('Business & Reg #')}</th>
                <th className="px-4 py-3.5">{t('Owner & Contact')}</th>
                <th className="px-4 py-3.5">{t('Location')}</th>
                <th className="px-4 py-3.5">{t('Reg. Date')}</th>
                <th className="px-4 py-3.5">{t('Plan & Expiry')}</th>
                <th className="px-4 py-3.5 text-center">{t('Users')}</th>
                <th className="px-4 py-3.5">{t('Last Activity')}</th>
                <th className="px-4 py-3.5 text-center">{t('Status')}</th>
                <th className="px-4 py-3.5 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {paginatedBusinesses.map((biz) => {
                const bizId = biz.id || biz._id;
                return (
                  <tr key={bizId} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition">
                    {/* Business Name & Reg # */}
                    <td className="px-4 py-3.5">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {biz.name || biz.businessName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          <span className="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-semibold">
                            {biz.businessCode || 'BUS-1001'}
                          </span>
                          <span>•</span>
                          <span>{t('Arthi')}: <strong>{biz.arthiCode || 'N/A'}</strong></span>
                        </div>
                      </div>
                    </td>

                    {/* Owner & Contact */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {biz.ownerName || t('Admin')}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {biz.email}
                        </div>
                        {biz.phone && (
                          <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {biz.phone}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3.5">
                      <div className="text-slate-700 dark:text-slate-300 flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                        <span>{biz.city || biz.address || t('Pakistan')}</span>
                      </div>
                    </td>

                    {/* Registration Date */}
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(biz.registrationDate || biz.createdAt)}
                    </td>

                    {/* Plan & Expiry */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div>{getPlanBadge(biz.plan || biz.subscriptionPlan)}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {t('Exp')}: {formatDate(biz.subscriptionExpiresAt || biz.subscriptionExpiryDate)}
                        </div>
                      </div>
                    </td>

                    {/* Users Count */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md font-bold text-xs">
                        {biz.totalUsers ?? 1}
                      </span>
                    </td>

                    {/* Last Activity */}
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                      {formatActivity(biz.lastActivity)}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5 text-center">
                      {getStatusBadge(biz.status, biz.plan)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Details */}
                        <button
                          onClick={() => onOpenViewModal(biz)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                          title={t('View Business Details')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit Business */}
                        <button
                          onClick={() => onOpenEditModal(biz)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                          title={t('Edit Business Information')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Extend Subscription */}
                        <button
                          onClick={() => onOpenExtendModal(biz)}
                          className="p-1.5 text-slate-600 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                          title={t('Change Plan / Extend Subscription')}
                        >
                          <Clock className="w-4 h-4" />
                        </button>

                        {/* Reset Owner Password */}
                        <button
                          onClick={() => onOpenResetPasswordModal(biz)}
                          className="p-1.5 text-slate-600 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                          title={t('Reset Owner Password')}
                        >
                          <Key className="w-4 h-4" />
                        </button>

                        {/* Toggle Suspend / Activate */}
                        <button
                          onClick={() => onToggleStatus(biz)}
                          className={`p-1.5 rounded-lg transition ${
                            biz.status === 'Active'
                              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                          }`}
                          title={t(biz.status === 'Active' ? 'Suspend Business' : 'Activate Business')}
                        >
                          {biz.status === 'Active' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>

                        {/* Impersonate Support Session */}
                        <button
                          onClick={() => onImpersonate(biz)}
                          className="p-1.5 text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                          title={t('Support Impersonation Login')}
                        >
                          <LogIn className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedBusinesses.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-slate-400">
                    {t('No businesses match the current search or filters.')}
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
              {t('Showing {{from}} to {{to}} of {{count}} businesses', {
                from: (currentPage - 1) * itemsPerPage + 1,
                to: Math.min(currentPage * itemsPerPage, filtered.length),
                count: filtered.length,
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
