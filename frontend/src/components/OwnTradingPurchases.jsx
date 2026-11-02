import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash, X, ShoppingBag, RotateCcw, Pencil } from 'lucide-react';
import api from '../utils/api.js';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

import { purchaseToForm } from '../utils/ownTradingForm.js';

const emptyProduct = () => ({ productId: '', quantity: '', unit: 'Crates', purchaseRate: '' });
const emptyBeopari = () => ({ supplierId: '', advancePaid: '', products: [emptyProduct()] });
const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || `ot-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function OwnTradingPurchases({ suppliers = [], products = [], showToast, onSaved, canCancel = false, editPurchaseId, onEditClosed }) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [purchases, setPurchases] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const closeEntry = () => { if (submitting) return; setIsOpen(false); setEditingId(null); onEditClosed?.(); };
  const openEdit = purchase => { setError(''); setEditingId(purchase.id || purchase._id); setForm(purchaseToForm(purchase)); setIsOpen(true); };

  useEffect(() => {
    if (!editPurchaseId) return;
    let active = true;
    api.get('/own-trading-purchases').then(({ data }) => {
      if (!active) return;
      const purchase = data.find(row => String(row.id || row._id) === String(editPurchaseId));
      if (!purchase) throw new Error('Own Trading purchase not found.');
      openEdit(purchase);
    }).catch(error => { if (active) { showToast?.(error.response?.data?.error || error.message, 'error'); onEditClosed?.(); } });
    return () => { active = false; };
    // Parent callbacks may change identity when dashboard data refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPurchaseId]);

  const loadPurchases = useCallback(async () => {
    try {
      const { data } = await api.get('/own-trading-purchases');
      setPurchases(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      console.warn('Could not load Own Trading purchase list:', fetchError?.response?.data?.error || fetchError.message);
      setPurchases([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadPurchases, 0);
    return () => clearTimeout(timer);
  }, [loadPurchases]);

  const openEntry = () => {
    setEditingId(null);
    setError('');
    setForm({
      idempotencyKey: newIdempotencyKey(),
      purchaseReference: '',
      date: new Date().toISOString().slice(0, 10),
      sourceMandi: '',
      truckNumber: '',
      notes: '',
      expenses: { transport: '', loading: '', unloading: '', other: '' },
      beoparis: [emptyBeopari()],
    });
    setIsOpen(true);
  };

  const updateBeopari = (groupIndex, update) => setForm(prev => ({ ...prev, beoparis: prev.beoparis.map((group, index) => index === groupIndex ? { ...group, ...update } : group) }));
  const updateProduct = (groupIndex, productIndex, update) => updateBeopari(groupIndex, {
    products: form.beoparis[groupIndex].products.map((product, index) => index === productIndex ? { ...product, ...update } : product),
  });
  const addProduct = groupIndex => updateBeopari(groupIndex, { products: [...form.beoparis[groupIndex].products, emptyProduct()] });
  const addSupplier = () => setForm(prev => ({ ...prev, beoparis: [...prev.beoparis, emptyBeopari()] }));

  const handleSubmit = async event => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        expenses: Object.fromEntries(Object.entries(form.expenses).map(([key, value]) => [key, Number(value || 0)])),
        beoparis: form.beoparis.map(group => ({
          ...group,
          advancePaid: Number(group.advancePaid || 0),
          products: group.products.map(item => ({ ...item, quantity: Number(item.quantity), purchaseRate: Number(item.purchaseRate) })),
        })),
      };
      const { data } = editingId
        ? await api.put(`/own-trading-purchases/${editingId}`, payload)
        : await api.post('/own-trading-purchases', payload);
      setIsOpen(false);
      setEditingId(null);
      onEditClosed?.();
      await loadPurchases();
      onSaved?.();
      showToast?.(t(editingId ? 'Own Trading purchase updated.' : 'Own Trading purchase recorded and lots created.'), 'success');
      return data;
    } catch (submitError) {
      setError(submitError.response?.data?.error || submitError.message || t('Failed to record Own Trading purchase.'));
      showToast?.(submitError.response?.data?.error || t('Failed to record Own Trading purchase.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPurchase = async purchase => {
    const accepted = await confirm({
      title: t('Cancel Own Trading Purchase?'),
      message: t('This reverses the purchase and removes linked stock only if no sales, returns, or stock adjustments exist. Any supplier advance remains as a supplier credit until refunded.'),
      confirmText: t('Cancel Purchase'),
      type: 'danger',
    });
    if (!accepted) return;
    try {
      await api.delete(`/own-trading-purchases/${purchase.id || purchase._id}`);
      showToast?.(t('Own Trading purchase cancelled.'), 'success');
      await loadPurchases();
      onSaved?.();
    } catch (cancelError) {
      showToast?.(cancelError.response?.data?.error || t('Failed to cancel Own Trading purchase.'), 'error');
    }
  };

  const displayPurchases = purchases.filter(purchase => purchase.status === 'Posted' || purchase.status === 'Cancelled').slice(0, 8);

  return (
    <section className="rounded-2xl border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/10 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300"><ShoppingBag size={16} />{t('Own Trading Purchases')}</h4>
          <p className="text-xs text-slate-500 mt-1">{t('Record purchases made by your business. Each item creates its own linked stock lot.')}</p>
        </div>
        <button type="button" onClick={openEntry} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5"><Plus size={15} />{t('Record Own Trading Purchase')}</button>
      </div>

      {displayPurchases.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B]
      "><table className="w-full text-xs text-left"><thead><tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase"><th className="p-3">{t('Date / Reference')}</th><th className="p-3">{t('Source / Truck')}</th><th className="p-3">{t('Items')}</th><th className="p-3 text-right">{t('Landed Cost')}</th><th className="p-3">{t('Status')}</th><th className="p-3 text-right">{t('Actions')}</th></tr></thead><tbody>{displayPurchases.map(purchase => <tr key={purchase.id || purchase._id} className="border-b last:border-0 border-slate-100 dark:border-slate-800"><td className="p-3"><strong>{purchase.purchaseReference}</strong><span className="block text-slate-500">{purchase.date}</span></td><td className="p-3">{purchase.sourceMandi || '—'}<span className="block text-slate-500">{purchase.truckNumber || '—'}</span></td><td className="p-3">{(purchase.items || []).map(item => `${item.productName} ${item.quantity} ${item.unit}`).join(', ')}</td><td className="p-3 text-right font-bold">Rs. {Number(purchase.landedCostTotal || 0).toLocaleString()}</td><td className="p-3">{t(purchase.status)}</td><td className="p-3 text-right">{purchase.status === 'Posted' && <button type="button" onClick={() => openEdit(purchase)} title={t('Edit Own Trading Purchase')} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-500/10"><Pencil size={14} /></button>}{canCancel && purchase.status === 'Posted' && <button type="button" onClick={() => handleCancelPurchase(purchase)} title={t('Cancel Purchase')} className="rounded-lg p-2 text-rose-600 hover:bg-rose-500/10"><RotateCcw size={14} /></button>}</td></tr>)}</tbody></table></div>}

      {isOpen && form && <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1E293B] p-5 sm:p-6 shadow-2xl space-y-5">
          <div className="flex items-start justify-between"><div><h3 className="text-base font-black uppercase">{t(editingId ? 'Edit Own Trading Purchase' : 'Own Trading Purchase')}</h3><p className="text-xs text-slate-500 mt-1">{t(editingId ? 'Updates the existing purchase and linked lots. Date, reference, supplier, product, unit and recorded advances are preserved. Quantities, rates and expenses can change only before sales, returns or stock adjustments.' : 'This creates own-trading lots and supplier balances immediately. No settlement is required.')}</p></div><button type="button" disabled={submitting} onClick={closeEntry} aria-label={t('Close')}><X size={18} /></button></div>
          {error && <div role="alert" className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-600">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[['date', 'Purchase Date', 'date'], ['purchaseReference', 'Purchase Reference (optional)', 'text'], ['sourceMandi', 'Source Mandi', 'text'], ['truckNumber', 'Truck Number (optional)', 'text']].map(([name, label, type]) => <label key={name} className="space-y-1 text-[10px] font-bold uppercase text-slate-500">{t(label)}<input disabled={Boolean(editingId) && ['date', 'purchaseReference'].includes(name)} required={name === 'date'} type={type} value={form[name]} onChange={event => setForm(prev => ({ ...prev, [name]: event.target.value }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100" /></label>)}
            </div>

            <div className="flex items-center justify-between gap-2"><div><h4 className="font-black text-sm">{t('Suppliers and purchase items')}</h4><p className="text-[11px] text-slate-500">{t('Each item is linked to its own supplier, product, and stock lot.')}</p><p className="text-[10px] font-bold text-slate-500 mt-1">{form.beoparis.length} {t('Suppliers')} · {form.beoparis.reduce((total, group) => total + group.products.length, 0)} {t('Items')}</p></div><button type="button" disabled={Boolean(editingId)} onClick={addSupplier} className="inline-flex gap-1 items-center rounded-lg bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-600"><Plus size={14} />{t('Add Supplier')}</button></div>

            {form.beoparis.map((group, groupIndex) => <section key={`supplier-${groupIndex}`} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <label className="space-y-1 text-[10px] font-bold uppercase text-slate-500">{t('Supplier / Beopari')}<select disabled={Boolean(editingId)} required value={group.supplierId} onChange={event => updateBeopari(groupIndex, { supplierId: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100"><option value="">{t('Select Supplier')}</option>{suppliers.map(supplier => <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>{supplier.name}</option>)}</select></label>
                <label className="space-y-1 text-[10px] font-bold uppercase text-slate-500">{t('Advance Payment')}<input type="number" min="0" step="0.01" disabled={Boolean(editingId)} value={group.advancePaid} onChange={event => updateBeopari(groupIndex, { advancePaid: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100" /></label>
                <button type="button" disabled={Boolean(editingId) || form.beoparis.length <= 1} onClick={() => setForm(prev => ({ ...prev, beoparis: prev.beoparis.filter((_, index) => index !== groupIndex) }))} className="p-2 text-rose-500 disabled:opacity-30" title={t('Remove Supplier')}><Trash size={16} /></button>
              </div>
              {group.products.map((item, productIndex) => <div key={`item-${groupIndex}-${productIndex}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_auto] gap-2 items-end">
                <label className="space-y-1 text-[10px] font-bold uppercase text-slate-500">{t('Product')}<select disabled={Boolean(editingId)} required value={item.productId} onChange={event => { const product = products.find(value => String(value.id || value._id) === event.target.value); updateProduct(groupIndex, productIndex, { productId: event.target.value, unit: product?.unit || item.unit }); }} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100"><option value="">{t('Select Product')}</option>{products.map(product => <option key={product.id || product._id} value={product.id || product._id}>{product.name}</option>)}</select></label>
                <label className="space-y-1 text-[10px] font-bold uppercase text-slate-500">{t('Quantity')}<input required type="number" min="0.000001" step="any" value={item.quantity} onChange={event => updateProduct(groupIndex, productIndex, { quantity: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100" /></label>
                <label className="space-y-1 text-[10px] font-bold uppercase text-slate-500">{t('Unit')}<input disabled={Boolean(editingId)} required list={`purchase-unit-${groupIndex}-${productIndex}`} value={item.unit} onChange={event => updateProduct(groupIndex, productIndex, { unit: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100" /><datalist id={`purchase-unit-${groupIndex}-${productIndex}`}>{['Bag', 'Crate', 'Peti', 'Kg', 'Maund', 'Ton', ...products.map(product => product.unit).filter(Boolean)].map((unit, index) => <option key={`${unit}-${index}`} value={unit} />)}</datalist></label>
                <label className="space-y-1 text-[10px] font-bold uppercase text-slate-500">{t('Purchase Rate')}<input required type="number" min="0.01" step="any" value={item.purchaseRate} onChange={event => updateProduct(groupIndex, productIndex, { purchaseRate: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100" /></label>
                <button type="button" disabled={Boolean(editingId) || group.products.length <= 1} onClick={() => updateBeopari(groupIndex, { products: group.products.filter((_, index) => index !== productIndex) })} className="p-2 text-rose-500 disabled:opacity-30" title={t('Remove Product')}><Trash size={15} /></button>
              </div>)}
              <button type="button" disabled={Boolean(editingId)} onClick={() => addProduct(groupIndex)} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600"><Plus size={13} />{t('Add Product')}</button>
            </section>)}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['transport', 'Transport'], ['loading', 'Loading'], ['unloading', 'Unloading'], ['other', 'Other Purchase Expenses']].map(([name, label]) => <label key={name} className="space-y-1 text-[10px] font-bold uppercase text-slate-500">{t(label)}<input type="number" min="0" step="0.01" value={form.expenses[name]} onChange={event => setForm(prev => ({ ...prev, expenses: { ...prev.expenses, [name]: event.target.value } }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100" /></label>)}</div>
            <label className="block space-y-1 text-[10px] font-bold uppercase text-slate-500">{t('Notes')}<textarea value={form.notes} onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))} className="w-full min-h-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100" /></label>
            <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 pt-4"><button type="button" disabled={submitting} onClick={closeEntry} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold">{t('Cancel')}</button><button type="submit" disabled={submitting} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold">{submitting ? t('Saving...') : t(editingId ? 'Save Purchase Changes' : 'Record Purchase and Create Lots')}</button></div>
          </form>
        </div>
      </div>}
    </section>
  );
}
