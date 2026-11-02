import React from 'react';
import { 
  Building2, Users, CheckCircle2, AlertTriangle, XCircle, 
  Clock, ShieldAlert, TrendingUp, Calendar, ArrowUpRight, Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend 
} from 'recharts';

export default function SuperAdminOverview({ 
  stats, 
  onNavigateTab, 
  onOpenExtendModal, 
  onSelectBusiness 
}) {
  const totalBiz = stats?.totalBusinesses || 0;
  const activeBiz = stats?.activeBusinesses || 0;
  const trialBiz = stats?.trialBusinesses || 0;
  const suspendedBiz = stats?.suspendedBusinesses || 0;
  const expiredBiz = stats?.expiredBusinesses || 0;
  const expiringSoonBiz = stats?.expiringSoonBusinesses || 0;
  const totalUsers = stats?.totalUsers || 0;

  const kpis = [
    {
      label: 'Total Businesses',
      value: totalBiz,
      sub: 'All registered tenants',
      icon: Building2,
      color: 'from-blue-600 to-indigo-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      tab: 'businesses',
      filter: 'all',
    },
    {
      label: 'Active Businesses',
      value: activeBiz,
      sub: `${totalBiz ? Math.round((activeBiz / totalBiz) * 100) : 0}% of platform`,
      icon: CheckCircle2,
      color: 'from-emerald-600 to-teal-600',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      tab: 'businesses',
      filter: 'Active',
    },
    {
      label: 'Trial Businesses',
      value: trialBiz,
      sub: 'Evaluation period',
      icon: Sparkles,
      color: 'from-purple-600 to-indigo-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      tab: 'businesses',
      filter: 'Trial',
    },
    {
      label: 'Expiring Soon',
      value: expiringSoonBiz,
      sub: 'Expires in ≤ 30 days',
      icon: Clock,
      color: 'from-amber-500 to-orange-600',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      tab: 'subscriptions',
      filter: 'expiring',
      highlight: expiringSoonBiz > 0,
    },
    {
      label: 'Expired Businesses',
      value: expiredBiz,
      sub: 'Needs renewal',
      icon: AlertTriangle,
      color: 'from-red-600 to-rose-600',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      tab: 'businesses',
      filter: 'Expired',
    },
    {
      label: 'Suspended',
      value: suspendedBiz,
      sub: 'Deactivated tenants',
      icon: XCircle,
      color: 'from-slate-600 to-gray-700',
      textColor: 'text-slate-600',
      bgColor: 'bg-slate-100 dark:bg-slate-800/40',
      tab: 'businesses',
      filter: 'Suspended',
    },
    {
      label: 'Total Platform Users',
      value: totalUsers,
      sub: 'Admins & clerks across tenants',
      icon: Users,
      color: 'from-cyan-600 to-blue-600',
      textColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      tab: 'users',
      filter: 'all',
    }
  ];

  // Chart data
  const registrationData = stats?.registrationsOverTime || [
    { month: 'Month 1', count: 1, active: 1 },
    { month: 'Month 2', count: 2, active: 2 },
    { month: 'Month 3', count: 3, active: 3 },
  ];

  const planData = [
    { name: 'Trial', value: stats?.planCounts?.Trial || 0, color: '#8b5cf6' },
    { name: 'Basic', value: stats?.planCounts?.Basic || 0, color: '#3b82f6' },
    { name: 'Pro', value: stats?.planCounts?.Pro || 0, color: '#10b981' },
    { name: 'Enterprise', value: stats?.planCounts?.Enterprise || 0, color: '#f59e0b' },
  ].filter(item => item.value > 0);

  const statusData = [
    { name: 'Active', value: activeBiz, color: '#10b981' },
    { name: 'Trial', value: trialBiz, color: '#8b5cf6' },
    { name: 'Expiring', value: expiringSoonBiz, color: '#f59e0b' },
    { name: 'Expired', value: expiredBiz, color: '#ef4444' },
    { name: 'Suspended', value: suspendedBiz, color: '#64748b' },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Expiring Subscriptions Notification Banner */}
      {stats?.expiringSoonList && stats.expiringSoonList.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-300 dark:border-amber-700/50 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-lg shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-amber-900 dark:text-amber-200">
                {stats.expiringSoonList.length} Business Subscription(s) Expiring Soon
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {stats.expiringSoonList.slice(0, 3).map(b => `${b.name} (${b.daysLeft}d left)`).join(', ')}
                {stats.expiringSoonList.length > 3 ? ` and ${stats.expiringSoonList.length - 3} more.` : '.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('subscriptions', 'expiring')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 self-start md:self-auto"
          >
            Review & Extend
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={() => onNavigateTab(kpi.tab, kpi.filter)}
              className={`cursor-pointer group relative overflow-hidden bg-white dark:bg-slate-800 p-5 rounded-2xl border ${
                kpi.highlight ? 'border-amber-400 dark:border-amber-600 shadow-md ring-2 ring-amber-400/20' : 'border-slate-200 dark:border-slate-700'
              } hover:shadow-lg transition duration-200`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {kpi.label}
                </span>
                <div className={`p-2.5 rounded-xl ${kpi.bgColor} ${kpi.textColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {kpi.value}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                <span>{kpi.sub}</span>
                <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition text-[11px] font-medium flex items-center gap-0.5">
                  View <ArrowUpRight className="w-3 h-3" />
                </span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Business Registrations & Growth
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monthly new tenant onboarding</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={registrationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" name="New Businesses" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan & Status Breakdown */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Subscription Plans Breakdown
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Active subscriptions by tier</p>
            
            {planData.length > 0 ? (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      innerRadius={40}
                      paddingAngle={3}
                    >
                      {planData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                No active plan distribution data
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            {planData.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-xs text-slate-600 dark:text-slate-400">{p.name}: <strong className="text-slate-900 dark:text-white">{p.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Recent Businesses & Expiring Subscriptions List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Businesses */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Recently Registered Businesses
            </h3>
            <button
              onClick={() => onNavigateTab('businesses')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {(stats?.recentBusinesses || []).map((biz) => (
              <div key={biz.id} className="py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {biz.name}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Owner: {biz.ownerName || 'Admin'} • Plan: {biz.plan || 'Pro'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
                    biz.status === 'Active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {biz.status || 'Active'}
                  </span>
                  <button
                    onClick={() => onSelectBusiness(biz)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                    title="View details"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {(!stats?.recentBusinesses || stats.recentBusinesses.length === 0) && (
              <p className="py-4 text-xs text-center text-slate-400">No businesses registered yet.</p>
            )}
          </div>
        </div>

        {/* Expiring Soon Quick Actions */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Expiring Subscriptions (≤ 30 Days)
            </h3>
            <button
              onClick={() => onNavigateTab('subscriptions', 'expiring')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View Tracker
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {(stats?.expiringSoonList || []).slice(0, 5).map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.name}
                  </h4>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Expires in {item.daysLeft} day(s) ({item.expiry})
                  </p>
                </div>
                <button
                  onClick={() => onOpenExtendModal(item)}
                  className="px-3 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-lg transition"
                >
                  Extend Plan
                </button>
              </div>
            ))}
            {(!stats?.expiringSoonList || stats.expiringSoonList.length === 0) && (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                <p className="text-xs text-slate-500 dark:text-slate-400">All tenant subscriptions are healthy and up to date.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
