import { useEffect, useState } from 'react';
import api from '../../utils/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

export default function OwnTradingLotDetails({ lotId, onClose }) {
  const { t } = useLanguage();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api.get('/reports/data', { params: { reportId: 'own-trading', detailLotId: lotId } }).then(({ data }) => {
      if (active) setDetail(data.detail);
    }).catch(error => { if (active) setError(error.response?.data?.error || 'Failed to load lot details.'); });
    return () => { active = false; };
  }, [lotId]);
  const money = value => `Rs. ${Number(value || 0).toLocaleString()}`;
  return <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true" aria-label={t('Own Trading Lot Details')}>
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto space-y-4">
      <div className="flex justify-between"><h2 className="font-bold">{t('Own Trading Lot Details')} {detail?.row.lotId}</h2><button onClick={onClose}>{t('Close')}</button></div>
      {error ? <p role="alert">{error}</p> : !detail ? <p>{t('Loading...')}</p> : <>
        <p>{detail.purchase.purchaseReference} · {detail.purchase.date} · {detail.purchase.sourceMandi} · {detail.row.supplierName} · {detail.row.productName}</p>
        <p>{t('Purchased Qty')}: {detail.row.purchasedQuantity} {detail.row.unit} · {t('Purchase Rate')}: {money(detail.row.purchaseRate)} · {t('Purchase Amount')}: {money(detail.row.purchaseAmount)}</p>
        <p>{t('Remaining Qty')}: {detail.row.remainingQuantity} {detail.row.unit} · {t('Outstanding Supplier Balance')}: {money(detail.row.supplierPayable)} · {t('Realized Profit')}: {money(detail.row.grossTradingProfit)}</p>
        <p>{detail.purchase.notes}</p>
        <h3 className="font-semibold">{t('Purchase Expenses')}</h3>
        <p>{Object.entries(detail.purchase.expenses || {}).filter(([key]) => key !== '_id').map(([key, value]) => `${t(key)}: ${money(value)}`).join(' · ')}</p>
        <p>{t('Allocated to this lot')}: {money(detail.row.allocatedExpenses)}. {t('Purchase expenses above cover the whole purchase; the allocation is already included in landed cost.')}</p>
        {[
          { title: 'Sales Transactions', rows: detail.sales, columns: [['date', 'Date'], ['invoiceNumber', 'Invoice'], ['customerName', 'Customer'], ['quantity', 'Quantity'], ['totalAmount', 'Amount']] },
          { title: 'Approved Returns / Quantity Movements', rows: detail.returns, columns: [['date', 'Date'], ['returnNumber', 'Reference'], ['produceReturnedQty', 'Returned Qty'], ['produceCondition', 'Condition'], ['returnAmount', 'Amount']] },
          { title: 'Supplier Payments (whole supplier share of purchase)', rows: detail.payments, columns: [['date', 'Date'], ['description', 'Description'], ['paymentMethod', 'Method'], ['amount', 'Amount']] },
        ].map(section => <section key={section.title} className="space-y-2"><h3 className="font-semibold">{t(section.title)}</h3><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{section.columns.map(([key, label]) => <th className="text-left p-2" key={key}>{t(label)}</th>)}</tr></thead><tbody>{section.rows.map(row => <tr key={row.id || row._id}>{section.columns.map(([key]) => <td className="border-t p-2" key={key}>{key.toLowerCase().includes('amount') ? money(row[key]) : String(row[key] ?? '—')}</td>)}</tr>)}</tbody></table>{!section.rows.length && <p>{t('No transactions recorded.')}</p>}</div></section>)}
      </>}
    </div>
  </div>;
}
