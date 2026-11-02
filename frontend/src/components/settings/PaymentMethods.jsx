import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { Plus, Pencil, Trash, Search } from 'lucide-react';
import SpokeSpinner from '../common/SpokeSpinner.jsx';

export default function PaymentMethods({ showToast }) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    detailsRequired: false,
    status: 'Active'
  });

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings/payment-methods');
        if (!isMounted) return;
        if (Array.isArray(res.data)) {
          setMethods(res.data);
        } else if (Array.isArray(res.data?.data)) {
          setMethods(res.data.data);
        } else {
          setMethods([]);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to load payment methods:', err);
        if (err.response?.status !== 401 && err.response?.status !== 403) {
          showToast?.('Failed to load payment methods', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/payment-methods');
      if (Array.isArray(res.data)) {
        setMethods(res.data);
      } else if (Array.isArray(res.data?.data)) {
        setMethods(res.data.data);
      } else {
        setMethods([]);
      }
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        showToast?.('Failed to load payment methods', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormMode('add');
    setFormData({
      name: '',
      description: '',
      detailsRequired: false,
      status: 'Active'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (method) => {
    setFormMode('edit');
    setSelectedId(method.id || method._id);
    setFormData({
      name: method.name || '',
      description: method.description || '',
      detailsRequired: !!method.detailsRequired,
      status: method.status || 'Active'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    const confirmed = await confirm({
      title: `Delete Payment Method?`,
      message: `Are you sure you want to delete payment method "${name}"?`,
      confirmText: 'Delete Method',
      type: 'danger'
    });
    if (!confirmed) {
      return;
    }
    try {
      await api.delete(`/settings/payment-methods/${id}`);
      showToast?.('Payment method deleted successfully');
      fetchMethods();
    } catch (err) {
      showToast?.('Failed to delete payment method', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!formData.name) {
      showToast?.('Payment Method Name is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (formMode === 'add') {
        await api.post('/settings/payment-methods', formData);
        showToast?.('Payment method created successfully');
      } else {
        await api.put(`/settings/payment-methods/${selectedId}`, formData);
        showToast?.('Payment method updated successfully');
      }
      setIsModalOpen(false);
      fetchMethods();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'Failed to save payment method', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMethods = methods.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMethods.length / itemsPerPage);
  const paginatedMethods = filteredMethods.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('Payment Channels')}</h3>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Multi-Tenant Isolated
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{t('Define valid channels for double-entry cash receipts or payouts specific to your business account.')}</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shrink-0"
        >
          <Plus size={16} />
          <span>{t('ADD PAYMENT METHOD')}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800">
        <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
          <Search size={16} className="text-slate-500 dark:text-slate-400 mr-2" />
          <input
            type="text"
            placeholder={t('Search payment channels...')}
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="bg-transparent border-0 outline-none w-full text-xs placeholder:text-slate-500 text-slate-700 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-[#1E293B]">
                <th className="py-3 px-5">{t('Method Name')}</th>
                <th className="py-3 px-5">{t('Description')}</th>
                <th className="py-3 px-5">{t('Requires Details (Cheque # / TxID)')}</th>
                <th className="py-3 px-5">{t('Status')}</th>
                <th className="py-3 px-5 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {paginatedMethods.length > 0 ? (
                paginatedMethods.map(method => (
                  <tr key={method.id || method._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                    <td className="py-3.5 px-5 font-bold text-indigo-500 dark:text-indigo-400">{method.name}</td>
                    <td className="py-3.5 px-5 text-slate-500">{method.description || 'No description added'}</td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${method.detailsRequired ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
                        {method.detailsRequired ? 'Required (e.g. Bank Acc, Cheque #)' : 'Not Required'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${method.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
                        {method.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button title={t('Edit')} onClick={() => openEditModal(method)} className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#0F172A] hover:bg-slate-200 text-slate-700 dark:text-slate-300">
                          <Pencil size={12} />
                        </button>
                        <button title={t('Delete')} onClick={() => handleDelete(method.id || method._id, method.name)} className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400">
                          <Trash size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-400">{t('No payment methods configured.')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="flex space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up text-slate-800 dark:text-slate-100">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="text-sm font-black uppercase tracking-wider">{t(formMode === 'add' ? 'Add Payment Channel' : 'Edit Payment Channel')}</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold font-mono">{t('Setup bank transfer or mobile banking configurations.')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Method Name */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Method / Channel Name')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('e.g. Bank Alfalah, JazzCash, EasyPaisa, Cash')}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none focus:border-[#4F46E5]"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Instructions / Bank Details')}</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('Include account IBAN or processing notes...')}
                  rows="3"
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none resize-none"
                />
              </div>

              {/* detailsRequired & status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Status')}</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
                  >
                    <option value="Active">{t('Active')}</option>
                    <option value="Inactive">{t('Inactive')}</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="detailsRequired"
                    checked={formData.detailsRequired}
                    onChange={e => setFormData(prev => ({ ...prev, detailsRequired: e.target.checked }))}
                    className="w-4 h-4 text-[#4F46E5] border-slate-300 rounded"
                  />
                  <label htmlFor="detailsRequired" className="font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    Force Acc/TxID Info
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-500"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold flex items-center space-x-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <SpokeSpinner size={16} color="#FFFFFF" />
                      <span>{formMode === 'add' ? 'ADDING...' : 'SAVING...'}</span>
                    </>
                  ) : (
                    <span>{formMode === 'add' ? 'ADD METHOD' : 'SAVE CHANGES'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
