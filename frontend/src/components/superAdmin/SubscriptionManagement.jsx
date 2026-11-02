import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { 
  Layers, Plus, CheckCircle2, Sparkles, Edit2, Trash2, Search
} from 'lucide-react';

export default function SubscriptionManagement({
  plans,
  businesses,
  onOpenCreatePlanModal,
  onOpenEditPlanModal,
  onTogglePlanStatus,
  onDeletePlan,
  onOpenExtendModal
}) {
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState('plans'); // 'plans' | 'tracker'
  const [subFilter, setSubFilter] = useState('all'); // 'all' | 'active' | 'expiring' | 'expired' | 'trial'
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAhead = new Date();
  thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
  const thirtyDaysStr = thirtyDaysAhead.toISOString().split('T')[0];

  // Filter business subscriptions
  const filteredSubscriptions = businesses.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.ownerName && b.ownerName.toLowerCase().includes(q)) ||
      (b.businessCode && b.businessCode.toLowerCase().includes(q)) ||
      (b.tenantId && b.tenantId.toLowerCase().includes(q))
    );

    const expiry = b.subscriptionExpiresAt || b.subscriptionExpiryDate;
    const plan = b.plan || b.subscriptionPlan || 'Pro';
    const status = b.status || b.subscriptionStatus || 'Active';

    let matchesFilter = true;
    if (subFilter === 'active') {
      matchesFilter = status === 'Active' && (!expiry || expiry >= today);
    } else if (subFilter === 'expiring') {
      matchesFilter = expiry && expiry >= today && expiry <= thirtyDaysStr;
    } else if (subFilter === 'expired') {
      matchesFilter = expiry && expiry < today;
    } else if (subFilter === 'trial') {
      matchesFilter = plan === 'Trial';
    }

    return matchesSearch && matchesFilter;
  });

  const getDaysLeft = (expiry) => {
    if (!expiry) return { text: t('Unlimited'), color: 'text-slate-500' };
    const expDate = new Date(expiry);
    const nowDate = new Date(today);
    const diff = Math.ceil((expDate - nowDate) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: t('Expired {{days}}d ago', { days: Math.abs(diff) }), color: 'text-red-600 dark:text-red-400 font-bold' };
    if (diff === 0) return { text: t('Expires Today'), color: 'text-red-600 dark:text-red-400 font-bold' };
    if (diff <= 30) return { text: t('{{days}} days left', { days: diff }), color: 'text-amber-600 dark:text-amber-400 font-semibold' };
    return { text: t('{{days}} days left', { days: diff }), color: 'text-emerald-600 dark:text-emerald-400' };
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Tabs */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            {t('Subscription & Plan Management')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Define pricing tiers, features, and track client subscription lifecycles')}
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setSubTab('plans')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                subTab === 'plans' 
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {t('Subscription Plans Catalog')}
            </button>
            <button
              onClick={() => setSubTab('tracker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                subTab === 'tracker' 
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {t('Tenant Subscriptions Tracker ({{count}})', { count: businesses.length })}
            </button>
          </div>

          {subTab === 'plans' && (
            <button
              onClick={onOpenCreatePlanModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {t('Create Plan')}
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: SUBSCRIPTION PLANS CATALOG */}
      {subTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const planId = plan.id || plan._id;
            const isActive = plan.status !== 'Inactive';
            return (
              <div
                key={planId}
                className={`relative bg-white dark:bg-slate-800 rounded-2xl border ${
                  plan.isPopular 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg' 
                    : 'border-slate-200 dark:border-slate-700 shadow-sm'
                } p-6 flex flex-col justify-between transition hover:shadow-md`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 right-6 px-3 py-0.5 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                    {t('Most Popular')}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {t(isActive ? 'Active' : 'Inactive')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[32px]">
                    {plan.description || t('Standard MandiOS ERP plan')}
                  </p>

                  <div className="mt-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        Rs. {plan.priceMonthly?.toLocaleString() || '0'}
                      </span>
                      <span className="text-xs text-slate-500">{t('/ month')}</span>
                    </div>
                    {plan.priceAnnual > 0 && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t('Rs. {{price}} billed annually (save ~15%)', { price: plan.priceAnnual?.toLocaleString() })}
                      </p>
                    )}
                  </div>

                  {/* Quotas & Features */}
                  <div className="mt-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>{t('Max Users:')}</span>
                      <strong className="text-slate-900 dark:text-white">{plan.maxUsers || t('Unlimited')}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>{t('Max Products:')}</span>
                      <strong className="text-slate-900 dark:text-white">{plan.maxProducts || t('Unlimited')}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>{t('Duration Preset:')}</span>
                      <strong className="text-slate-900 dark:text-white">{t(plan.duration || '1 Month')}</strong>
                    </div>

                    <div className="pt-2 space-y-1.5">
                      {plan.features?.logistics && (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('Truck & Logistics Management')}</span>
                        </div>
                      )}
                      {plan.features?.returnsModule && (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('Returns & Crates Lifecycle')}</span>
                        </div>
                      )}
                      {plan.features?.reportsExport && (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('PDF & Excel Financial Ledgers')}</span>
                        </div>
                      )}
                      {plan.features?.prioritySupport && (
                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('Priority 24/7 Phone Support')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Plan Card Actions */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onTogglePlanStatus(plan)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                      isActive 
                        ? 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700' 
                        : 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30'
                    }`}
                  >
                    {t(isActive ? 'Deactivate' : 'Activate')}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenEditPlanModal(plan)}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                      title={t('Edit Plan')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeletePlan(plan)}
                      className="p-1.5 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                      title={t('Delete Plan')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: BUSINESS SUBSCRIPTIONS TRACKER */}
      {subTab === 'tracker' && (
        <div className="space-y-4">
          {/* Tracker Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {[
                { id: 'all', label: t('All') },
                { id: 'active', label: t('Active') },
                { id: 'expiring', label: t('Expiring Soon (≤30d)') },
                { id: 'expired', label: t('Expired') },
                { id: 'trial', label: t('Trial') },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSubFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    subFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Search business or reg #...')}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
            </div>
          </div>

          {/* Tracker Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">{t('Business')}</th>
                    <th className="px-4 py-3">{t('Current Plan')}</th>
                    <th className="px-4 py-3">{t('Start Date')}</th>
                    <th className="px-4 py-3">{t('Expiry Date')}</th>
                    <th className="px-4 py-3">{t('Days Remaining')}</th>
                    <th className="px-4 py-3 text-center">{t('Status')}</th>
                    <th className="px-4 py-3 text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredSubscriptions.map((biz) => {
                    const daysInfo = getDaysLeft(biz.subscriptionExpiresAt || biz.subscriptionExpiryDate);
                    return (
                      <tr key={biz.id || biz._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">{biz.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{biz.businessCode || 'BUS-1001'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {t(biz.plan || biz.subscriptionPlan || 'Pro')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {biz.registrationDate || biz.subscriptionStartDate || biz.createdAt || 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                          {biz.subscriptionExpiresAt || biz.subscriptionExpiryDate || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={daysInfo.color}>{daysInfo.text}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            biz.status === 'Active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {t(biz.status || 'Active')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onOpenExtendModal(biz)}
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-xs font-semibold rounded-lg transition"
                          >
                            {t('Extend / Change Plan')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSubscriptions.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                        {t('No subscriptions found matching the selected filter.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
