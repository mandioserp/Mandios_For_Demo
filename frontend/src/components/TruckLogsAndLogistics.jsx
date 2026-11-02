import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import DialogAlert from './common/DialogAlert.jsx';
import { downloadTruckParchiPDF } from '../utils/pdfExport.js';
import {
  Truck, Clock, CheckSquare, Plus, Pencil, Trash, X, Search, RefreshCw, Download
} from 'lucide-react';
import SpokeSpinner from './common/SpokeSpinner.jsx';

export default function TruckLogsAndLogistics({ suppliers: propSuppliers = [], showToast, className = '' }) {
  const confirm = useConfirm();
  const { t } = useLanguage();
  const [trucks, setTrucks] = useState([]);
  const [suppliers, setSuppliers] = useState(propSuppliers);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [truckFilter, setTruckFilter] = useState('All'); // 'All', 'Arrived', 'Waiting', 'Completed', 'Dispatched'
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalAlert, setModalAlert] = useState(null);
  const [formData, setFormData] = useState({
    truckNumber: '',
    vehicleType: 'Truck',
    driverName: '',
    driverPhone: '',
    beoparis: [{ supplierId: '', products: [{ productId: '', productName: '', quantity: '', unit: 'Crates', description: '' }] }],
    status: 'Arrived',
    arrivalDate: new Date().toISOString().split('T')[0],
    description: ''
  });

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await api.get('/suppliers');
      const data = Array.isArray(res.data) ? res.data : (res.data?.suppliers || []);
      setSuppliers(data);
    } catch (err) {
      console.warn('Suppliers list fallback for truck logs:', err?.response?.data?.error || err.message);
      setSuppliers([]);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products');
      setProducts(Array.isArray(res.data) ? res.data : (res.data?.products || []));
    } catch (err) {
      console.warn('Product list fallback for truck logs:', err?.response?.data?.error || err.message);
      setProducts([]);
    }
  }, []);

  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/trucks');
      const data = Array.isArray(res.data) ? res.data : (res.data?.trucks || []);
      setTrucks(data);
    } catch (err) {
      console.warn('Truck logs fallback:', err?.response?.data?.error || err.message);
      setTrucks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (propSuppliers?.length) return undefined;
    const timeout = setTimeout(() => {
      fetchSuppliers();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchSuppliers, propSuppliers]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchTrucks();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchTrucks]);

  useEffect(() => {
    const timeout = setTimeout(fetchProducts, 0);
    return () => clearTimeout(timeout);
  }, [fetchProducts]);

  const visibleSuppliers = propSuppliers?.length ? propSuppliers : suppliers;

  const notify = (msg, type = 'success') => {
    if (showToast) showToast(msg, type);
  };

  // Quick update for status directly from dropdown
  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await api.put(`/trucks/${id}`, { status: newStatus });
      notify(t('Vehicle status updated to {{status}}', { status: t(newStatus) }));
      fetchTrucks();
    } catch (err) {
      notify(err.response?.data?.error || t('Failed to update vehicle status'), 'error');
    }
  };

  const openModal = (mode, truck = null) => {
    setModalMode(mode);
    setSelectedTruck(truck);
    setModalAlert(null);
    if (mode === 'edit' && truck) {
      const oldBeoparis = Array.isArray(truck.beoparis) && truck.beoparis.length
        ? truck.beoparis
        : (truck.supplierId || truck.supplierName || truck.description || truck.notes ? [{
            supplierId: truck.supplierId || '', supplierName: truck.supplierName || '', products: [{
              productId: '', productName: truck.description || truck.notes || 'Cargo', quantity: truck.quantityLoaded || '', unit: truck.unit || 'Crates', description: ''
            }]
          }] : [{ supplierId: '', products: [{ productId: '', productName: '', quantity: '', unit: 'Crates', description: '' }] }]);
      setFormData({
        truckNumber: truck.truckNumber || '',
        vehicleType: truck.vehicleType || 'Truck',
        driverName: truck.driverName || '',
        driverPhone: truck.driverPhone || '',
        beoparis: oldBeoparis,
        status: truck.status || 'Arrived',
        arrivalDate: truck.arrivalDate || new Date().toISOString().split('T')[0],
        description: truck.description || truck.notes || ''
      });
    } else {
      setFormData({
        truckNumber: '',
        vehicleType: 'Truck',
        driverName: '',
        driverPhone: '',
        beoparis: [{ supplierId: '', products: [{ productId: '', productName: '', quantity: '', unit: 'Crates', description: '' }] }],
        status: 'Arrived',
        arrivalDate: new Date().toISOString().split('T')[0],
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTruck(null);
    setModalAlert(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const updateBeopari = (index, key, value) => setFormData(prev => ({ ...prev, beoparis: prev.beoparis.map((entry, i) => i === index ? { ...entry, [key]: value } : entry) }));
  const addBeopari = () => setFormData(prev => ({ ...prev, beoparis: [...prev.beoparis, { supplierId: '', products: [{ productId: '', productName: '', quantity: '', unit: 'Crates', description: '' }] }] }));
  const removeBeopari = (index) => setFormData(prev => ({ ...prev, beoparis: prev.beoparis.filter((_, i) => i !== index) }));
  const addProduct = (beopariIndex) => updateBeopari(beopariIndex, 'products', [...formData.beoparis[beopariIndex].products, { productId: '', productName: '', quantity: '', unit: 'Crates', description: '' }]);
  const updateProduct = (beopariIndex, productIndex, key, value) => updateBeopari(beopariIndex, 'products', formData.beoparis[beopariIndex].products.map((row, i) => i === productIndex ? { ...row, [key]: value } : row));
  const removeProduct = (beopariIndex, productIndex) => updateBeopari(beopariIndex, 'products', formData.beoparis[beopariIndex].products.filter((_, i) => i !== productIndex));

  const handleProductSelect = (beopariIndex, productIndex, productId) => {
    const selected = products.find(product => String(product.id || product._id) === productId);
    updateBeopari(beopariIndex, 'products', formData.beoparis[beopariIndex].products.map((row, i) => i === productIndex ? {
      ...row, productId, productName: selected?.name || '', unit: selected?.unit || row.unit || 'Crates'
    } : row));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setModalAlert(null);
    try {
      if (!formData.beoparis.length) throw new Error(t('Add at least one beopari.'));
      if (formData.beoparis.some(entry => !entry.supplierId)) throw new Error(t('Select a beopari for every section.'));
      if (new Set(formData.beoparis.map(entry => entry.supplierId)).size !== formData.beoparis.length) throw new Error(t('Each beopari should appear once; add products to that section.'));
      if (formData.beoparis.some(entry => !entry.products.length || entry.products.some(row => !row.productName.trim() || !row.unit.trim() || String(row.quantity).trim() === '' || !Number.isFinite(Number(row.quantity)) || Number(row.quantity) < 0))) throw new Error(t('Each product needs a name, quantity of zero or more, and unit.'));
      const payload = {
        ...formData,
        beoparis: formData.beoparis.map(entry => ({ ...entry, supplierName: suppliers.find(s => String(s.id || s._id) === entry.supplierId)?.name || entry.supplierName || '', products: entry.products.map(row => ({ ...row, quantity: Number(row.quantity) })) })),
        arrivalDate: formData.arrivalDate || new Date().toISOString().split('T')[0]
      };

      if (modalMode === 'add') {
        await api.post('/trucks', payload);
        notify(t('Gate vehicle arrival logged successfully!'));
      } else if (selectedTruck) {
        const id = selectedTruck.id || selectedTruck._id;
        await api.put(`/trucks/${id}`, payload);
        notify(t('Vehicle log updated successfully!'));
      }
      closeModal();
      fetchTrucks();
    } catch (err) {
      const errMsg = err.response?.data?.error || t('Failed to save vehicle entry');
      setModalAlert({ type: 'error', message: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, truckNumber) => {
    const confirmed = await confirm({
      title: t('Delete Vehicle Log?'),
      message: t('Are you sure you want to delete vehicle entry "{{truckNumber}}"? This action cannot be undone.', { truckNumber }),
      confirmText: t('Delete Entry'),
      type: 'danger'
    });
    if (!confirmed) {
      return;
    }
    try {
      await api.delete(`/trucks/${id}`);
      notify(t('Vehicle log deleted successfully.'));
      fetchTrucks();
    } catch (err) {
      notify(err.response?.data?.error || t('Failed to delete vehicle record'), 'error');
    }
  };

  // Metrics computation
  const todayStr = new Date().toISOString().split('T')[0];
  const arrivedToday = trucks.filter(t => t.arrivalDate === todayStr || t.status === 'Arrived').length;
  const waitingCount = trucks.filter(t => t.status === 'Waiting').length;
  const completedCount = trucks.filter(t => t.status === 'Completed').length;
  const dispatchedCount = trucks.filter(t => t.status === 'Dispatched').length;

  // Filter & Search trucks list
  const filteredTrucks = trucks.filter(t => {
    const matchesFilter = truckFilter === 'All' || t.status === truckFilter;
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = !searchLower ||
      (t.truckNumber && t.truckNumber.toLowerCase().includes(searchLower)) ||
      (t.driverName && t.driverName.toLowerCase().includes(searchLower)) ||
      ((t.beoparis || []).some(entry => (entry.supplierName || '').toLowerCase().includes(searchLower) || entry.products?.some(row => (row.productName || '').toLowerCase().includes(searchLower)))) ||
      (t.supplierName && t.supplierName.toLowerCase().includes(searchLower)) ||
      (t.description && t.description.toLowerCase().includes(searchLower));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className={`space-y-6 animate-fade-in ${className}`}>
      
      {/* Truck Logs Summary Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('Arrived Today')}</span>
            <h3 className="text-2xl font-black mt-1 text-sky-500">{arrivedToday}</h3>
            <span className="text-[10px] opacity-60">{t('Arrived at Mandi gates')}</span>
          </div>
          <div className="p-3 bg-sky-500/10 text-sky-500 rounded-xl">
            <Truck size={20} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('Awaiting Unloading')}</span>
            <h3 className="text-2xl font-black mt-1 text-amber-500">{waitingCount}</h3>
            <span className="text-[10px] opacity-60">{t('Waiting inside Mandi')}</span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Clock size={20} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('Completed Unloads')}</span>
            <h3 className="text-2xl font-black mt-1 text-emerald-500">{completedCount}</h3>
            <span className="text-[10px] opacity-60">{t('All crates recorded')}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <CheckSquare size={20} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('Dispatched Empty')}</span>
            <h3 className="text-2xl font-black mt-1 text-slate-500">{dispatchedCount}</h3>
            <span className="text-[10px] opacity-60">{t('Exited Mandi gates')}</span>
          </div>
          <div className="p-3 bg-slate-500/10 text-slate-500 rounded-xl">
            <Truck size={20} />
          </div>
        </div>
      </div>

      {/* Main Table & Filter Container */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
              <span>{t('Gate Logistics - Active Truck Logs')}</span>
              {loading && <RefreshCw size={14} className="animate-spin text-indigo-500" />}
            </h4>
            <p className="text-xs text-slate-500">{t('Track and log vehicle arrivals, waiting times, and cargo details')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="flex items-center px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <Search size={14} className="text-slate-400 mr-2" />
              <input
                type="text"
                placeholder={t('Search truck, driver...')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 outline-none text-xs text-slate-700 dark:text-slate-200 w-36 sm:w-48 placeholder-slate-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} aria-label={t('Clear search')} className="text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl text-[10px] font-bold uppercase tracking-wider">
              {['All', 'Arrived', 'Waiting', 'Completed', 'Dispatched'].map(st => (
                <button
                  key={st}
                  onClick={() => setTruckFilter(st)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${truckFilter === st ? 'bg-[#4F46E5] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  {t(st)}
                </button>
              ))}
            </div>

            {/* Action Button */}
            <button
              onClick={() => openModal('add')}
              className="flex items-center space-x-2 bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-500/10"
            >
              <Plus size={14} />
              <span>{t('LOG NEW VEHICLE ARRIVAL')}</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/60 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                <th className="py-2.5 px-3">{t('Arrival Date')}</th>
                <th className="py-2.5 px-3">{t('Vehicle')}</th>
                <th className="py-2.5 px-3">{t('Driver Name')}</th>
                <th className="py-2.5 px-3">{t('Beopari and Products')}</th>
                <th className="py-2.5 px-3">{t('Product Rows')}</th>
                <th className="py-2.5 px-3">{t('Current Status')}</th>
                <th className="py-2.5 px-3">{t('Update Status')}</th>
                <th className="py-2.5 px-3 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
              {filteredTrucks.map((truck) => (
                <tr key={truck.id || truck._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium">{truck.arrivalDate}</td>
                  <td className="py-3 px-3 font-bold text-indigo-500 dark:text-indigo-400 uppercase">{truck.vehicleType || 'Truck'}<br />{truck.truckNumber}</td>
                  <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">{truck.driverName || t('N/A')}</td>
                  <td className="py-3 px-3 min-w-[260px]">
                    {(truck.beoparis || []).map((entry, groupIndex) => (
                      <div key={`${entry.supplierId || entry.supplierName}-${groupIndex}`} className="mb-1 last:mb-0">
                        <strong>{entry.supplierName || truck.supplierName || t('N/A')}</strong>
                        <span className="text-slate-500"> — {(entry.products || []).map(row => `${row.productName}: ${row.quantity} ${row.unit}`).join(', ')}</span>
                      </div>
                    ))}
                    {(!truck.beoparis?.length) && <span>{truck.supplierName || t('N/A')} — {truck.description || truck.notes || t('N/A')} ({truck.quantityLoaded || 0} {t('Crates')})</span>}
                  </td>
                  <td className="py-3 px-3 font-semibold text-emerald-600 dark:text-emerald-400">{(truck.beoparis || []).length} {t('beopari')} · {(truck.beoparis || []).reduce((count, entry) => count + (entry.products || []).length, 0)} {t('rows')}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold 
                      ${truck.status === 'Arrived' ? 'bg-sky-500/10 text-sky-400' :
                        truck.status === 'Waiting' ? 'bg-amber-500/10 text-amber-400' :
                        truck.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-slate-500/10 text-slate-400'}`}>
                      {t(truck.status || 'Arrived')}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={truck.status || 'Arrived'}
                      onChange={(e) => handleStatusUpdate(truck.id || truck._id, e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer focus:border-indigo-500 hover:border-indigo-400 transition-colors"
                    >
                      <option value="Arrived">{t('Arrived')}</option>
                      <option value="Waiting">{t('Waiting')}</option>
                      <option value="Completed">{t('Completed')}</option>
                      <option value="Dispatched">{t('Dispatched')}</option>
                    </select>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => downloadTruckParchiPDF({ truck })}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600"
                        title={t('Download Truck Parchi')}
                      >
                        <Download size={12} />
                      </button>
                      <button
                        onClick={() => openModal('edit', truck)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                        title={t('Edit Vehicle Log')}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(truck.id || truck._id, truck.truckNumber)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                        title={t('Delete Vehicle Log')}
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTrucks.length === 0 && (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400 font-semibold">
                    {loading ? t('Loading vehicle logs...') : t('No vehicle logs matching chosen filter.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT GATE LOGISTICS VEHICLE/TRUCK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 p-6 space-y-6 shadow-2xl relative">
            <button
              type="button"
              onClick={closeModal}
              aria-label={t('Close')}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={18} />
            </button>
            
            <div>
              <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                {modalMode === 'add' ? t('Log Gate Vehicle Entry') : t('Update Gate Vehicle Record')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('Track incoming trucks, grower assignments, and crate loads')}
              </p>
            </div>

            <DialogAlert alert={modalAlert} onDismiss={() => setModalAlert(null)} />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider text-[10px]">{t('Vehicle Type')} *</label>
                  <input required list="truck-vehicle-types" name="vehicleType" value={formData.vehicleType} onChange={handleFormChange} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none text-xs text-slate-800 dark:text-slate-100" />
                  <datalist id="truck-vehicle-types">{['Truck', 'Shehzore', 'Mazda', 'Tractor Trolley', 'Other'].map(type => <option key={type} value={type}>{t(type)}</option>)}</datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider text-[10px]">
                    {t('Truck / Vehicle Number')} *
                  </label>
                  <input
                    required
                    type="text"
                    name="truckNumber"
                    value={formData.truckNumber || ''}
                    onChange={handleFormChange}
                    placeholder={t('e.g. MH-12-PQ-9999')}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none text-xs focus:border-[#4F46E5] uppercase text-slate-800 dark:text-slate-100"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider text-[10px]">
                    {t('Driver Name')}
                  </label>
                  <input
                    type="text"
                    name="driverName"
                    value={formData.driverName || ''}
                    onChange={handleFormChange}
                    placeholder={t('e.g. Driver Ramesh')}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none text-xs focus:border-[#4F46E5] text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider text-[10px]">{t('Driver Phone')}</label>
                  <input type="tel" name="driverPhone" value={formData.driverPhone || ''} onChange={handleFormChange} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none text-xs text-slate-800 dark:text-slate-100" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div><h4 className="text-sm font-black text-slate-700 dark:text-slate-200">{t('Beopari and Products')}</h4><p className="text-[11px] text-slate-500">{formData.beoparis.length} {t('beopari')} · {formData.beoparis.reduce((sum, entry) => sum + entry.products.length, 0)} {t('product rows')}</p></div>
                  <button type="button" onClick={addBeopari} className="flex items-center gap-1 rounded-lg bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-600"><Plus size={14} />{t('Add Beopari')}</button>
                </div>
                {formData.beoparis.map((entry, beopariIndex) => (
                  <section key={`beopari-${beopariIndex}`} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="sr-only">{t('Beopari')}</label>
                      <select required value={entry.supplierId} onChange={e => updateBeopari(beopariIndex, 'supplierId', e.target.value)} className="min-w-0 flex-1 bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100">
                        <option value="">{t('-- Choose Beopari --')}</option>
                        {visibleSuppliers.map(s => <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>)}
                      </select>
                      <button type="button" disabled={formData.beoparis.length <= 1} onClick={() => removeBeopari(beopariIndex)} className="p-2 text-red-500 disabled:opacity-30" title={t('Remove Beopari')}><Trash size={15} /></button>
                    </div>
                    {entry.products.map((row, productIndex) => (
                      <div key={`product-${beopariIndex}-${productIndex}`} className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_auto] gap-2 items-end">
                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500">{t('Product')}</label><select value={row.productId || ''} onChange={e => handleProductSelect(beopariIndex, productIndex, e.target.value)} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-800 dark:text-slate-100"><option value="">{t('Custom product')}</option>{products.map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}</select><input required type="text" value={row.productName} onChange={e => updateProduct(beopariIndex, productIndex, 'productName', e.target.value)} placeholder={t('Product name')} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-800 dark:text-slate-100" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500">{t('Quantity')}</label><input required type="number" min="0" step="any" value={row.quantity} onChange={e => updateProduct(beopariIndex, productIndex, 'quantity', e.target.value)} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-800 dark:text-slate-100" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500">{t('Unit')}</label><input required list={`truck-units-${beopariIndex}-${productIndex}`} value={row.unit} onChange={e => updateProduct(beopariIndex, productIndex, 'unit', e.target.value)} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-800 dark:text-slate-100" /><datalist id={`truck-units-${beopariIndex}-${productIndex}`}>{[...new Set(['Bag', 'Crate', 'Peti', 'Kg', 'Maund', 'Ton', ...(products.map(p => p.unit).filter(Boolean))])].map(unit => <option key={unit} value={unit} />)}</datalist></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500">{t('Notes')}</label><input value={row.description || ''} onChange={e => updateProduct(beopariIndex, productIndex, 'description', e.target.value)} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-800 dark:text-slate-100" /></div>
                        <button type="button" disabled={entry.products.length <= 1} onClick={() => removeProduct(beopariIndex, productIndex)} className="p-2 text-red-500 disabled:opacity-30" title={t('Remove Product')}><Trash size={15} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addProduct(beopariIndex)} className="flex items-center gap-1 text-xs font-bold text-indigo-600"><Plus size={13} />{t('Add Product')}</button>
                  </section>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider text-[10px]">
                    {t('Gate Status')} *
                  </label>
                  <select
                    required
                    name="status"
                    value={formData.status || 'Arrived'}
                    onChange={handleFormChange}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none text-xs focus:border-[#4F46E5] text-slate-800 dark:text-slate-100"
                  >
                    <option value="Arrived">{t('Arrived')}</option>
                    <option value="Waiting">{t('Waiting inside')}</option>
                    <option value="Completed">{t('Completed Unloading')}</option>
                    <option value="Dispatched">{t('Dispatched Empty')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider text-[10px]">
                    {t('Arrival Date')} *
                  </label>
                  <input
                    required
                    type="date"
                    name="arrivalDate"
                    value={formData.arrivalDate || ''}
                    onChange={handleFormChange}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none text-xs focus:border-[#4F46E5] text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-500/20 flex items-center space-x-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <SpokeSpinner size={16} color="#FFFFFF" />
                      <span>{t('Saving...')}</span>
                    </>
                  ) : (
                    <span>{t('Save Gate Entry')}</span>
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
