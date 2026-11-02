import { Calendar, Filter } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const DATE_RANGE_OPTIONS = [
  { key: 'ALL', label: 'All Time' },
  { key: '1D', label: 'Today' },
  { key: '7D', label: 'Last 7 Days' },
  { key: '30D', label: 'Last 30 Days' },
  { key: '3M', label: 'Last 3 Months' },
  { key: '12M', label: 'This Year' },
  { key: 'Custom', label: 'Custom Range' }
];

export function getRangeDates(rangeKey, customStart, customEnd) {
  const now = new Date();
  let start = new Date();
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (rangeKey === '1D') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (rangeKey === '7D') {
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === '30D') {
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === '3M') {
    start.setMonth(now.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === '6M') {
    start.setMonth(now.getMonth() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === '12M') {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  } else if (rangeKey === 'Custom') {
    if (customStart) {
      start = new Date(customStart + 'T00:00:00');
    } else {
      start = new Date(2000, 0, 1);
    }
    if (customEnd) {
      end = new Date(customEnd + 'T23:59:59');
    }
  } else if (rangeKey === 'ALL') {
    start = new Date(2000, 0, 1);
  }

  return { start, end };
}

export function filterRecordsByDate(records, rangeKey, customStart, customEnd, dateField = 'date') {
  if (!Array.isArray(records)) return [];
  if (rangeKey === 'ALL' || !rangeKey) return records;
  const { start, end } = getRangeDates(rangeKey, customStart, customEnd);

  return records.filter(item => {
    const rawDate = item[dateField] || item.createdAt;
    if (!rawDate) return false;
    let d;
    if (typeof rawDate === 'string' && !rawDate.includes('T') && rawDate.split('-').length === 3) {
      const parts = rawDate.split('-');
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      d = new Date(rawDate);
    }
    return !isNaN(d.getTime()) && d >= start && d <= end;
  });
}

export default function DateRangeFilter({
  selectedRange,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  grouping,
  onGroupingChange
}) {
  const { t } = useLanguage();
  return (
    <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200">
        <div className="p-2 bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400 rounded-xl">
          <Calendar size={18} />
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider">{t('Analytics Timeframe')}</h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('Filter all visual metrics and financial trends')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-x-auto max-w-full">
          {DATE_RANGE_OPTIONS.map(opt => {
            const active = selectedRange === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onRangeChange(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-[#4F46E5] text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t(opt.label)}
              </button>
            );
          })}
        </div>

        {selectedRange === 'Custom' && (
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <input
              type="date"
              value={customStart || ''}
              onChange={e => onCustomStartChange(e.target.value)}
              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
            />
            <span className="text-slate-400 text-xs font-bold">{t('to')}</span>
            <input
              type="date"
              value={customEnd || ''}
              onChange={e => onCustomEndChange(e.target.value)}
              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
            />
          </div>
        )}

        {grouping !== undefined && onGroupingChange && (
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 ml-auto md:ml-2">
            <Filter size={12} className="text-slate-400 ml-1" />
            {['daily', 'weekly', 'monthly'].map(g => (
              <button
                key={g}
                type="button"
                onClick={() => onGroupingChange(g)}
                className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-extrabold transition-all ${
                  grouping === g
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t(g)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
