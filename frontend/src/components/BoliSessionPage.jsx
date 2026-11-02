import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function BoliSessionPage({ setCurrentTab }) {
  const { t } = useLanguage();
  const saleRequestRef = useRef(null);
  const customerInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const customerOptionsRef = useRef([]);
  const [lots, setLots] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerOptions, setShowCustomerOptions] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [session, setSession] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [sessionDraft, setSessionDraft] = useState({
    commissionType: 'Per Unit',
    commissionValue: '20',
  });
  const [entry, setEntry] = useState({
    customerId: '',
    quantity: '',
    rate: '',
    date: new Date().toISOString().split('T')[0],
  });

  const activeLot = useMemo(
    () => lots.find((lot) => (lot.id || lot._id) === selectedLotId) || null,
    [lots, selectedLotId]
  );
  const trimmedCustomerSearch = customerSearch.trim().toLowerCase();
  const walkInLabel = t('Walk-In Customer (Fast Retail)');
  const showWalkIn = !trimmedCustomerSearch
    || ['walk-in customer', 'fast retail', 'retail', 'walk', walkInLabel.toLowerCase()].some((term) => (
      term.includes(trimmedCustomerSearch) || trimmedCustomerSearch.includes(term)
    ));
  const formatCustomerLabel = (customer) => [customer.name, customer.phone, customer.khataId]
    .filter(Boolean)
    .join(' · ');
  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    if (!trimmedCustomerSearch) return true;
    return [customer.name, customer.phone, customer.khataId, formatCustomerLabel(customer)]
      .some((value) => value?.toLowerCase().includes(trimmedCustomerSearch));
  }), [customers, trimmedCustomerSearch]);
  const customersById = useMemo(() => new Map(
    customers.map((customer) => [String(customer.id || customer._id), customer])
  ), [customers]);
  const customerOptions = [
    ...(showWalkIn ? [{ id: 'walk-in', label: walkInLabel }] : []),
    ...filteredCustomers.map((customer) => ({
      id: customer.id || customer._id,
      label: formatCustomerLabel(customer),
    })),
  ];

  const loadLots = useCallback(async () => {
    try {
      const [stockRes, customerRes] = await Promise.all([
        api.get('/stock'),
        api.get('/customers'),
      ]);

      const extractArray = (data) => Array.isArray(data)
        ? data
        : (Array.isArray(data?.stockEntries) ? data.stockEntries : (Array.isArray(data?.data) ? data.data : []));

      setLots(extractArray(stockRes.data));
      setCustomers(extractArray(customerRes.data));
    } catch (error) {
      console.error(error);
      setMessage({ text: t('Failed to load lots/customers.'), type: 'error' });
    }
  }, [t]);

  const loadSessionSales = async (sessionId) => {
    if (!sessionId) {
      setSales([]);
      return;
    }

    try {
      const res = await api.get(`/boli-sessions/${sessionId}/sales`);
      setSales(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      setSales([]);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await loadLots();
      setLoading(false);
    };

    fetchData();
  }, [loadLots]);

  const startSession = async () => {
    if (!selectedLotId) {
      setMessage({ text: t('Please select a lot first.'), type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const res = await api.post('/boli-sessions', {
        lotId: selectedLotId,
        commissionType: sessionDraft.commissionType,
        commissionValue: Number(sessionDraft.commissionValue) || 0,
      });

      const nextSession = res.data || null;
      setSession(nextSession);
      setMessage({ text: t('Boli session started successfully.'), type: 'success' });
      await loadSessionSales(nextSession?._id || nextSession?.id);
      setTimeout(() => customerInputRef.current?.focus(), 150);
    } catch (error) {
      console.error(error);
      setMessage({ text: error.response?.data?.error || t('Failed to start Boli session.'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const closeSession = async () => {
    if (!session) return;

    try {
      setSaving(true);
      const res = await api.post(`/boli-sessions/${session._id || session.id}/close`);
      setSession(res.data || session);
      setMessage({ text: t('Boli session closed.'), type: 'success' });
    } catch (error) {
      console.error(error);
      setMessage({ text: error.response?.data?.error || t('Failed to close session.'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const reopenSession = async () => {
    if (!session) return;

    try {
      setSaving(true);
      const res = await api.post(`/boli-sessions/${session._id || session.id}/reopen`);
      setSession(res.data || session);
      setMessage({ text: t('Boli session reopened.'), type: 'success' });
    } catch (error) {
      console.error(error);
      setMessage({ text: error.response?.data?.error || t('Failed to reopen session.'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const addSale = async (event) => {
    event.preventDefault();

    if (!session) {
      setMessage({ text: t('Please start a Boli session before adding a sale.'), type: 'error' });
      return;
    }

    if (saving || session.status !== 'Open') return;

    if (!entry.customerId || !entry.quantity || !entry.rate) {
      setMessage({ text: t('Customer, quantity, and rate are required.'), type: 'error' });
      return;
    }

    if (!Number.isFinite(Number(entry.quantity)) || Number(entry.quantity) <= 0 || Number(entry.quantity) > remainingQty || !Number.isFinite(Number(entry.rate)) || Number(entry.rate) <= 0) {
      setMessage({ text: t('Please enter a valid quantity within the remaining stock and a positive rate.'), type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const isWalkIn = entry.customerId === 'walk-in';
      const saleData = {
        customerId: isWalkIn ? null : entry.customerId,
        isWalkIn,
        walkInName: isWalkIn ? 'Walk-In Customer' : undefined,
        walkInMobile: isWalkIn ? '' : undefined,
        walkInVehicle: isWalkIn ? '' : undefined,
        quantity: Number(entry.quantity),
        saleRate: Number(entry.rate),
        date: entry.date,
      };

      const fingerprint = JSON.stringify([session._id || session.id, saleData]);
      if (saleRequestRef.current?.fingerprint !== fingerprint) {
        saleRequestRef.current = { fingerprint, key: globalThis.crypto?.randomUUID?.() || `boli-${Date.now()}-${Math.random().toString(36).slice(2)}` };
      }
      saleData.idempotencyKey = saleRequestRef.current.key;
      await api.post(`/boli-sessions/${session._id || session.id}/sales`, saleData);
      saleRequestRef.current = null;

      setMessage({ text: t('Sale saved to the existing sales ledger.'), type: 'success' });
      setEntry({ ...entry, customerId: '', quantity: '', rate: '' });
      setCustomerSearch('');
      setShowCustomerOptions(false);
      await loadSessionSales(session._id || session.id);
      await loadLots();
      setTimeout(() => customerInputRef.current?.focus(), 150);
    } catch (error) {
      console.error(error);
      setMessage({ text: error.response?.data?.error || t('Failed to record sale.'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSale = async (saleId) => {
    try {
      await api.delete(`/sales/${saleId}`);
      setMessage({ text: t('Sale deleted and ledger updated.'), type: 'success' });
      await Promise.all([loadSessionSales(session?._id || session?.id), loadLots()]);
    } catch (error) {
      console.error(error);
      setMessage({ text: error.response?.data?.error || t('Failed to delete sale.'), type: 'error' });
    }
  };

  const remainingQty = activeLot
    ? Number(activeLot.remainingQuantity ?? activeLot.quantity ?? 0)
    : 0;
  const originalQty = activeLot ? Number(activeLot.quantity ?? 0) : 0;
  const soldQty = Math.max(0, originalQty - remainingQty);

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-lg">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#4F46E5] dark:text-indigo-400">{t('Lot Sale / Boli Session')}</p>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-2">{t('Fast lot sales workflow')}</h1>
          </div>
          <button
            type="button"
            onClick={() => setCurrentTab && setCurrentTab('sales_batch')}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200"
          >
            {t('Back to normal sales')}
          </button>
        </div>
      </div>

      {message && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-6">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-lg">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('Select Lot')}</label>
              <select
                value={selectedLotId}
                onFocus={loadLots}
                onChange={(event) => {
                  setSelectedLotId(event.target.value);
                  setSession(null);
                  setSales([]);
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm font-semibold text-slate-800 dark:text-white"
              >
                <option value="">{t('Choose a lot')}</option>
                {lots.filter((lot) => Number(lot.remainingQuantity ?? lot.quantity ?? 0) > 0 || (lot.id || lot._id) === selectedLotId).map((lot) => (
                  <option key={lot.id || lot._id} value={lot.id || lot._id}>
                    {(lot.lotNumber || lot._id || t('Lot'))} - {lot.productName || t('Product')} - {Number(lot.remainingQuantity ?? lot.quantity ?? 0)} {t(lot.unit || 'Crates')} {t('Remaining')}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/20 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>{t('Product')}</span><strong className="text-slate-900 dark:text-white">{activeLot?.productName || '-'}</strong></div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>{t('Supplier')}</span><strong className="text-slate-900 dark:text-white">{activeLot?.supplierName || '-'}</strong></div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>{t('Original Qty')}</span><strong className="text-slate-900 dark:text-white">{originalQty || 0} {t(activeLot?.unit || 'Crates')}</strong></div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>{t('Sold')}</span><strong className="text-slate-900 dark:text-white">{soldQty || 0} {t(activeLot?.unit || 'Crates')}</strong></div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>{t('Remaining')}</span><strong className="text-emerald-600 dark:text-emerald-400">{remainingQty || 0} {t(activeLot?.unit || 'Crates')}</strong></div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('Commission Type')}</label>
                <select
                  disabled={activeLot?.businessMode === 'Own Trading' || !!session}
                  value={sessionDraft.commissionType}
                  onChange={(event) => setSessionDraft((prev) => ({ ...prev, commissionType: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm font-semibold text-slate-800 dark:text-white"
                >
                  <option value="Percentage">{t('Percentage')}</option>
                  <option value="Fixed Amount">{t('Fixed Amount')}</option>
                  <option value="Per Unit">{t('Per Unit')}</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('Commission Value')}</label>
                <input
                  type="number"
                  disabled={activeLot?.businessMode === 'Own Trading' || !!session}
                  value={activeLot?.businessMode === 'Own Trading' ? 0 : sessionDraft.commissionValue}
                  onChange={(event) => setSessionDraft((prev) => ({ ...prev, commissionValue: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm text-slate-800 dark:text-white"
                  placeholder="20"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={startSession}
              disabled={!selectedLotId || saving}
              className="w-full rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black uppercase tracking-[0.14em] py-3 disabled:opacity-60"
            >
              {saving ? t('Working...') : t('Start Boli Session')}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-lg">
          {session ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('Session')}</p>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">{session._id || session.id}</h2>
                </div>
                <div className="flex gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${session.status === 'Open' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                    {t(session.status || 'Open')}
                  </span>
                  {session.status === 'Open' ? (
                    <button type="button" onClick={closeSession} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{t('Close')}</button>
                  ) : (
                    <button type="button" onClick={reopenSession} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">{t('Reopen')}</button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 text-sm">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-3"><span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('Lot')}</span><div className="mt-1 font-bold text-slate-900 dark:text-white">{activeLot?.lotNumber || activeLot?._id || t('Lot')}</div></div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-3"><span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('Product')}</span><div className="mt-1 font-bold text-slate-900 dark:text-white">{activeLot?.productName || '-'}</div></div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-3"><span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('Supplier')}</span><div className="mt-1 font-bold text-slate-900 dark:text-white">{activeLot?.supplierName || '-'}</div></div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-3"><span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('Commission')}</span><div className="mt-1 font-bold text-slate-900 dark:text-white">{activeLot?.businessMode === 'Own Trading' ? t('None') : <>{t(session.commissionType || sessionDraft.commissionType)} {session.commissionValue ?? sessionDraft.commissionValue}</>}</div></div>
              </div>

              <form onSubmit={addSale} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('Customer')}</label>
                    <div
                      className="relative mt-2"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setShowCustomerOptions(false);
                      }}
                    >
                      <input
                        ref={customerInputRef}
                        type="search"
                        role="combobox"
                        aria-label={t('Search and select customer')}
                        aria-autocomplete="list"
                        aria-expanded={showCustomerOptions}
                        value={customerSearch}
                        onFocus={() => setShowCustomerOptions(true)}
                        onChange={(event) => {
                          setCustomerSearch(event.target.value);
                          setEntry((prev) => ({ ...prev, customerId: '' }));
                          setShowCustomerOptions(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowDown' && customerOptions.length > 0) {
                            event.preventDefault();
                            setShowCustomerOptions(true);
                            setTimeout(() => customerOptionsRef.current[0]?.focus(), 0);
                          } else if (event.key === 'Escape') {
                            setShowCustomerOptions(false);
                          }
                        }}
                        placeholder={t('Search name, phone, or Khata ID')}
                        className={`w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-800 dark:text-white ${showCustomerOptions ? 'rounded-b-none' : ''}`}
                      />
                      {showCustomerOptions && (
                        <div
                          role="listbox"
                          className="absolute z-20 max-h-56 w-full overflow-y-auto rounded-b-xl border border-t-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg"
                        >
                          {customerOptions.length > 0 ? customerOptions.map((option, index) => (
                            <button
                              key={option.id}
                              ref={(element) => { customerOptionsRef.current[index] = element; }}
                              type="button"
                              role="option"
                              aria-selected={entry.customerId === option.id}
                              onClick={() => {
                                setEntry((prev) => ({ ...prev, customerId: option.id }));
                                setCustomerSearch(option.id === 'walk-in'
                                  ? walkInLabel
                                  : option.label);
                                setShowCustomerOptions(false);
                                quantityInputRef.current?.focus();
                              }}
                              className="block w-full px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
                            >
                              {option.label}
                            </button>
                          )) : (
                            <div className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400">{t('No customers found')}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('Quantity')}</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      ref={quantityInputRef}
                      value={entry.quantity}
                      onChange={(event) => setEntry((prev) => ({ ...prev, quantity: event.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('Rate')}</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={entry.rate}
                      onChange={(event) => setEntry((prev) => ({ ...prev, rate: event.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t('Remaining after this entry')}: <span className="font-black text-emerald-600 dark:text-emerald-400">{Math.max(0, remainingQty - Number(entry.quantity || 0))} {t(activeLot?.unit || 'Crates')}</span>
                  </div>
                  <button type="submit" disabled={saving || session.status !== 'Open' || remainingQty <= 0} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.14em] px-5 py-3 disabled:opacity-60">
                    {saving ? 'Saving...' : 'Add Sale'}
                  </button>
                </div>
              </form>

              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">{t('Time')}</th>
                        <th className="px-4 py-3">{t('Customer')}</th>
                        <th className="px-4 py-3">{t('Qty')}</th>
                        <th className="px-4 py-3">{t('Rate')}</th>
                        <th className="px-4 py-3">{t('Amount')}</th>
                        <th className="px-4 py-3">{t('Action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('No sales recorded in this session yet.')}</td>
                        </tr>
                      ) : (
                        sales.map((sale) => {
                          const customer = sale.customerId ? customersById.get(String(sale.customerId)) : null;
                          const customerIdentity = customer?.khataId
                            ? `Khata ${customer.khataId}`
                            : customer?.phone || (sale.customerId ? `ID ${sale.customerId}` : '');

                          return (
                            <tr key={sale._id || sale.id} className="border-t border-slate-200 dark:border-slate-700">
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                <span className="block">{sale.customerName || t('Walk-In')}</span>
                                {customerIdentity && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{customerIdentity}</span>}
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{sale.quantity}</td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">Rs {Number(sale.saleRate || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">Rs {Number(sale.totalAmount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <button type="button" onClick={() => handleDeleteSale(sale._id || sale.id)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
                                  {t('Delete')}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('Waiting for session')}</p>
                <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">{t('Select a lot and start a Boli session')}</h3>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
}
