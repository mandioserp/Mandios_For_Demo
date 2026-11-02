import { useMemo, useState } from 'react';
import { Download, Search, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function PaymentTransactionsTable({ payments = [], onDelete, onDownloadParchi }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filteredPayments = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const filtered = payments.filter((payment) => !term || [
      payment.date, payment.partyName, payment.partyType, payment.type,
      payment.paymentMethod, payment.description,
    ].some(value => String(value || '').toLocaleLowerCase().includes(term)));
    return filtered.sort((a, b) =>
      `${b.date || ''}${b.createdAt || ''}`.localeCompare(`${a.date || ''}${a.createdAt || ''}`)
    );
  }, [payments, search]);
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const pageRows = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">{t('Cash Disbursements & Receipts')}</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('Recorded payment and receipt transactions')}</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-3 py-2.5 sm:w-80 print:hidden">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('Search cashier ledger by party, type, date...')} className="w-full bg-transparent text-xs outline-none" />
        </label>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]">
        <table className="w-full min-w-[1050px] text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4">{t('Date')}</th>
              <th className="py-3 px-4">{t('Party Name')}</th>
              <th className="py-3 px-4">{t('Role Type')}</th>
              <th className="py-3 px-4">{t('Transaction Type')}</th>
              <th className="py-3 px-4">{t('Payment Method')}</th>
              <th className="py-3 px-4">{t('Description / Ref')}</th>
              <th className="py-3 px-4 text-right">{t('Amount Cash')}</th>
              <th className="py-3 px-4 text-center">{t('Download Parchi')}</th>
              <th className="py-3 px-4 text-center print:hidden">{t('Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
            {pageRows.map((payment) => (
              <tr key={payment.id || payment._id}>
                <td className="py-3 px-4 font-semibold">{payment.date}</td>
                <td className="py-3 px-4 font-bold">{payment.partyName}</td>
                <td className="py-3 px-4 text-slate-500">{t(payment.partyType)}</td>
                <td className="py-3 px-4">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${payment.type === 'Received' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}>
                    {t(payment.type === 'Received' ? 'CASH IN (Received)' : 'CASH OUT (Disbursed)')}
                  </span>
                </td>
                <td className="py-3 px-4">{payment.paymentMethod || 'Cash'}</td>
                <td className="py-3 px-4 text-slate-500">{payment.description || '—'}</td>
                <td className={`py-3 px-4 text-right font-black ${payment.type === 'Received' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {t('Rs.')} {Number(payment.amount || 0).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center">
                  <button onClick={() => onDownloadParchi(payment)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#4F46E5]/20 bg-[#4F46E5]/5 px-2.5 py-1.5 text-[10px] font-bold text-[#4F46E5] dark:text-indigo-300 print:hidden" title={t('Download Parchi PDF')}>
                    <Download size={13} />{t('PDF')}
                  </button>
                  <span className="hidden print:inline">{t('Parchi')}</span>
                </td>
                <td className="py-3 px-4 text-center print:hidden">
                  <button onClick={() => onDelete(payment)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10" title={t('Delete payment')}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-slate-400">{t('No payment transactions recorded yet.')}</td></tr>}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3 text-xs print:hidden">
          <span className="text-slate-500">{filteredPayments.length} {t('total payments and receipts)')}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 disabled:opacity-40">{t('Previous')}</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 disabled:opacity-40">{t('Next')}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
