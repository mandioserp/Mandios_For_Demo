import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  Layers,
  Percent,
  Clock,
  Wallet,
  Boxes,
  CreditCard,
  UserX,
  ArrowDownCircle,
  Receipt,
  TrendingDown,
  TrendingUp,
  BarChart2,
  PieChart,
  AlertTriangle,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { REPORTS_CONFIG, REPORTS_SECTIONS } from '../../config/reportsConfig';
import { useLanguage } from '../../context/LanguageContext.jsx';

const ICON_MAP = {
  BookOpen,
  FileText,
  Layers,
  Percent,
  Clock,
  Wallet,
  Boxes,
  CreditCard,
  UserX,
  ArrowDownCircle,
  Receipt,
  TrendingDown,
  TrendingUp,
  BarChart2,
  PieChart,
  AlertTriangle,
  ShoppingBag
};

export default function ReportsHub({ user }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTierFilter, setActiveTierFilter] = useState('All');

  const userRole = user?.role || 'Clerk';

  // Helper to check role permission
  const isAllowed = (report) => {
    if (userRole === 'super_admin') return true;
    return report.allowedRoles.includes(userRole);
  };

  const allReports = Object.values(REPORTS_CONFIG);

  const filteredReports = allReports.filter(report => {
    if (!isAllowed(report)) return false;
    if (activeTierFilter !== 'All' && report.tierLevel !== parseInt(activeTierFilter)) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = report.name.toLowerCase().includes(term);
      const matchDesc = report.description.toLowerCase().includes(term);
      const matchPurpose = report.purpose.toLowerCase().includes(term);
      return matchName || matchDesc || matchPurpose;
    }
    return true;
  });

  const handleOpenReport = (id, newWindow = false) => {
    if (newWindow) {
      window.open(`/reports/${id}`, '_blank');
    } else {
      navigate(`/reports/${id}`);
    }
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('Centralized Intelligence & Auditing')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {t('Reports Hub')}
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              {t('Access real-time financial, operational, and business analytics reports for Mandi OS. Select a report below to inspect detailed transaction ledgers, charts, and downloadable statements.')}
            </p>
          </div>

          {/* Quick Stats or User Role Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-slate-300">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">{t('Active Role')}</span>
              <span className="font-semibold text-emerald-400">{t(userRole)}</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-slate-300">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">{t('Available Reports')}</span>
              <span className="font-semibold text-white">{filteredReports.length} {t('Active')}</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('Search report name, description or metrics...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['All', '1', '2', '3'].map((tierVal) => {
              const label = tierVal === 'All' ? t('All Tiers') : `${t('Tier')} ${tierVal}`;
              const isActive = activeTierFilter === tierVal;
              return (
                <button
                  key={tierVal}
                  onClick={() => setActiveTierFilter(tierVal)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reports Sections */}
      {REPORTS_SECTIONS.map((section) => {
        const sectionReports = filteredReports.filter(r => r.section === section.title);
        if (sectionReports.length === 0) return null;

        return (
          <div key={section.id} className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t(section.title)}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${section.badgeColor}`}>
                  {t(section.tier)}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {sectionReports.length} {t(sectionReports.length === 1 ? 'Report' : 'Reports')}
              </span>
            </div>

            {/* Section Description */}
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
              {t(section.description)}
            </p>

            {/* Grid of Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
              {sectionReports.map((report) => {
                const IconComponent = ICON_MAP[report.iconName] || FileText;

                return (
                  <div
                    key={report.id}
                    onClick={() => handleOpenReport(report.id, false)}
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
                  >
                    {/* Top row */}
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-200 shadow-sm">
                          <IconComponent className="w-5 h-5" />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${section.badgeColor}`}>
                            T{report.tierLevel}
                          </span>
                          <button
                            title={t('Open in new window')}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReport(report.id, true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {t(report.name)}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                        {t(report.description)}
                      </p>
                    </div>

                    {/* Footer / CTA */}
                    <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px] font-medium">
                        {report.dataSources.slice(0, 2).map(source => t(source)).join(' • ')}
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                        <span>{t('View Report')}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filteredReports.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{t('No reports matched your filter')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('Try clearing your search keyword or switching your tier filter.')}</p>
          <button
            onClick={() => { setSearchTerm(''); setActiveTierFilter('All'); }}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            {t('Reset Filters')}
          </button>
        </div>
      )}
    </div>
  );
}
