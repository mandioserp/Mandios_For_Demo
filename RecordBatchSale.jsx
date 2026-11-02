import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { 
  ArrowLeft, Plus, Trash2, Calendar, ShoppingBag, User, 
  Truck, CheckCircle, AlertTriangle, HelpCircle, FileText, Info,
  Search, X
} from 'lucide-react';
import SpokeSpinner from './common/SpokeSpinner.jsx';

export default function RecordBatchSale({ setCurrentTab, user }) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  
  // Data lists
  const [stockEntries, setStockEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [commissionRules, setCommissionRules] = useState([]);
  const [products, setProducts] = useState([]);

  // Form states
  const [selectedStockId, setSelectedStockId] = useState('');
  const [saleRate, setSaleRate] = useState('');
  const [customCommission, setCustomCommission] = useState('');
  const [customCommissionType, setCustomCommissionType] = useState('Per Unit');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [allocations, setAllocations] = useState({});
  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');

  // UI management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { text, type: 'success' | 'error' }

  useEffect(() => {
    fetchRequiredData();
  }, []);

  const fetchRequiredData = async () => {
    try {
      setLoading(true);
      const [stockRes, custRes, prodRes] = await Promise.all([
        api.get('/stock').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] })),
        // api.get('/settings/commission-rules').catch(() => ({ data: [] })),
        api.get('/products').catch(() => ({ data: [] }))
      ]);

      const extractArray = (data) => Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : (Array.isArray(data?.data) ? data.data : []));
      setStockEntries(extractArray(stockRes.data));
      setCustomers(extractArray(custRes.data));
      // setCommissionRules(rulesRes.data || []);
      setProducts(extractArray(prodRes.data));
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load initial data from server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Get currently selected stock entry
  const activeStock = stockEntries.find(s => (s.id || s._id) === selectedStockId);
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

  // Auto-populate commission input (commented out product default commission setting as requested)
  /*
  useEffect(() => {
    if (activeProduct) {
      if (activeProduct.defaultCommission !== undefined && activeProduct.defaultCommission !== null) {
        setCustomCommission(String(activeProduct.defaultCommission));
      } else {
        setCustomCommission('');
      }
      if (activeProduct.commissionType) {
        setCustomCommissionType(activeProduct.commissionType);
      }
    } else {
      setCustomCommission('');
    }
  }, [selectedStockId, activeProduct]);
  */

  // Calculate dynamic commission for a row (based on Custom Batch Commission or Commission Rules)
  const getCommissionEstimate = (alloc, customerId) => {
    if (!alloc || !alloc.checked || !Number(alloc.quantity) || !Number(saleRate)) return 0;
    const qty = Number(alloc.quantity);
    const rate = Number(saleRate);
    const grossVal = qty * rate;

    let commType = customCommissionType || 'Per Unit';
    let commVal = 0;
    let commBasis = 'Sale Amount';

    if (customCommission !== '' && customCommission !== null && customCommission !== undefined && !isNaN(Number(customCommission))) {
      commVal = Number(customCommission);
      commType = customCommissionType || 'Per Unit';
    } else {
      /*
      // Commented out commission rules & product default matching logic as requested
      const prod = activeProduct;
      const pId = prod ? (prod.id || prod._id || stockProdId) : stockProdId;

      let matchedRule = null;
      if (customerId) {
        const custId = typeof customerId === 'object' ? (customerId.id || customerId._id) : customerId;
        matchedRule = commissionRules.find(r => r.status === 'Active' && r.scope === 'Customer Specific' && (r.customerId === custId || r.customerId === customerId));
      }
      if (!matchedRule && activeStock?.supplierId) {
        const supId = typeof activeStock.supplierId === 'object' ? (activeStock.supplierId.id || activeStock.supplierId._id) : activeStock.supplierId;
        matchedRule = commissionRules.find(r => r.status === 'Active' && r.scope === 'Supplier Specific' && (r.supplierId === supId || r.supplierId === activeStock.supplierId));
      }
      if (!matchedRule && pId) {
        matchedRule = commissionRules.find(r => r.status === 'Active' && r.scope === 'Product Specific' && (r.productId === pId || r.productId === String(pId)));
      }

      if (matchedRule) {
        commType = matchedRule.commissionType;
        commVal = Number(matchedRule.value) || 0;
        commBasis = matchedRule.chargeBasis || 'Sale Amount';
      }
      */
      commVal = 0;
    }

    let commAmount = 0;
    if (commType === 'Percentage') {
      commAmount = grossVal * (commVal / 100);
    } else if (commType === 'Per Unit' || commType === 'Fixed Amount') {
      commAmount = commVal * qty;
    } else {
      switch (commBasis) {
        case 'Per Kilogram':
          const weight = Number(activeProduct?.averageWeight) || 0;
          const totalKg = weight > 0 ? (weight * qty) : qty;
          commAmount = commVal * totalKg;
          break;
        case 'Per Maund':
          const w = Number(activeProduct?.averageWeight) || 0;
          const totalMaund = w > 0 ? ((w * qty) / 40) : (qty / 40);
          commAmount = commVal * totalMaund;
          break;
        case 'Per Invoice':
          commAmount = commVal;
          break;
        case 'Per Crate':
        case 'Per Box':
        case 'Per Basket':
        case 'Sale Amount':
        default:
          commAmount = commVal * qty;
          break;
      }
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
        discount: Number(alloc.discount) || 0,
        remarks: ''
      };
    });

  // Calculate overall statistics
  const totalQtyRequested = activeAllocations.reduce((sum, a) => sum + a.quantity, 0);
  const totalGrossSale = activeAllocations.reduce((sum, a) => sum + (a.quantity * (Number(saleRate) || 0)), 0);
  const totalDiscount = activeAllocations.reduce((sum, a) => sum + a.discount, 0);
  const totalCommission = activeAllocations.reduce((sum, a) => sum + getCommissionEstimate(allocations[a.id], a.customerId), 0);
  
  // Total Invoice Amount for customers: gross + commission - discount (commission recovered from buyers)
  const totalCustomerReceivable = totalGrossSale + totalCommission - totalDiscount;

  const remainingQtyAfterSale = availableQty - totalQtyRequested;

  // Form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStockId) {
      setMessage({ text: 'Please select a farmer consignment batch Lot.', type: 'error' });
      return;
    }
    const rate = Number(saleRate);
    if (isNaN(rate) || rate <= 0) {
      setMessage({ text: 'Please enter a valid selling rate.', type: 'error' });
      return;
    }

    if (activeAllocations.length === 0) {
      setMessage({ text: 'Please select at least one customer using the checkbox.', type: 'error' });
      return;
    }

    // Validate active allocations
    for (const a of activeAllocations) {
      if (isNaN(a.quantity) || a.quantity <= 0) {
        setMessage({ text: `Quantity for ${a.customerName} must be a valid positive number.`, type: 'error' });
        return;
      }
    }

    if (totalQtyRequested > availableQty) {
      setMessage({
        text: `Requested total quantity (${totalQtyRequested}) exceeds available consignment stock (${availableQty}).`,
        type: 'error'
      });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const payload = {
        stockEntryId: selectedStockId,
        saleRate: rate,
        customCommission: customCommission !== '' ? Number(customCommission) : undefined,
        customCommissionType: customCommissionType,
        date,
        buyers: activeAllocations.map(a => ({
          isWalkIn: a.isWalkIn,
          customerId: a.isWalkIn ? null : a.id,
          walkInName: a.isWalkIn ? 'Walk-In Customer' : undefined,
          walkInMobile: '',
          walkInVehicle: '',
          remarks: '',
          quantity: a.quantity,
          discount: a.discount
        }))
      };

      await api.post('/sales', payload);
      
      setMessage({ text: 'Batch Consignment Sale recorded successfully!', type: 'success' });
      
      // Reset form on success
      setSelectedStockId('');
      setSaleRate('');
      setCustomCommission('');
      setAllocations({});
      
      // Refresh current stock quantities in the background
      fetchRequiredData();
    } catch (err) {
      console.error(err);
      setMessage({ text: err.response?.data?.error || 'Failed to record batch sale.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-10 h-10 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest opacity-60">Loading batch sale form data...</p>
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
            <span>Back to Sales Ledger</span>
          </button>
          <h2 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
             Record Batch Consignment Sale
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Allocate and sell arrivals from a single farmer consignment batch to multiple buyers quickly
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
        
        {/* Left Column: Batch Selection & Pricing Details */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 space-y-5 shadow-sm">
            
            <h3 className="text-xs font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-400">
              1. Select Consignment & Price
            </h3>

            {/* Select Stock Entry */}
            <div className="space-y-1.5">
              <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase block text-[10px] tracking-wider">
                Farmer Consignment Batch (Lot)
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
                <option value="">-- Choose Active Consignment --</option>
                {activeConsignments.map(s => {
                  const qty = s.remainingQuantity !== undefined ? s.remainingQuantity : s.quantity;
                  return (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {s.productName} ({qty} units left) - {s.supplierName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selected Consignment Summary Card */}
            {activeStock ? (
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/15 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-indigo-500/10">
                  <span className="text-[10px] font-black uppercase text-indigo-400">Lot Information</span>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  <div>
                    <span className="block opacity-60">LOT NUMBER</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[9px]">
                      {(activeStock.id || activeStock._id).substring(0, 10).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="block opacity-60">BEOPARI/GROWER (FARMER)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {activeStock.supplierName}
                    </span>
                  </div>
                  <div>
                    <span className="block opacity-60">PRODUCT</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {activeStock.productName}
                    </span>
                  </div>
                  <div>
                    <span className="block opacity-60">ARRIVAL DATE</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {activeStock.date}
                    </span>
                  </div>
                  <div>
                    <span className="block opacity-60">TOTAL QUANTITY</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {activeStock.quantity} {activeProduct?.unit || 'Units'}
                    </span>
                  </div>
                  <div>
                    <span className="block opacity-60 text-indigo-400">AVAILABLE QUANTITY</span>
                    <span className="font-extrabold text-[#4F46E5] dark:text-indigo-400">
                      {availableQty} {activeProduct?.unit || 'Units'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-500 py-6">
                <Info size={18} className="mx-auto mb-1.5 opacity-60 text-indigo-400" />
                Select a Farmer consignment batch above to populate batch details and active rates.
              </div>
            )}

            {/* Set Sale Price, Commission & Date */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase block text-[10px] tracking-wider">
                    Selling Rate (Rs. / unit)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder="Enter sale rate"
                    value={saleRate}
                    onChange={(e) => setSaleRate(e.target.value)}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl px-3.5 py-2.5 outline-none text-sm font-black text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase block text-[10px] tracking-wider">
                    Commission Strategy
                  </label>
                  <select
                    value={customCommissionType}
                    onChange={(e) => setCustomCommissionType(e.target.value)}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl px-3.5 py-2.5 outline-none text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="Per Unit">Per Unit (Rs. / unit)</option>
                    <option value="Percentage">Percentage (% of Sale)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase block text-[10px] tracking-wider">
                    Batch Commission Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder={customCommissionType === 'Percentage' ? 'e.g. 5%' : 'e.g. 40 Rs./unit'}
                      value={customCommission}
                      onChange={(e) => setCustomCommission(e.target.value)}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl pl-3.5 pr-14 py-2.5 outline-none text-sm font-black text-slate-800 dark:text-white"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 pointer-events-none">
                      {customCommissionType === 'Percentage' ? '%' : 'Rs/unit'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase block text-[10px] tracking-wider">
                  Booking Date
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

        {/* Right Column: Buyers Allocation Setup */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 space-y-5 shadow-sm">
            
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                2. Allocate Quantities to Buyers (Select & Type)
              </h3>
            </div>

            {/* Real-time Consignment Live Summary & Action Buttons (Under Heading) */}
            {activeStock && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-[#4F46E5] dark:text-indigo-400 tracking-widest">
                      Live Consignment Allocation Balance Sheet
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      ✓ Buyer Commission Recovered from Customer
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                    <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="block text-[8px] text-slate-500 uppercase tracking-wider">Requested Qty:</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">
                        {totalQtyRequested} {activeProduct?.unit || 'Units'}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="block text-[8px] text-slate-500 uppercase tracking-wider">Gross Sale (Beopari/Grower Credit):</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        Rs. {totalGrossSale.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="block text-[8px] text-slate-500 uppercase tracking-wider">Buyer Comm. Recovered:</span>
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                        Rs. {totalCommission.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="block text-[8px] text-indigo-400 uppercase tracking-wider">Total Customer Purchase Value:</span>
                      <span className="text-sm font-black text-[#4F46E5] dark:text-indigo-400">
                        Rs. {totalCustomerReceivable.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {remainingQtyAfterSale < 0 && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase">
                      <AlertTriangle size={15} />
                      Warning: Requested batch sale quantity exceeds active available stock by {Math.abs(remainingQtyAfterSale)} units!
                    </div>
                  )}
                </div>

                {/* Form Submission & Discard Buttons */}
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: 'Discard Draft?',
                        message: 'Discard all unsaved progress and go back?',
                        confirmText: 'Discard Draft',
                        type: 'warning'
                      });
                      if (confirmed) {
                        setCurrentTab('sales');
                      }
                    }}
                    className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Discard Draft
                  </button>
                  <button
                    type="submit"
                    disabled={saving || remainingQtyAfterSale < 0 || totalQtyRequested === 0}
                    className="px-6 py-2.5 bg-[#4F46E5] hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/15 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <SpokeSpinner size={16} color="#FFFFFF" />
                        <span>Recording Ledger Vouchers...</span>
                      </>
                    ) : (
                      <span>Save Batch Sale Voucher</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Search Bar for Buyers (Under Balance Sheet) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Search & select buyers to allocate quantity:
              </div>
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search buyer name or phone..."
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

            {/* Buyers Checkbox Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4 text-center w-12">Select</th>
                    <th className="py-3 px-4">Customer / Buyer</th>
                    <th className="py-3 px-4 w-40">Quantity to Allocate</th>
                    <th className="py-3 px-4 w-40">Discount (Rs.)</th>
                    <th className="py-3 px-4 text-right w-44">Total Bill (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Walk-In Customer (Fast Retail) */}
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
                            Walk-In Customer
                          </span>
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Fast Retail
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          No registration or ledger account required
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
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
                          placeholder="Discount"
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
                        {allocations['walk-in']?.checked && Number(allocations['walk-in']?.quantity) > 0 ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                              Rs. {((Number(allocations['walk-in']?.quantity) * (Number(saleRate) || 0)) - (Number(allocations['walk-in']?.discount) || 0)).toLocaleString()}
                            </span>
                            <span className="block text-[8px] text-slate-400 font-bold uppercase">
                              Est. Comm: Rs. {getCommissionEstimate(allocations['walk-in'], null).toLocaleString()}
                            </span>
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
                            placeholder="Qty"
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
                            placeholder="Discount"
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
                          {isChecked && Number(qtyVal) > 0 ? (
                            <div className="space-y-0.5">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                Rs. {((Number(qtyVal) * (Number(saleRate) || 0)) - (Number(discountVal) || 0)).toLocaleString()}
                              </span>
                              <span className="block text-[8px] text-slate-400 font-bold uppercase">
                                Est. Comm: Rs. {getCommissionEstimate(allocations[cId], cId).toLocaleString()}
                              </span>
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
                      <td colSpan="5" className="py-8 text-center text-slate-400 font-semibold text-xs">
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

    </div>
  );
}
