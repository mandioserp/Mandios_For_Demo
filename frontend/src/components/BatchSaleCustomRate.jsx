import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { 
  ArrowLeft, Plus, Trash2, Calendar, ShoppingBag, User, 
  Truck, CheckCircle, AlertTriangle, HelpCircle, FileText, Info,
  Search, X
} from 'lucide-react';
import SpokeSpinner from './common/SpokeSpinner.jsx';

export default function BatchSaleCustomRate({ setCurrentTab, user }) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  
  // Data lists
  const [stockEntries, setStockEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  // Form states
  const [selectedStockId, setSelectedStockId] = useState('');
  const [customCommission, setCustomCommission] = useState('');
  const [customCommissionType, setCustomCommissionType] = useState('Per Unit');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [allocations, setAllocations] = useState({});
  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');

  // UI management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const ownSaleRequestKey = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [message, setMessage] = useState(null); // { text, type: 'success' | 'error' }
  const [setAllRateValue, setSetAllRateValue] = useState('');
  const [showSetAllRate, setShowSetAllRate] = useState(false);

  useEffect(() => {
    fetchRequiredData();
  }, []);

  const fetchRequiredData = async () => {
    try {
      setLoading(true);
      const [stockRes, custRes, prodRes] = await Promise.all([
        api.get('/stock').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/products').catch(() => ({ data: [] }))
      ]);

      const extractArray = (data) => Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : (Array.isArray(data?.data) ? data.data : []));
      setStockEntries(extractArray(stockRes.data));
      setCustomers(extractArray(custRes.data));
      setProducts(extractArray(prodRes.data));
    } catch (err) {
      console.error(err);
      setMessage({ text: t('Failed to load initial data from server.'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Get currently selected stock entry
  const activeStock = stockEntries.find(s => (s.id || s._id) === selectedStockId);
  const isOwnTradingSale = activeStock?.businessMode === 'Own Trading';
  const stockProdId = typeof activeStock?.productId === 'object' 
    ? (activeStock.productId?.id || activeStock.productId?._id) 
    : activeStock?.productId;

  const activeProduct = (typeof activeStock?.productId === 'object' && activeStock?.productId)
    || (activeStock ? products.find(p => (p.id || p._id) === stockProdId) : null)
    || activeStock?.product;

  // Active stock derived quantities
  const availableQty = activeStock 
    ? (activeStock.remainingQuantity !== undefined ? activeStock.remainingQuantity : activeStock.quantity) 
    : 0;

  // Calculate dynamic commission for a row
  const getCommissionEstimate = (alloc, qty, rate) => {
    if (isOwnTradingSale || !alloc || !alloc.checked || !Number(qty) || !Number(rate)) return 0;
    const q = Number(qty);
    const r = Number(rate);
    const grossVal = q * r;

    let commType = customCommissionType || 'Per Unit';
    let commVal = 0;

    if (customCommission !== '' && customCommission !== null && customCommission !== undefined && !isNaN(Number(customCommission))) {
      commVal = Number(customCommission);
      commType = customCommissionType || 'Per Unit';
    } else {
      commVal = 0;
    }

    let commAmount = 0;
    if (commType === 'Percentage') {
      commAmount = grossVal * (commVal / 100);
    } else if (commType === 'Per Unit' || commType === 'Fixed Amount') {
      commAmount = commVal * q;
    }
    return Math.round(commAmount * 100) / 100;
  };

  // Filtered buyers list based on search query
  const trimmedBuyerSearch = buyerSearchQuery.trim().toLowerCase();
  const showWalkIn = !trimmedBuyerSearch || 'walk-in customer'.includes(trimmedBuyerSearch) || 'fast retail'.includes(trimmedBuyerSearch) || 'retail'.includes(trimmedBuyerSearch) || 'walk'.includes(trimmedBuyerSearch);
  const filteredCustomers = (customers || []).filter(c => {
    if (!trimmedBuyerSearch) return true;
    const nameMatch = c.name?.toLowerCase().includes(trimmedBuyerSearch);
    const phoneMatch = c.phone?.toLowerCase().includes(trimmedBuyerSearch);
    const khataIdMatch = c.khataId?.toLowerCase().includes(trimmedBuyerSearch);
    return nameMatch || phoneMatch || khataIdMatch;
  });

  const toggleChecked = (id) => {
    setAllocations(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        checked: !prev[id]?.checked,
        quantity: prev[id]?.checked ? '' : (prev[id]?.quantity || ''),
        rate: prev[id]?.checked ? '' : (prev[id]?.rate || ''),
        discount: prev[id]?.checked ? '' : (prev[id]?.discount || '')
      }
    }));
  };

  const updateAllocation = (id, field, value) => {
    setAllocations(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  // Set rate for all checked customers
  const handleSetRateForAll = () => {
    if (!setAllRateValue || Number(setAllRateValue) <= 0) {
      setMessage({ text: t('Please enter a valid rate.'), type: 'error' });
      return;
    }
    const rateVal = Number(setAllRateValue);
    setAllocations(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (updated[key]?.checked) {
          updated[key].rate = rateVal;
        }
      });
      return updated;
    });
    setSetAllRateValue('');
    setShowSetAllRate(false);
    setMessage({ text: t('Rate applied to all checked customers.'), type: 'success' });
  };

  // Deriving active allocations
  const activeAllocations = Object.entries(allocations)
    .filter(([_, alloc]) => alloc.checked)
    .map(([id, alloc]) => {
      const isWalkIn = id === 'walk-in';
      const customer = isWalkIn ? null : customers.find(c => (c.id || c._id) === id);
      return {
        id,
        isWalkIn,
        customerId: isWalkIn ? null : id,
        customerName: isWalkIn ? 'Walk-In Customer' : (customer?.name || 'Customer'),
        quantity: Number(alloc.quantity) || 0,
        rate: Number(alloc.rate) || 0,
        discount: Number(alloc.discount) || 0,
        remarks: ''
      };
    });

  // Calculate overall statistics
  const totalQtyRequested = activeAllocations.reduce((sum, a) => sum + a.quantity, 0);
  const totalGrossSale = activeAllocations.reduce((sum, a) => sum + (a.quantity * a.rate), 0);
  const totalDiscount = activeAllocations.reduce((sum, a) => sum + a.discount, 0);
  const totalCommission = activeAllocations.reduce((sum, a) => sum + getCommissionEstimate(allocations[a.id], a.quantity, a.rate), 0);
  const totalCustomerReceivable = totalGrossSale + totalCommission - totalDiscount;
  const remainingQtyAfterSale = availableQty - totalQtyRequested;

  // Form submit - opens preview
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStockId) {
      setMessage({ text: t('Please select a farmer consignment batch Lot.'), type: 'error' });
      return;
    }

    if (activeAllocations.length === 0) {
      setMessage({ text: t('Please select at least one customer using the checkbox.'), type: 'error' });
      return;
    }

    // Validate active allocations
    for (const a of activeAllocations) {
      if (isNaN(a.quantity) || a.quantity <= 0) {
        setMessage({ text: t('Quantity for {{name}} must be a valid positive number.', { name: a.customerName }), type: 'error' });
        return;
      }
      if (isNaN(a.rate) || a.rate <= 0) {
        setMessage({ text: t('Rate for {{name}} must be a valid positive number.', { name: a.customerName }), type: 'error' });
        return;
      }
    }

    if (totalQtyRequested > availableQty) {
      setMessage({
        text: t('Requested total quantity ({{requested}}) exceeds available consignment stock ({{available}}).', { requested: totalQtyRequested, available: availableQty }),
        type: 'error'
      });
      return;
    }

    // All validations passed - show preview
    if (isOwnTradingSale) ownSaleRequestKey.current = globalThis.crypto?.randomUUID?.() || `own-sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPreviewData({
      totalQty: totalQtyRequested,
      totalGross: totalGrossSale,
      totalComm: totalCommission,
      totalReceivable: totalCustomerReceivable,
      remainingQty: remainingQtyAfterSale
    });
    setShowPreview(true);
    setMessage(null);
  };

  // Confirm and actually save the batch sale
  const handleConfirmAndSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const payload = {
        stockEntryId: selectedStockId,
        ...(isOwnTradingSale ? { idempotencyKey: ownSaleRequestKey.current } : {}),
        ...(!isOwnTradingSale ? { customCommission: customCommission !== '' ? Number(customCommission) : undefined, customCommissionType } : {}),
        date,
        buyers: activeAllocations.map(a => ({
          isWalkIn: a.isWalkIn,
          customerId: a.isWalkIn ? null : a.id,
          walkInName: a.isWalkIn ? 'Walk-In Customer' : undefined,
          walkInMobile: '',
          walkInVehicle: '',
          remarks: '',
          quantity: a.quantity,
          saleRate: a.rate,
          discount: a.discount
        }))
      };
console.log('Submitting payload:', JSON.stringify(payload, null, 2));
      await api.post('/sales', payload);
      
      setShowPreview(false);
      setPreviewData(null);
      ownSaleRequestKey.current = null;
      setMessage({ text: t('Batch Sale with Custom Rates recorded successfully!'), type: 'success' });
      
      // Reset form on success
      setSelectedStockId('');
      setCustomCommission('');
      setAllocations({});
      
      // Refresh current stock quantities in the background
      fetchRequiredData();
    } catch (err) {
      console.error(err);
      setMessage({ text: err.response?.data?.error || t('Failed to record batch sale.'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Preview Modal
  const PreviewModal = () => {
    if (!showPreview || !previewData) return null;

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white dark:bg-[#1E293B] border-b border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                <CheckCircle size={20} className="text-emerald-500" />
                {t('Preview Batch Sale (Custom Rate)')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('Review allocation details before recording')}</p>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-6">
            {/* Consignment Summary */}
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs font-black uppercase text-[#4F46E5] dark:text-indigo-400 tracking-widest">{t('Consignment Details')}</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="block text-[9px] opacity-60 uppercase tracking-wider">{t('Product')}</span>
                      <span className="font-bold text-slate-800 dark:text-white">{activeProduct?.name || activeStock?.productName}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] opacity-60 uppercase tracking-wider">{t('Beopari/Grower')}</span>
                      <span className="font-bold text-slate-800 dark:text-white">{activeStock?.supplierName}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] opacity-60 uppercase tracking-wider">{t('Sale Date')}</span>
                      <span className="font-bold text-slate-800 dark:text-white">{date}</span>
                    </div>
                    <div>
                    {!isOwnTradingSale && <span className="block text-[9px] opacity-60 uppercase tracking-wider">{t('Commission')}</span>}
                    {!isOwnTradingSale && <span className="font-bold text-slate-800 dark:text-white">
                        {customCommission || '0'} {customCommissionType === 'Percentage' ? '%' : 'Rs/unit'}
                      </span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Buyers Allocation Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">{t('Allocated Buyers')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-3">{t('Customer')}</th>
                      <th className="py-3 px-3 text-right w-20">{t('Qty')}</th>
                      <th className="py-3 px-3 text-right w-24">{t('Rate')}</th>
                      <th className="py-3 px-3 text-right w-32">{t('Gross Amount')}</th>
                      {!isOwnTradingSale && <th className="py-3 px-3 text-right w-32">{t('Commission')}</th>}
                      <th className="py-3 px-3 text-right w-32">{t('Total Bill')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAllocations.map((alloc, idx) => {
                      const grossAmt = alloc.quantity * alloc.rate;
                      const commission = getCommissionEstimate(allocations[alloc.id], alloc.quantity, alloc.rate);
                      const totalBill = grossAmt + commission - alloc.discount;
                      return (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-3">
                            <div>
                              <span className="font-semibold text-slate-800 dark:text-white block">{alloc.customerName}</span>
                              <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                {alloc.isWalkIn ? t('Fast Retail') : (allocations[alloc.id]?.khataId || t('Registered'))}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-800 dark:text-white">
                            {alloc.quantity} {activeProduct?.unit || t('Units')}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            Rs. {alloc.rate.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              Rs. {grossAmt.toLocaleString()}
                            </span>
                          </td>
                          {!isOwnTradingSale && <td className="py-3 px-3 text-right">
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              Rs. {commission.toLocaleString()}
                            </span>
                          </td>}
                          <td className="py-3 px-3 text-right font-bold text-[#4F46E5] dark:text-indigo-400">
                            Rs. {totalBill.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-3">
              <h3 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">{t('Batch Totals')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold">
                <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-500 uppercase tracking-wider">{t('Total Qty Allocated')}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white mt-1">
                    {previewData.totalQty} {activeProduct?.unit || t('Units')}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-500 uppercase tracking-wider">{t('Gross Sale')}</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    Rs. {previewData.totalGross.toLocaleString()}
                  </span>
                </div>
                {!isOwnTradingSale && <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-500 uppercase tracking-wider">{t('Total Commission')}</span>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1">
                    Rs. {previewData.totalComm.toLocaleString()}
                  </span>
                </div>}
                <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-[#4F46E5] uppercase tracking-wider">{t('Total Receivable')}</span>
                  <span className="text-sm font-black text-[#4F46E5] dark:text-indigo-400 mt-1">
                    Rs. {previewData.totalReceivable.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-emerald-500/10">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{t('Remaining Stock After Sale')}</span>
                  <span className={`text-sm font-black ${previewData.remainingQty >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {previewData.remainingQty} {activeProduct?.unit || 'Units'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 bg-white dark:bg-[#1E293B] border-t border-slate-200 dark:border-slate-800 p-6 flex justify-end gap-3">
            <button
              onClick={() => setShowPreview(false)}
              type="button"
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Edit & Go Back
            </button>
            <button
              onClick={handleConfirmAndSave}
              disabled={saving}
              type="button"
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <SpokeSpinner size={16} color="#FFFFFF" />
                  <span>{t('Recording...')}</span>
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  <span>{t('Confirm & Record Sale')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-10 h-10 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest opacity-60">{t('Loading batch sale form data...')}</p>
      </div>
    );
  }

  // Filter out closed or fully sold consignments
  const activeConsignments = stockEntries.filter(s => {
    const qty = s.remainingQuantity !== undefined ? s.remainingQuantity : s.quantity;
    return qty > 0;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <button 
            onClick={() => setCurrentTab('sales')}
            className="flex items-center space-x-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-bold uppercase tracking-wider mb-2"
          >
            <ArrowLeft size={14} />
            <span>{t('Back to Sales Ledger')}</span>
          </button>
          <h2 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
            {t('Batch Sale (Custom Rate)')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Record batch sales with individual rates per customer')}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
          <div className="text-xs font-bold uppercase tracking-wide flex-1">{message.text}</div>
          <button onClick={() => setMessage(null)} className="font-bold hover:scale-105">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Batch Selection & Commission */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 space-y-5 shadow-sm">
            
            <h3 className="text-xs font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-400">
              {t(isOwnTradingSale ? '1. Select Own Trading Lot' : '1. Select Consignment & Commission')}
            </h3>

            {/* Select Stock Entry */}
            <div className="space-y-1.5">
              <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase block text-[10px] tracking-wider">
                {t(isOwnTradingSale ? 'Own Trading' : 'Farmer Consignment Batch (Lot)')}
              </label>
              <select
                required
                value={selectedStockId}
                onChange={(e) => {
                  setSelectedStockId(e.target.value);
                  setMessage(null);
                }}
                className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl px-4 py-3 outline-none text-xs font-semibold"
              >
                <option value="">-- {t('Choose Active Consignment')} --</option>
                {activeConsignments.map(s => {
                  const qty = s.remainingQuantity !== undefined ? s.remainingQuantity : s.quantity;
                  return (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {s.businessMode === 'Own Trading' ? `${t('Own Trading')} — ` : ''}{s.productName} ({qty} {t('units left')}) - {s.supplierName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selected Consignment Summary Card */}
            {activeStock ? (
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/15 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-indigo-500/10">
                  <span className="text-[10px] font-black uppercase text-indigo-400">{t('Lot Information')}</span>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                    {t('Active')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  <div>
                    <span className="block opacity-60">{t('PRODUCT')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeStock.productName}</span>
                  </div>
                  <div>
                    <span className="block opacity-60">{t('BEOPARI/GROWER')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeStock.supplierName}</span>
                  </div>
                  <div>
                    <span className="block opacity-60">{t('TOTAL QTY')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {activeStock.quantity} {activeProduct?.unit || t('Units')}
                    </span>
                  </div>
                  <div>
                    <span className="block opacity-60 text-indigo-400">{t('AVAILABLE')}</span>
                    <span className="font-extrabold text-[#4F46E5] dark:text-indigo-400">
                      {availableQty} {activeProduct?.unit || t('Units')}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-500 py-6">
                <Info size={18} className="mx-auto mb-1.5 opacity-60 text-indigo-400" />
                {t('Select a Farmer consignment batch above to populate batch details.')}
              </div>
            )}

            {/* Commission & Date */}
            <div className="space-y-4 pt-2">
              {!isOwnTradingSale && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase block text-[10px] tracking-wider">
                    {t('Commission Type')}
                  </label>
                  <select
                    value={customCommissionType}
                    onChange={(e) => setCustomCommissionType(e.target.value)}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl px-3.5 py-2.5 outline-none text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="Per Unit">{t('Per Unit')} (Rs. / unit)</option>
                    <option value="Percentage">{t('Percentage')} (% {t('of Sale')})</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase block text-[10px] tracking-wider">
                    {t('Commission Rate')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder={customCommissionType === 'Percentage' ? t('e.g. 5%') : t('e.g. 40 Rs./unit')}
                      value={customCommission}
                      onChange={(e) => setCustomCommission(e.target.value)}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl pl-3.5 pr-14 py-2.5 outline-none text-sm font-black text-slate-800 dark:text-white"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 pointer-events-none">
                      {customCommissionType === 'Percentage' ? '%' : 'Rs/unit'}
                    </span>
                  </div>
                </div>
              </div>}

              <div className="space-y-1.5">
                <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase block text-[10px] tracking-wider">
                  {t('Booking Date')}
                </label>
                <div className="relative">
                  <input
                    required
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl px-4 py-3 outline-none text-xs font-semibold"
                  />
                  <Calendar size={14} className="absolute right-3.5 top-3.5 opacity-40 pointer-events-none" />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Buyers with Custom Rates */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 space-y-5 shadow-sm">
            
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                {t('2. Allocate Quantities & Rates to Buyers')}
              </h3>
            </div>

            {/* Live Summary */}
            {activeStock && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-[#4F46E5] dark:text-indigo-400 tracking-widest">
                      {t('Live Allocation Balance Sheet')}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                    <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="block text-[8px] text-slate-500 uppercase tracking-wider">{t('Requested Qty')}:</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">
                        {totalQtyRequested} {activeProduct?.unit || t('Units')}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="block text-[8px] text-slate-500 uppercase tracking-wider">{t('Gross Sale')}:</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        Rs. {totalGrossSale.toLocaleString()}
                      </span>
                    </div>

                    {!isOwnTradingSale && <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="block text-[8px] text-slate-500 uppercase tracking-wider">{t('Total Comm')}:</span>
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                        Rs. {totalCommission.toLocaleString()}
                      </span>
                    </div>}

                    <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="block text-[8px] text-indigo-400 uppercase tracking-wider">{t('Total Receivable')}:</span>
                      <span className="text-sm font-black text-[#4F46E5] dark:text-indigo-400">
                        Rs. {totalCustomerReceivable.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {remainingQtyAfterSale < 0 && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase">
                      <AlertTriangle size={15} />
                      {t('Warning: Requested quantity exceeds available stock by {{quantity}} units!', { quantity: Math.abs(remainingQtyAfterSale) })}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSetAllRate(true)}
                    disabled={activeAllocations.length === 0}
                    className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                  >
                    {t('Set Rate for All')}
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: t('Discard Draft?'),
                          message: t('Discard all unsaved progress and go back?'),
                          confirmText: t('Discard Draft'),
                          type: 'warning'
                        });
                        if (confirmed) {
                          setCurrentTab('sales');
                        }
                      }}
                      className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      {t('Discard Draft')}
                    </button>
                    <button
                      type="submit"
                      disabled={saving || remainingQtyAfterSale < 0 || totalQtyRequested === 0}
                      className="px-6 py-2.5 bg-[#4F46E5] hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/15 flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      {saving ? (
                        <>
                          <SpokeSpinner size={16} color="#FFFFFF" />
                          <span>{t('Recording Vouchers...')}</span>
                        </>
                      ) : (
                        <span>{t('Save Batch Sale Voucher')}</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search Bar for Buyers */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('Search & select buyers to allocate quantity and rate:')}
              </div>
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder={t('Search buyer name or phone...')}
                  value={buyerSearchQuery}
                  onChange={(e) => setBuyerSearchQuery(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl pl-8 pr-8 py-2 outline-none text-xs text-slate-800 dark:text-slate-200 font-medium placeholder:text-slate-400 focus:border-[#4F46E5] transition-all"
                />
                <Search size={14} className="absolute left-2.5 top-3 text-slate-400 pointer-events-none" />
                {buyerSearchQuery && (
                  <button 
                    type="button" 
                    onClick={() => setBuyerSearchQuery('')}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Buyers Table with Qty & Rate */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4 text-center w-12">{t('Select')}</th>
                    <th className="py-3 px-4">{t('Customer / Buyer')}</th>
                    <th className="py-3 px-4 w-36">{t('Quantity')}</th>
                    <th className="py-3 px-4 w-36">{t('Rate (Rs. / unit)')}</th>
                    <th className="py-3 px-4 w-36">{t('Discount (Rs.)')}</th>
                    <th className="py-3 px-4 text-right w-44">{t('Total Bill (Rs.)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Walk-In Customer */}
                  {showWalkIn && (
                    <tr className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${allocations['walk-in']?.checked ? 'bg-indigo-500/5 dark:bg-indigo-500/10' : ''}`}>
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={!!allocations['walk-in']?.checked}
                          onChange={() => toggleChecked('walk-in')}
                          className="w-4 h-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5] cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-slate-800 dark:text-slate-200">
                            {t('Walk-In Customer')}
                          </span>
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {t('Fast Retail')}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="number"
                          min="1"
                          placeholder={t('Qty')}
                          disabled={!allocations['walk-in']?.checked}
                          value={allocations['walk-in']?.quantity || ''}
                          onChange={(e) => updateAllocation('walk-in', 'quantity', e.target.value)}
                          className={`w-full max-w-[120px] bg-white dark:bg-[#1E293B] border rounded-xl px-3 py-1.5 outline-none text-xs font-bold transition-all ${
                            allocations['walk-in']?.checked
                              ? 'border-[#4F46E5] dark:border-indigo-500 ring-1 ring-[#4F46E5] text-slate-800 dark:text-white'
                              : 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40'
                          }`}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="number"
                          min="0"
                          placeholder={t('Rate')}
                          disabled={!allocations['walk-in']?.checked}
                          value={allocations['walk-in']?.rate || ''}
                          onChange={(e) => updateAllocation('walk-in', 'rate', e.target.value)}
                          className={`w-full max-w-[120px] bg-white dark:bg-[#1E293B] border rounded-xl px-3 py-1.5 outline-none text-xs font-bold transition-all ${
                            allocations['walk-in']?.checked
                              ? 'border-[#4F46E5] dark:border-indigo-500 ring-1 ring-[#4F46E5] text-slate-800 dark:text-white'
                              : 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40'
                          }`}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="number"
                          min="0"
                          placeholder={t('Discount')}
                          disabled={!allocations['walk-in']?.checked}
                          value={allocations['walk-in']?.discount || ''}
                          onChange={(e) => updateAllocation('walk-in', 'discount', e.target.value)}
                          className={`w-full max-w-[120px] bg-white dark:bg-[#1E293B] border rounded-xl px-3 py-1.5 outline-none text-xs font-semibold transition-all ${
                            allocations['walk-in']?.checked
                              ? 'border-[#4F46E5] dark:border-indigo-500 text-slate-800 dark:text-white'
                              : 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40'
                          }`}
                        />
                      </td>
                      <td className="py-4 px-4 text-right">
                        {allocations['walk-in']?.checked && Number(allocations['walk-in']?.quantity) > 0 && Number(allocations['walk-in']?.rate) > 0 ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                              Rs. {((Number(allocations['walk-in']?.quantity) * Number(allocations['walk-in']?.rate)) - (Number(allocations['walk-in']?.discount) || 0)).toLocaleString()}
                            </span>
                            {!isOwnTradingSale && <span className="block text-[8px] text-slate-400 font-bold uppercase">
                              Comm: Rs. {getCommissionEstimate(allocations['walk-in'], allocations['walk-in']?.quantity, allocations['walk-in']?.rate).toLocaleString()}
                            </span>}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-semibold">-</span>
                        )}
                      </td>
                    </tr>
                  )}

                  {/* Registered Customers Rows */}
                  {filteredCustomers.map((c) => {
                    const cId = c.id || c._id;
                    const isChecked = !!allocations[cId]?.checked;
                    const qtyVal = allocations[cId]?.quantity || '';
                    const rateVal = allocations[cId]?.rate || '';
                    const discountVal = allocations[cId]?.discount || '';
                    
                    return (
                      <tr key={cId} className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${isChecked ? 'bg-indigo-500/5 dark:bg-indigo-500/10' : ''}`}>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleChecked(cId)}
                            className="w-4 h-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5] cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200">
                              {c.name}
                            </span>
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              {c.khataId || 'No Khata ID'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Phone: {c.phone || 'N/A'} | Balance: Rs. {c.currentBalance?.toLocaleString() || 0}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <input
                            type="number"
                            min="1"
                            placeholder={t('Qty')}
                            disabled={!isChecked}
                            value={qtyVal}
                            onChange={(e) => updateAllocation(cId, 'quantity', e.target.value)}
                            className={`w-full max-w-[120px] bg-white dark:bg-[#1E293B] border rounded-xl px-3 py-1.5 outline-none text-xs font-bold transition-all ${
                              isChecked
                                ? 'border-[#4F46E5] dark:border-indigo-500 ring-1 ring-[#4F46E5] text-slate-800 dark:text-white'
                                : 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40'
                            }`}
                          />
                        </td>
                        <td className="py-4 px-4">
                          <input
                            type="number"
                            min="0"
                            placeholder={t('Rate')}
                            disabled={!isChecked}
                            value={rateVal}
                            onChange={(e) => updateAllocation(cId, 'rate', e.target.value)}
                            className={`w-full max-w-[120px] bg-white dark:bg-[#1E293B] border rounded-xl px-3 py-1.5 outline-none text-xs font-bold transition-all ${
                              isChecked
                                ? 'border-[#4F46E5] dark:border-indigo-500 ring-1 ring-[#4F46E5] text-slate-800 dark:text-white'
                                : 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40'
                            }`}
                          />
                        </td>
                        <td className="py-4 px-4">
                          <input
                            type="number"
                            min="0"
                            placeholder={t('Discount')}
                            disabled={!isChecked}
                            value={discountVal}
                            onChange={(e) => updateAllocation(cId, 'discount', e.target.value)}
                            className={`w-full max-w-[120px] bg-white dark:bg-[#1E293B] border rounded-xl px-3 py-1.5 outline-none text-xs font-semibold transition-all ${
                              isChecked
                                ? 'border-[#4F46E5] dark:border-indigo-500 text-slate-800 dark:text-white'
                                : 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40'
                            }`}
                          />
                        </td>
                        <td className="py-4 px-4 text-right">
                          {isChecked && Number(qtyVal) > 0 && Number(rateVal) > 0 ? (
                            <div className="space-y-0.5">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                Rs. {((Number(qtyVal) * Number(rateVal)) - (Number(discountVal) || 0)).toLocaleString()}
                              </span>
                              {!isOwnTradingSale && <span className="block text-[8px] text-slate-400 font-bold uppercase">
                                Comm: Rs. {getCommissionEstimate(allocations[cId], qtyVal, rateVal).toLocaleString()}
                              </span>}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-semibold">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!showWalkIn && filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 font-semibold text-xs">
                        No buyers found matching "{buyerSearchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </form>

      {/* Set Rate for All Modal */}
      {showSetAllRate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white">{t('Set Rate for All Checked Customers')}</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{t('Rate (Rs. / unit)')}</label>
              <input
                type="number"
                min="0"
                placeholder={t('Enter rate')}
                value={setAllRateValue}
                onChange={(e) => setSetAllRateValue(e.target.value)}
                className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl px-4 py-2.5 outline-none text-sm font-bold text-slate-800 dark:text-white focus:border-[#4F46E5]"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSetAllRate(false);
                  setSetAllRateValue('');
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold uppercase"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSetRateForAll}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase"
              >
                {t('Apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <PreviewModal />
    </div>
  );
}
