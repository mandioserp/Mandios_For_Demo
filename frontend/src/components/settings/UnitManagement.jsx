import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { Plus, Pencil, Trash, Search } from 'lucide-react';
import SpokeSpinner from '../common/SpokeSpinner.jsx';

export default function UnitManagement({ showToast }) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    conversionFactor: '1',
    isDecimalSupported: false
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
        const res = await api.get('/settings/units');
        if (!isMounted) return;
        if (Array.isArray(res.data)) {
          setUnits(res.data);
        } else if (Array.isArray(res.data?.data)) {
          setUnits(res.data.data);
        } else {
          setUnits([]);
        }
      } catch (err) {
        if (!isMounted) return;
        if (err.response?.status !== 401 && err.response?.status !== 403) {
          showToast?.('Failed to load trading units', 'error');
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

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/units');
      if (Array.isArray(res.data)) {
        setUnits(res.data);
      } else if (Array.isArray(res.data?.data)) {
        setUnits(res.data.data);
      } else {
        setUnits([]);
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        showToast?.('Failed to load trading units', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormMode('add');
    setFormData({
      name: '',
      symbol: '',
      description: '',
      conversionFactor: '1',
      isDecimalSupported: false
    });
    setIsModalOpen(true);
  };

  const openEditModal = (unit) => {
    setFormMode('edit');
    setSelectedId(unit.id || unit._id);
    setFormData({
      name: unit.name || '',
      symbol: unit.symbol || '',
      description: unit.description || '',
      conversionFactor: String(unit.conversionFactor || 1),
      isDecimalSupported: !!unit.isDecimalSupported
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    const confirmed = await confirm({
      title: `Delete Unit?`,
      message: `Are you sure you want to delete unit "${name}"? This action cannot be undone.`,
      confirmText: 'Delete Unit',
      type: 'danger'
    });
    if (!confirmed) {
      return;
    }
    try {
      await api.delete(`/settings/units/${id}`);
      showToast('Unit deleted successfully');
      fetchUnits();
    } catch (err) {
      showToast('Failed to delete unit', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!formData.name) {
      showToast('Unit Name is required', 'error');
      return;
    }

    const payload = {
      ...formData,
      conversionFactor: Number(formData.conversionFactor) || 1
    };

    setSubmitting(true);
    try {
      if (formMode === 'add') {
        await api.post('/settings/units', payload);
        showToast('Unit created successfully');
      } else {
        await api.put(`/settings/units/${selectedId}`, payload);
        showToast('Unit updated successfully');
      }
      setIsModalOpen(false);
      fetchUnits();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save unit settings', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUnits = units.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.symbol && u.symbol.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredUnits.length / itemsPerPage);
  const paginatedUnits = filteredUnits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('Unit Management')}</h3>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Multi-Tenant Isolated
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Manage trading units, abbreviations, and basic scale settings configured specifically for your business.')}</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shrink-0"
        >
          <Plus size={16} />
          <span>{t('ADD NEW UNIT')}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800">
        <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
          <Search size={16} className="text-slate-500 dark:text-slate-400 mr-2" />
          <input
            type="text"
            placeholder={t('Search units by name or abbreviation...')}
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
                <th className="py-3 px-5">{t('Unit Name')}</th>
                <th className="py-3 px-5">{t('Abbr / Symbol')}</th>
                <th className="py-3 px-5">{t('Description')}</th>
                <th className="py-3 px-5">{t('Multiplier (Conversion)')}</th>
                <th className="py-3 px-5">{t('Decimal Weight Support')}</th>
                <th className="py-3 px-5 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {paginatedUnits.length > 0 ? (
                paginatedUnits.map(unit => (
                  <tr key={unit.id || unit._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                    <td className="py-3.5 px-5 font-bold">{unit.name}</td>
                    <td className="py-3.5 px-5 font-mono text-indigo-500 font-bold">{unit.symbol || 'N/A'}</td>
                    <td className="py-3.5 px-5 text-slate-500">{unit.description || 'No description'}</td>
                    <td className="py-3.5 px-5 font-bold text-slate-600 dark:text-slate-300">{unit.conversionFactor || 1}</td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${unit.isDecimalSupported ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-100 text-slate-400'}`}>
                        {unit.isDecimalSupported ? 'Decimal Supported' : 'Whole Units Only'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button title={t('Edit')} onClick={() => openEditModal(unit)} className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#0F172A] hover:bg-slate-200 text-slate-700 dark:text-slate-300">
                          <Pencil size={12} />
                        </button>
                        <button title={t('Delete')} onClick={() => handleDelete(unit.id || unit._id, unit.name)} className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400">
                          <Trash size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-400">{t('No trading units registered.')}</td>
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
              <h4 className="text-sm font-black uppercase tracking-wider">{t(formMode === 'add' ? 'Add New Packaging Unit' : 'Edit Packaging Unit')}</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{t('Define custom packages for agricultural stock arrival and sale.')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Unit Name */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Unit Name')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('e.g. Crate, Sack, Box, Mann')}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none focus:border-[#4F46E5]"
                  required
                />
              </div>

              {/* Symbol & Conversion Factor */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Symbol / Abbr')}</label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={e => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                    placeholder={t('e.g. crt, sk, bx')}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Conversion Factor')}</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.conversionFactor}
                    onChange={e => setFormData(prev => ({ ...prev, conversionFactor: e.target.value }))}
                    placeholder={t('e.g. 1')}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Description')}</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('Additional context on trading, standard sizing...')}
                  rows="2"
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none resize-none"
                />
              </div>

              {/* Decimal Supported */}
              <div className="flex items-center space-x-2.5 py-1">
                <input
                  type="checkbox"
                  id="isDecimalSupported"
                  checked={formData.isDecimalSupported}
                  onChange={e => setFormData(prev => ({ ...prev, isDecimalSupported: e.target.checked }))}
                  className="w-4 h-4 text-[#4F46E5] border-slate-300 rounded focus:ring-[#4F46E5]"
                />
                <label htmlFor="isDecimalSupported" className="font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                  Supports Fractional Weights / Quantities
                </label>
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
                    <span>{formMode === 'add' ? 'ADD UNIT' : 'SAVE CHANGES'}</span>
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
