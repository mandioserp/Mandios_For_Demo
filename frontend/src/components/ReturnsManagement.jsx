import { useState, useEffect, useRef } from 'react';
import api from '../utils/api.js';
import { formatBusinessDisplayName } from '../utils/businessProfile.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import DialogAlert from './common/DialogAlert.jsx';
import {
  RotateCcw, Plus, History, Search, CheckCircle2,
  AlertCircle, Clock, X, Printer, Check, Ban, Sparkles,
  ShoppingBag, User, Calendar, AlertTriangle
} from 'lucide-react';
import SpokeSpinner from './common/SpokeSpinner.jsx';

export default function ReturnsManagement() {
  const { t } = useLanguage();
  const confirm = useConfirm();

  // Active top view: 'new', 'history'
  const [activeTab, setActiveTab] = useState('new');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Customer & Sales Selection
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSales, setCustomerSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [loadingSales, setLoadingSales] = useState(false);

  // Customer search in New Return
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

  // Form Fields
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [produceReturnedQty, setProduceReturnedQty] = useState('');
  const [produceCondition, setProduceCondition] = useState('Good');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Return History Data & Filters
  const [returnsHistory, setReturnsHistory] = useState([]);
  const [historyTimeFilter, setHistoryTimeFilter] = useState('all'); // 'all', 'today', 'week', 'month'
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // 'all', 'Waiting Approval', 'Approved', 'Rejected', 'Draft'
  const [historyCustomerFilter, setHistoryCustomerFilter] = useState('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Modals
  const [receiptModal, setReceiptModal] = useState(null);
  const [rejectPromptModal, setRejectPromptModal] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejectModalAlert, setRejectModalAlert] = useState(null);

  // Business settings for receipt
  const [businessProfile, setBusinessProfile] = useState(null);

  // Helper toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial Data Load
  const fetchBaseData = async () => {
    setLoading(true);
    try {
      const [customersRes, returnsRes, bizRes] = await Promise.all([
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/returns').catch(() => ({ data: [] })),
        api.get('/settings/business').catch(() => ({ data: null }))
      ]);

      setCustomers(customersRes.data || []);
      setReturnsHistory(returnsRes.data || []);
      if (bizRes?.data) setBusinessProfile(bizRes.data);
    } catch (err) {
      console.error('Failed to load returns data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchBaseData();
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  // Fetch customer recent sales when a customer is selected
  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setSelectedSale(null);
    setProduceReturnedQty('');
    setProduceCondition('Good');
    setIsCustomerDropdownOpen(false);
    setCustomerSearchTerm(cust.name);

    setLoadingSales(true);
    try {
      const res = await api.get(`/customers/${cust.id || cust._id}/recent-sales`);
      setCustomerSales(res.data || []);
      // If there are sales, auto-select the latest one for convenience
      if (res.data && res.data.length > 0) {
        setSelectedSale(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch customer sales:', err);
      setCustomerSales([]);
    } finally {
      setLoadingSales(false);
    }
  };

  // Compute calculated amounts for New Return preview
  const returnRate = selectedSale ? (Number(selectedSale.saleRate) || 0) : 0;
  const produceQtyNum = Number(produceReturnedQty) || 0;
  const calculatedGrossAmount = Math.round(produceQtyNum * returnRate * 100) / 100;
  
  // Calculate commission reversal for returned units
  const saleCommPerUnit = selectedSale ? (Number(selectedSale.commissionPerUnit) || 0) : 0;
  const calculatedReversedCommission = Math.round(produceQtyNum * saleCommPerUnit * 100) / 100;
  const calculatedReturnAmount = Math.round((calculatedGrossAmount + calculatedReversedCommission) * 100) / 100;

  // Maximum produce returnable from chosen sale
  const maxProduceCanReturn = selectedSale ? (selectedSale.canReturn !== undefined ? selectedSale.canReturn : (selectedSale.quantitySold || 0)) : 0;
  const isProduceQtyExceeded = Boolean(selectedSale) && produceQtyNum > maxProduceCanReturn;

  // Validation
  const validateForm = () => {
    if (!selectedCustomer) {
      showToast(t('Please select a customer first.'), 'error');
      return false;
    }

    if (!selectedSale) {
      showToast(t('Please select the original sale.'), 'error');
      return false;
    }
    if (produceQtyNum <= 0) {
      showToast(t('Quantity now returned must be greater than zero.'), 'error');
      return false;
    }
    const maxCanReturn = selectedSale.canReturn !== undefined ? selectedSale.canReturn : selectedSale.quantitySold;
    if (produceQtyNum > maxCanReturn) {
      showToast(t('Quantity cannot be greater than the quantity sold. (Max: {{max}})', { max: maxCanReturn }), 'error');
      return false;
    }

    return true;
  };

  // Submit Return (Submit for Approval or Save Draft)
  const handleSubmitReturn = async (submissionStatus = 'Waiting Approval') => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        returnType: 'Produce',
        date: returnDate,
        customerId: selectedCustomer.id || selectedCustomer._id,
        saleId: selectedSale ? (selectedSale.id || selectedSale._id) : null,
        produceReturnedQty: produceQtyNum,
        produceCondition,
        goodCratesReturned: 0,
        damagedCratesReturned: 0,
        reason,
        notes,
        status: submissionStatus
      };

      await api.post('/returns', payload);
      showToast(submissionStatus === 'Draft' ? t('Return saved as Draft.') : t('Return sent for approval.'), 'success');

      // Refresh data
      await fetchBaseData();

      // Reset form
      setProduceReturnedQty('');
      setProduceCondition('Good');
      setReason('');
      setNotes('');
      // Switch to history tab to view newly created return
      setActiveTab('history');
    } catch (err) {
      console.error('Submit return error:', err);
      const errMsg = err.response?.data?.error || t('Failed to record return. Please try again.');
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Approve Return
  const handleApprove = async (ret) => {
    if (ret.status === 'Approved') {
      showToast(t('Return has already been approved.'), 'error');
      return;
    }

    const isConfirmed = await confirm({
      title: t('Approve Return?'),
      message: t('This will automatically restock {{quantity}} {{unit}} into inventory and credit Rs. {{amount}} to {{customer}} balance for Return #{{number}}. Do you want to proceed?', {
        quantity: ret.produceReturnedQty || 0,
        unit: t(ret.unit || 'crates'),
        amount: (ret.returnAmount || 0).toLocaleString(),
        customer: ret.customerName,
        number: ret.returnNumber
      }),
      confirmText: t('Yes, Approve Return'),
      cancelText: t('Cancel'),
      confirmColor: 'emerald'
    });

    if (!isConfirmed) return;

    setLoading(true);
    try {
      await api.post(`/returns/${ret.id || ret._id}/approve`);
      showToast(t('Return approved successfully. Produce restocked & balance credited.'), 'success');
      await fetchBaseData();
    } catch (err) {
      console.error('Approve return error:', err);
      const errMsg = err.response?.data?.error || t('Failed to approve return.');
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reject Return Trigger
  const handleOpenReject = (ret) => {
    if (ret.status === 'Approved') {
      showToast(t('Cannot reject an already approved return.'), 'error');
      return;
    }
    setRejectPromptModal(ret);
    setRejectReasonInput('');
    setRejectModalAlert(null);
  };

  const handleConfirmReject = async () => {
    if (!rejectPromptModal) return;
    if (!rejectReasonInput.trim()) {
      setRejectModalAlert({ type: 'error', message: t('Please provide a short rejection reason.') });
      return;
    }

    setLoading(true);
    setRejectModalAlert(null);
    try {
      await api.post(`/returns/${rejectPromptModal.id || rejectPromptModal._id}/reject`, {
        rejectionReason: rejectReasonInput.trim()
      });
      showToast(t('Return rejected.'), 'success');
      setRejectPromptModal(null);
      setRejectReasonInput('');
      setRejectModalAlert(null);
      await fetchBaseData();
    } catch (err) {
      console.error('Reject return error:', err);
      const errMsg = err.response?.data?.error || t('Failed to reject return.');
      setRejectModalAlert({ type: 'error', message: errMsg });
    } finally {
      setLoading(false);
    }
  };

  // Delete Return (Draft)
  const handleDeleteReturn = async (ret) => {
    const isConfirmed = await confirm({
      title: t('Delete Return?'),
      message: t('Are you sure you want to delete Return #{{number}}?', { number: ret.returnNumber }),
      confirmText: t('Delete'),
      cancelText: t('Cancel'),
      confirmColor: 'rose'
    });

    if (!isConfirmed) return;

    setLoading(true);
    try {
      await api.delete(`/returns/${ret.id || ret._id}`);
      showToast(t('Return deleted successfully.'), 'success');
      await fetchBaseData();
    } catch (err) {
      console.error('Delete return error:', err);
      showToast(err.response?.data?.error || t('Failed to delete return.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered History
  const filteredHistory = returnsHistory.filter(r => {
    // Time filter
    if (historyTimeFilter === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      if (r.date !== todayStr) return false;
    } else if (historyTimeFilter === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (new Date(r.date) < sevenDaysAgo) return false;
    } else if (historyTimeFilter === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (new Date(r.date) < thirtyDaysAgo) return false;
    }

    // Status filter
    if (historyStatusFilter !== 'all' && r.status !== historyStatusFilter) return false;

    // Customer filter
    if (historyCustomerFilter !== 'all' && String(r.customerId) !== String(historyCustomerFilter)) return false;

    // Search query
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      const matchNum = (r.returnNumber || '').toLowerCase().includes(q);
      const matchCust = (r.customerName || '').toLowerCase().includes(q);
      const matchProd = (r.productName || '').toLowerCase().includes(q);
      if (!matchNum && !matchCust && !matchProd) return false;
    }

    return true;
  });

  // Print Receipt Handler
  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center space-x-3 text-sm font-bold text-white transition-all transform animate-bounce-short ${
          toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <RotateCcw size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-slate-800 dark:text-white">
                {t('Produce Returns & Settlements')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t('Simple Mandi produce returns, automatic stock replenishment, and customer ledger adjustments')} ({t('Produce Returns Ledger')})
              </p>
            </div>
          </div>
        </div>

        {/* 2 Main Action Navigation Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl space-x-1">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
              activeTab === 'new'
                ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Plus size={16} />
            <span>{t('1. New Return')}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
              activeTab === 'history'
                ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History size={16} />
            <span>{t('2. Return History')}</span>
            {returnsHistory.filter(r => r.status === 'Waiting Approval').length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-900 font-black">
                {returnsHistory.filter(r => r.status === 'Waiting Approval').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: NEW RETURN SCREEN
          ========================================================================= */}
      {activeTab === 'new' && (
        <div className="space-y-6">

          {/* Form Step-by-Step Card */}
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            
            {/* Step 1 & Date: Customer & Return Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Customer Selector */}
              <div className="md:col-span-2 space-y-1.5 relative" ref={customerDropdownRef}>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <User size={14} className="text-indigo-500" />
                  <span>{t('Step 1: Select Customer')}</span> *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t('Type customer name or mobile number...')}
                    value={customerSearchTerm}
                    onChange={(e) => {
                      setCustomerSearchTerm(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-[#4F46E5]"
                  />
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setSelectedSale(null);
                        setCustomerSearchTerm('');
                        setCustomerSales([]);
                      }}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                {isCustomerDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 divide-y divide-slate-100 dark:divide-slate-800">
                    {customers
                      .filter(c => {
                        if (!customerSearchTerm) return true;
                        const term = customerSearchTerm.toLowerCase();
                        return (
                          (c.name || '').toLowerCase().includes(term) ||
                          (c.phone || '').toLowerCase().includes(term) ||
                          (c.khataNumber || '').toLowerCase().includes(term)
                        );
                      })
                      .map(cust => (
                        <div
                          key={cust.id || cust._id}
                          onClick={() => handleSelectCustomer(cust)}
                          className="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-white">{cust.name}</p>
                            <p className="text-xs text-slate-400">{cust.phone || t('No phone')} {cust.address ? `• ${cust.address}` : ''}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-indigo-500 block">{t('Balance')}: Rs. {(cust.currentBalance || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Return Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Calendar size={14} className="text-indigo-500" />
                  <span>{t('Return Date')}</span> *
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-[#4F46E5]"
                />
              </div>
            </div>

            {/* Step 2: Recent Sales for Customer */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <ShoppingBag size={14} className="text-indigo-500" />
                  <span>{t('Step 2: Select Original Sale')}</span> *
                </label>
                {selectedCustomer && (
                  <span className="text-xs font-bold text-slate-400">
                    {t('{{count}} recent sales found', { count: customerSales.length })}
                  </span>
                )}
              </div>

              {!selectedCustomer ? (
                <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 font-semibold">
                  {t('Select a customer above to see their recent purchase history.')}
                </div>
              ) : loadingSales ? (
                <div className="py-6 flex justify-center"><SpokeSpinner /></div>
              ) : customerSales.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 font-bold">
                  {t('No recent sales records found for this customer.')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customerSales.map(sale => {
                    const isSelected = selectedSale && String(selectedSale.id || selectedSale._id) === String(sale.id || sale._id);
                    const isSettled = sale.isLotSettled;
                    return (
                      <div
                        key={sale.id || sale._id}
                        onClick={() => {
                          if (isSettled) {
                            showToast(t('Cannot return produce from Lot #{{lot}}. It is already recorded to Payables & Supply Value.', { lot: sale.lotNumber || t('Settled') }), 'error');
                            return;
                          }
                          setSelectedSale(sale);
                        }}
                        className={`p-4 rounded-xl border transition-all ${
                          isSettled
                            ? 'opacity-60 bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                            : isSelected
                            ? 'border-[#4F46E5] bg-indigo-500/10 ring-2 ring-[#4F46E5]/30 cursor-pointer'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-indigo-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80 mb-2">
                          <span className="text-xs font-black text-indigo-500">{t('Sale')} #{sale.saleNumber || (sale.id || sale._id).substring(0, 6)}</span>
                          <div className="flex items-center gap-1.5">
                            {isSettled && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                {t('Settled Lot')}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 font-bold">{sale.date}</span>
                          </div>
                        </div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-white">{sale.productName}</h4>
                        {sale.lotNumber && (
                          <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">{t('Lot')} #{sale.lotNumber}</p>
                        )}
                        
                        <div className="grid grid-cols-3 gap-1 mt-3 text-[11px] bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          <div>
                            <span className="text-slate-400 block font-bold">{t('Sold')}:</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{sale.quantitySold}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-bold">{t('Returned')}:</span>
                            <span className="font-black text-rose-500">{sale.alreadyReturned || 0}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-bold">{t('Can Return')}:</span>
                            <span className={`font-black ${isSettled ? 'text-slate-400' : 'text-emerald-500'}`}>
                              {isSettled ? `0 (${t('Settled')})` : sale.canReturn}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1 text-xs">
                          <span className="text-slate-500 font-bold">{t('Rate')}: Rs. {sale.saleRate}</span>
                          <span className="font-black text-[#4F46E5]">Rs. {sale.totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Sale Detail Summary Banner */}
            {selectedSale && (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">{t('Product')}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white">{selectedSale.productName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">{t('Sold')}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white">{selectedSale.quantitySold}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">{t('Already Returned')}</span>
                  <span className="text-sm font-black text-rose-500">{selectedSale.alreadyReturned || 0}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">{t('Can Return')}</span>
                  <span className="text-sm font-black text-emerald-500">{selectedSale.canReturn}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">{t('Sale Rate')}</span>
                  <span className="text-sm font-black text-[#4F46E5]">Rs. {selectedSale.saleRate}</span>
                </div>
              </div>
            )}

            {/* Step 3: Produce Return Details Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500 text-white">{t('STEP 3')}</span>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white">
                  {t('Produce Return Details')}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Quantity Returned */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>{t('Quantity Now Returned')}</span> *
                    {selectedSale && (
                      <span className="text-[10px] text-slate-400 font-semibold lowercase">
                        {t('Max')}: {maxProduceCanReturn} {t(selectedSale.unit || 'crates')}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={maxProduceCanReturn}
                    placeholder={t('e.g. 5')}
                    value={produceReturnedQty}
                    onChange={(e) => setProduceReturnedQty(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border text-sm font-black text-slate-800 dark:text-white outline-none transition-colors ${
                      isProduceQtyExceeded
                        ? 'border-rose-500 bg-rose-500/5 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:border-[#4F46E5]'
                    }`}
                  />
                  {isProduceQtyExceeded && (
                    <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-1">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>{t('Entered quantity ({{quantity}}) exceeds bought/available quantity ({{available}}).', { quantity: produceQtyNum, available: maxProduceCanReturn })}</span>
                    </p>
                  )}
                  {selectedSale?.businessMode === 'Own Trading' && (
                    <label className="block mt-3 space-y-1.5">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t('Returned Produce Condition')}</span>
                      <select value={produceCondition} onChange={event => setProduceCondition(event.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-white outline-none">
                        <option value="Good">{t('Good')}</option>
                        <option value="Damaged">{t('Damaged')}</option>
                        <option value="Spoiled">{t('Spoiled')}</option>
                      </select>
                      <span className="block text-[10px] text-slate-500">{t('Damaged or spoiled Own Trading returns are recorded as wastage and are not restocked.')}</span>
                    </label>
                  )}
                </div>

                {/* Auto-Calculated Return Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>{t('Total Credit Amount')}</span>
                    {calculatedReversedCommission > 0 && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        - {t('Comm. Reversed')}: Rs. {calculatedReversedCommission}
                      </span>
                    )}
                  </label>
                  <div className="w-full px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-base font-black text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                    <div>
                      <span>Rs. {calculatedReturnAmount.toLocaleString()}</span>
                      {calculatedReversedCommission > 0 && (
                        <span className="text-[10px] block font-medium opacity-75">
                          {t('Gross')}: Rs. {calculatedGrossAmount.toLocaleString()} + {t('Commission')}: Rs. {calculatedReversedCommission.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{t('Rate')}: Rs. {returnRate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reason & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t('Reason for Return')}
                </label>
                <input
                  type="text"
                  placeholder={t('e.g. Quality issue, customer surplus, size mismatch...')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-[#4F46E5]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t('Notes / Remarks')}
                </label>
                <input
                  type="text"
                  placeholder={t('Optional remarks...')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-[#4F46E5]"
                />
              </div>
            </div>

            {/* Quantity Exceeded Alert Box */}
            {isProduceQtyExceeded && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-start space-x-3 shadow-sm">
                <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider">{t('Return Quantity Exceeds Bought / Sold Crates')}</h5>
                  <p className="text-xs font-semibold mt-0.5">
                    {t('You entered {{quantity}} {{unit}}, but the customer only has {{available}} {{unit}} available from this invoice. Please decrease the return quantity to proceed.', { quantity: produceQtyNum, unit: t(selectedSale?.unit || 'crates'), available: maxProduceCanReturn })}
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Large Action Buttons */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setSelectedSale(null);
                  setCustomerSearchTerm('');
                  setProduceReturnedQty('');
                  setProduceCondition('Good');
                  setReason('');
                  setNotes('');
                }}
                className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                {t('Cancel / Reset')}
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  disabled={loading || isProduceQtyExceeded}
                  onClick={() => handleSubmitReturn('Draft')}
                  className="px-5 py-3 rounded-xl bg-slate-800 text-white font-bold text-xs uppercase tracking-wider hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  {t('Save Draft')}
                </button>

                <button
                  type="button"
                  disabled={loading || isProduceQtyExceeded}
                  onClick={() => handleSubmitReturn('Waiting Approval')}
                  className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center space-x-2 ${
                    isProduceQtyExceeded
                      ? 'bg-slate-400 dark:bg-slate-700 text-slate-200 cursor-not-allowed shadow-none'
                      : 'bg-[#4F46E5] hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
                  }`}
                >
                  {loading ? (
                    <SpokeSpinner />
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>{t('Submit for Approval')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: RETURN HISTORY SCREEN
          ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          
          {/* Filter Bar */}
          <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            
            {/* Search Box */}
            <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Search size={16} className="text-slate-400 mr-2" />
              <input
                type="text"
                placeholder={t('Search return no, customer, product...')}
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="bg-transparent border-0 outline-none w-full font-semibold text-slate-800 dark:text-white"
              />
            </div>

            {/* Time Filter */}
            <div>
              <select
                value={historyTimeFilter}
                onChange={(e) => setHistoryTimeFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold outline-none text-slate-800 dark:text-white"
              >
                <option value="all">{t('All Dates')}</option>
                <option value="today">{t('Today')}</option>
                <option value="week">{t('This Week')}</option>
                <option value="month">{t('This Month')}</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold outline-none text-slate-800 dark:text-white"
              >
                <option value="all">{t('All Statuses')}</option>
                <option value="Waiting Approval">{t('Waiting Approval')}</option>
                <option value="Approved">{t('Approved')}</option>
                <option value="Rejected">{t('Rejected')}</option>
                <option value="Draft">{t('Draft')}</option>
              </select>
            </div>

            {/* Customer Filter */}
            <div>
              <select
                value={historyCustomerFilter}
                onChange={(e) => setHistoryCustomerFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold outline-none text-slate-800 dark:text-white"
              >
                <option value="all">{t('All Customers')}</option>
                {customers.map(c => (
                  <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">{t('Return No.')}</th>
                    <th className="py-3.5 px-4">{t('Date')}</th>
                    <th className="py-3.5 px-4">{t('Customer')}</th>
                    <th className="py-3.5 px-4">{t('Product / Details')}</th>
                    <th className="py-3.5 px-4 text-right">{t('Qty Returned')}</th>
                    <th className="py-3.5 px-4 text-right">{t('Sale Rate')}</th>
                    <th className="py-3.5 px-4 text-right">{t('Credit Amount')}</th>
                    <th className="py-3.5 px-4 text-center">{t('Status')}</th>
                    <th className="py-3.5 px-4 text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredHistory.map((ret) => {
                    const isApproved = ret.status === 'Approved';
                    const isWaiting = ret.status === 'Waiting Approval';
                    const isRejected = ret.status === 'Rejected';
                    const isDraft = ret.status === 'Draft';

                    return (
                      <tr key={ret.id || ret._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-black text-indigo-500 font-mono">
                          {ret.returnNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-semibold">
                          {ret.date}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">
                          {ret.customerName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{ret.productName || t('Produce Lot')}</span>
                            {ret.reason && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">{ret.reason}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-800 dark:text-white">
                          {ret.produceReturnedQty} {t(ret.unit || 'Crates')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-600 dark:text-slate-400">
                          Rs. {ret.saleRate || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-[#4F46E5] dark:text-indigo-400">
                          Rs. {(ret.returnAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center space-x-1 ${
                            isApproved ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                            isWaiting ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            isRejected ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                            'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}>
                            {isApproved && <CheckCircle2 size={10} />}
                            {isWaiting && <Clock size={10} />}
                            {isRejected && <Ban size={10} />}
                            <span>{t(ret.status)}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            
                            {/* View / Print Receipt Button */}
                            <button
                              onClick={() => setReceiptModal(ret)}
                              title={t('Print Receipt')}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                            >
                              <Printer size={13} />
                            </button>

                            {/* Approve Button (For Waiting Approval or Draft) */}
                            {isWaiting && (
                              <button
                                onClick={() => handleApprove(ret)}
                                title={t('Approve Return')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center space-x-1"
                              >
                                <Check size={12} />
                                <span>{t('Approve')}</span>
                              </button>
                            )}

                            {/* Reject Button (For Waiting Approval) */}
                            {isWaiting && (
                              <button
                                onClick={() => handleOpenReject(ret)}
                                title={t('Reject Return')}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center space-x-1"
                              >
                                <X size={12} />
                                <span>{t('Reject')}</span>
                              </button>
                            )}

                            {/* Delete Button (For Draft / Rejected) */}
                            {(isDraft || isRejected) && (
                              <button
                                onClick={() => handleDeleteReturn(ret)}
                                title={t('Delete Record')}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400 font-semibold">
                        {t('No return records found matching the chosen filters.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SIMPLE RECEIPT (Printable & Shareable)
          ========================================================================= */}
      {receiptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 w-full max-w-md max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
            
            {/* Action Bar (Top) */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center space-x-2">
                <Printer size={18} />
                <span className="text-xs font-black uppercase tracking-wider">{t('Return Receipt')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrintReceipt}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center space-x-1.5"
                >
                  <Printer size={13} />
                  <span>{t('Print Receipt')}</span>
                </button>
                <button
                  onClick={() => setReceiptModal(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Receipt Printable Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs bg-white text-slate-900" id="printable-receipt">
              
              {/* Header */}
              <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-4">
                <h2 className="text-lg font-black uppercase tracking-wide">
                  {formatBusinessDisplayName(businessProfile, 'MANDI OS BROKERAGE')}
                </h2>
                <p className="text-[11px] text-slate-500 font-semibold">
                  {businessProfile?.address || 'Sabzi & Fruit Mandi'} {businessProfile?.phone ? `• Ph: ${businessProfile.phone}` : ''}
                </p>
                <div className="inline-block px-3 py-1 mt-2 rounded-full bg-slate-100 text-slate-800 font-black text-xs uppercase">
                  {t('Produce Return Voucher')}
                </div>
              </div>

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-100 pb-3">
                <div>
                  <span className="text-slate-400 block font-bold">{t('Return Number')}:</span>
                  <span className="font-black text-slate-800">{receiptModal.returnNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-bold">{t('Date')}:</span>
                  <span className="font-black text-slate-800">{receiptModal.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">{t('Customer')}:</span>
                  <span className="font-black text-slate-800">{receiptModal.customerName}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-bold">{t('Status')}:</span>
                  <span className="font-black text-emerald-600 uppercase">{t(receiptModal.status)}</span>
                </div>
              </div>

              {/* Return Item Details */}
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">{t('Produce Return Item')}</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">{receiptModal.productName || 'Produce Lot'}</span>
                    <span className="font-black text-slate-900">{receiptModal.produceReturnedQty} {receiptModal.unit || 'Crates'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500">
                    <span>{t('Sale Rate')}: <b className="text-slate-800">Rs. {receiptModal.saleRate}</b></span>
                    {receiptModal.commissionReversedAmount > 0 && (
                      <span>{t('Comm. Reversed')}: <b className="text-emerald-600">Rs. {receiptModal.commissionReversedAmount}</b></span>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs font-black">
                    <span>{t('Produce Credit Amount')}:</span>
                    <span className="text-indigo-600">Rs. {(receiptModal.returnAmount || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Reason */}
                {receiptModal.reason && (
                  <div className="text-[11px] text-slate-600 pt-1">
                    <span className="font-bold">{t('Reason')}: </span>
                    <span>{receiptModal.reason}</span>
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="pt-8 border-t border-dashed border-slate-300 grid grid-cols-2 gap-4 text-center text-[11px]">
                <div>
                  <div className="border-b border-slate-400 w-32 mx-auto mb-1"></div>
                  <span className="font-bold text-slate-500 block">{t('Received By')}</span>
                  <span className="text-[10px] text-slate-400">{receiptModal.recordedByName || 'Clerk'}</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-32 mx-auto mb-1"></div>
                  <span className="font-bold text-slate-500 block">{t('Approved By')}</span>
                  <span className="text-[10px] text-slate-400">{receiptModal.approvedByName || 'Admin'}</span>
                </div>
              </div>

              <p className="text-[10px] text-center text-slate-400 pt-2 font-medium">
                {t('Thank you for your business.')}
              </p>
            </div>

            {/* Bottom Close Button */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end print:hidden">
              <button
                onClick={() => setReceiptModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase"
              >
                {t('Close')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: REJECT REASON PROMPT
          ========================================================================= */}
      {rejectPromptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center space-x-3 text-rose-500">
              <Ban size={22} />
              <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-white">
                {t('Reject Return')} #{rejectPromptModal.returnNumber}
              </h3>
            </div>

            <DialogAlert alert={rejectModalAlert} onDismiss={() => setRejectModalAlert(null)} />

            <p className="text-xs text-slate-500">
              {t('Please enter the reason for rejecting this return voucher:')}
            </p>

            <textarea
              rows="3"
              placeholder={t('e.g. Sale mismatch, unauthorized return, or duplicate...')}
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-white outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setRejectPromptModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmReject}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase shadow-md flex items-center space-x-1.5"
              >
                {loading ? <SpokeSpinner /> : <span>                {t('Confirm Rejection')}</span>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
