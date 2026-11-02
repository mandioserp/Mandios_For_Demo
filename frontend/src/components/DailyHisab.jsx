import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Printer, Search, Users, Truck, RefreshCw } from 'lucide-react';
import api from '../utils/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import PrintReportHeader from './common/PrintReportHeader.jsx';

function localDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function DailyHisab() {
  const { t } = useLanguage();
  const [date, setDate] = useState(localDateString);
  const [section, setSection] = useState('Customer');
  const [search, setSearch] = useState('');
  const [hisab, setHisab] = useState({ customers: [], suppliers: [], customerTotals: {}, supplierTotals: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    api.get('/daily-hisab', { params: { date } })
      .then(response => { if (isCurrent) setHisab(response.data || {}); })
      .catch(err => { if (isCurrent) setError(err.response?.data?.error || t('Failed to load Daily Hisab')); })
      .finally(() => { if (isCurrent) setLoading(false); });
    return () => { isCurrent = false; };
  }, [date, refreshKey, t]);

  const rows = useMemo(() => section === 'Customer' ? (hisab.customers || []) : (hisab.suppliers || []), [hisab.customers, hisab.suppliers, section]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.partyName, row.phone, row.khataId]
      .some(value => String(value || '').toLocaleLowerCase().includes(term)));
  }, [rows, search]);
  const filteredTotals = useMemo(() => filteredRows.reduce((sum, row) => ({
    previousBalance: sum.previousBalance + row.previousBalance,
    todayPurchases: sum.todayPurchases + row.todayPurchases,
    totalOutstanding: sum.totalOutstanding + row.totalOutstanding,
    todayPayment: sum.todayPayment + row.todayPayment,
    remainingBalance: sum.remainingBalance + row.remainingBalance,
  }), { previousBalance: 0, todayPurchases: 0, totalOutstanding: 0, todayPayment: 0, remainingBalance: 0 }), [filteredRows]);
  const table = (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
      <table className="w-full min-w-[940px] text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            <th className="py-3 px-4">{t(section)}</th>
            <th className="py-3 px-4 text-right">{t('Previous Balance')}</th>
            <th className="py-3 px-4 text-right">{t("Today's Purchases")}</th>
            <th className="py-3 px-4 text-right">{t('Total Outstanding')}</th>
            <th className="py-3 px-4 text-right">{t("Today's Payment")}</th>
            <th className="py-3 px-4 text-right">{t('Remaining Balance')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
          {filteredRows.map((row) => (
            <tr key={`${row.partyType}-${row.partyId}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="py-3 px-4">
                <div className="font-bold text-slate-800 dark:text-slate-100">{row.partyName}</div>
                <div className="text-[10px] text-slate-500">{row.khataId ? `${row.khataId} · ` : ''}{row.phone}</div>
              </td>
              <td className="py-3 px-4 text-right tabular-nums">{money(row.previousBalance)}</td>
              <td className="py-3 px-4 text-right tabular-nums">{money(row.todayPurchases)}</td>
              <td className="py-3 px-4 text-right font-semibold tabular-nums">{money(row.totalOutstanding)}</td>
              <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">{money(row.todayPayment)}</td>
              <td className={`py-3 px-4 text-right font-black tabular-nums ${row.remainingBalance < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{money(row.remainingBalance)}</td>
            </tr>
          ))}
          {!loading && filteredRows.length === 0 && (
            <tr><td colSpan={6} className="py-8 text-center text-slate-400">{t('No matching parties found')}</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 font-black text-xs">
            <td className="py-3 px-4">{t('Daily Total')}</td>
            <td className="py-3 px-4 text-right">{money(filteredTotals.previousBalance)}</td>
            <td className="py-3 px-4 text-right">{money(filteredTotals.todayPurchases)}</td>
            <td className="py-3 px-4 text-right">{money(filteredTotals.totalOutstanding)}</td>
            <td className="py-3 px-4 text-right">{money(filteredTotals.todayPayment)}</td>
            <td className="py-3 px-4 text-right">{money(filteredTotals.remainingBalance)}</td>
          </tr>
        </tfoot>
      </table>
      {loading && <div className="p-5 text-center text-xs text-slate-500">{t('Loading Daily Hisab...')}</div>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h3 className="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">{t('Daily Hisab')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Customer and supplier daily balances from existing ledger transactions')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-3 py-2 text-xs font-semibold">
            <CalendarDays size={15} className="text-[#4F46E5]" />
            <span>{t('Date')}</span>
            <input type="date" value={date} onChange={(event) => { setLoading(true); setError(''); setDate(event.target.value); }} className="bg-transparent outline-none" />
          </label>
          <button onClick={() => { setLoading(true); setError(''); setRefreshKey(value => value + 1); }} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300" title={t('Refresh')}>
            <RefreshCw size={15} />
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-xs font-bold text-white">
            <Printer size={15} />{t('Print Daily Hisab')}
          </button>
        </div>
      </div>

      <PrintReportHeader
        title={section === 'Customer' ? t('Customer Daily Hisab') : t('Beopari (Supplier) Daily Hisab')}
        period={date}
        summaryMetrics={[
          { label: 'Previous Balance', value: money(filteredTotals.previousBalance) },
          { label: "Today's Purchases", value: money(filteredTotals.todayPurchases) },
          { label: "Today's Payment", value: money(filteredTotals.todayPayment) },
          { label: 'Remaining Balance', value: money(filteredTotals.remainingBalance) },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          {['Customer', 'Supplier'].map((partyType) => (
            <button key={partyType} onClick={() => setSection(partyType)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors ${section === partyType ? 'border-[#4F46E5] bg-[#4F46E5] text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300'}`}>
              {partyType === 'Customer' ? <Users size={14} /> : <Truck size={14} />}
              {t(partyType === 'Customer' ? 'Customer Daily Hisab' : 'Beopari (Supplier) Daily Hisab')}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-3 py-2.5 md:w-80">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search party name, phone, or Khata ID')} className="w-full bg-transparent text-xs outline-none" />
        </label>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 print:hidden">{error}</div>}
      <p className="text-[11px] text-slate-500 print:hidden">{t('Negative balances represent an advance or credit balance.')}</p>
      <div className="hidden print:block text-sm font-bold mb-2">{t(section)} · {date}</div>
      {table}
    </div>
  );
}
