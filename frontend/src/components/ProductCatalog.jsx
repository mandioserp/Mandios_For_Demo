import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import DialogAlert from './common/DialogAlert.jsx';
import {
  Plus, Pencil, Trash2, Search, ShoppingBag,
  X, RefreshCw, Grid, List, ChevronLeft, ChevronRight, Tag
} from 'lucide-react';
import SpokeSpinner from './common/SpokeSpinner.jsx';

export default function ProductCatalog({
  products: propProducts = null,
  unitsList: propUnitsList = null,
  onRefresh = null,
  showToast = null
}) {
  const { t } = useLanguage();
  const confirm = useConfirm();

  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [localToast, setLocalToast] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All'); // 'All', 'in_stock', 'low_stock', 'out_of_stock'
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Active', 'Inactive'
  const [sortBy, setSortBy] = useState('name_asc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modal State
  const [modalMode, setModalMode] = useState(null); // null, 'add', 'edit'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalAlert, setModalAlert] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Fruits',
    unit: 'Crate',
    status: 'Active',
    currentQuantity: 0,
    purchaseRate: 0,
    saleRate: 0,
    defaultCommission: 5,
    commissionType: 'Percentage'
  });
  const [submitting, setSubmitting] = useState(false);
useEffect(() => {
api.get('/products').then(res => {
  console.log(res.data || []);
})
}, []);
  
  const notify = useCallback((message, type = 'success') => {
    if (showToast) {
      showToast(message, type);
    } else {
      setLocalToast({ message, type });
      setTimeout(() => setLocalToast(null), 4000);
    }
  }, [showToast]);

  // Fetch products & units
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, unitRes] = await Promise.all([
        api.get('/products').catch(() => ({ data: [] })),
        api.get('/settings/units').catch(() => ({ data: [] }))
      ]);

      const extractArray = (data) =>
        Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data?.data)
          ? data.data
          : [];

      const fetchedProducts = extractArray(prodRes.data);
      const fetchedUnits = extractArray(unitRes.data);

      setProducts(fetchedProducts);
      setUnits(fetchedUnits);
    } catch (err) {
      console.error('Failed to fetch product catalog data', err);
      notify(t('Failed to load products from server.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, t]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (propProducts && Array.isArray(propProducts)) {
        setProducts(propProducts);
      } else {
        fetchData();
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchData, propProducts]);

  useEffect(() => {
    if (propUnitsList && Array.isArray(propUnitsList)) {
      const timeout = setTimeout(() => setUnits(propUnitsList), 0);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [propUnitsList]);

  // Distinct Categories
  const categories = useMemo(() => {
    const set = new Set(['Fruits', 'Vegetables']);
    products.forEach((p) => {
      if (p.category && typeof p.category === 'string') {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [products]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.status === 'Active').length;
    const lowStock = products.filter(
      (p) => (Number(p.currentQuantity) || 0) <= 20 && (Number(p.currentQuantity) || 0) > 0
    ).length;
    const outOfStock = products.filter((p) => (Number(p.currentQuantity) || 0) <= 0).length;
    const fruits = products.filter((p) => p.category === 'Fruits').length;
    const vegetables = products.filter((p) => p.category === 'Vegetables').length;

    return { total, active, lowStock, outOfStock, fruits, vegetables };
  }, [products]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(term)) ||
          (p.category && p.category.toLowerCase().includes(term)) ||
          (p.unit && p.unit.toLowerCase().includes(term))
      );
    }

    // Category Filter
    if (categoryFilter !== 'All') {
      result = result.filter((p) => p.category === categoryFilter);
    }

    // Stock Filter
    if (stockFilter === 'in_stock') {
      result = result.filter((p) => (Number(p.currentQuantity) || 0) > 20);
    } else if (stockFilter === 'low_stock') {
      result = result.filter(
        (p) => (Number(p.currentQuantity) || 0) <= 20 && (Number(p.currentQuantity) || 0) > 0
      );
    } else if (stockFilter === 'out_of_stock') {
      result = result.filter((p) => (Number(p.currentQuantity) || 0) <= 0);
    }

    // Status Filter
    if (statusFilter !== 'All') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'qty_desc') return (Number(b.currentQuantity) || 0) - (Number(a.currentQuantity) || 0);
      if (sortBy === 'qty_asc') return (Number(a.currentQuantity) || 0) - (Number(b.currentQuantity) || 0);
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      return 0;
    });

    return result;
  }, [products, searchTerm, categoryFilter, stockFilter, statusFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  useEffect(() => {
    const timeout = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(timeout);
  }, [searchTerm, categoryFilter, stockFilter, statusFilter, sortBy]);

  // Modal Handlers
  const handleOpenAdd = () => {
    setFormData({
      name: '',
      category: 'Fruits',
      unit: units.find((u) => u.status === 'Active')?.name || 'Crate',
      status: 'Active',
      currentQuantity: 0,
      purchaseRate: 0,
      saleRate: 0,
      defaultCommission: 5,
      commissionType: 'Percentage'
    });
    setSelectedProduct(null);
    setModalMode('add');
  };

  const handleOpenEdit = (product) => {
    setSelectedProduct(product);
    setModalAlert(null);
    setFormData({
      name: product.name || '',
      category: product.category || 'Fruits',
      unit: product.unit || 'Crate',
      status: product.status || 'Active',
      currentQuantity: product.currentQuantity || 0,
      purchaseRate: product.purchaseRate || 0,
      saleRate: product.saleRate || 0,
      defaultCommission: product.defaultCommission !== undefined ? product.defaultCommission : 5,
      commissionType: product.commissionType || 'Percentage'
    });
    setModalMode('edit');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setSelectedProduct(null);
    setModalAlert(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!formData.name.trim()) {
      setModalAlert({ type: 'error', message: t('Please enter a product name.') });
      return;
    }

    setSubmitting(true);
    setModalAlert(null);
    try {
      if (modalMode === 'add') {
        const res = await api.post('/products', formData);
        notify(t('Product "{{name}}" added successfully!', { name: formData.name }));
        if (res.data) {
          setProducts((prev) => [res.data, ...prev]);
        }
      } else if (modalMode === 'edit' && selectedProduct) {
        const id = selectedProduct.id || selectedProduct._id;
        const res = await api.put(`/products/${id}`, formData);
        notify(t('Product "{{name}}" updated successfully!', { name: formData.name }));
        if (res.data) {
          setProducts((prev) => prev.map((p) => ((p.id || p._id) === id ? res.data : p)));
        }
      }

      handleCloseModal();
      if (onRefresh) onRefresh();
      else fetchData();
    } catch (err) {
      console.error('Error saving product:', err);
      const errMsg = err.response?.data?.error || t('Failed to save product details.');
      setModalAlert({ type: 'error', message: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product) => {
    const id = product.id || product._id;
    const productName = product.name || t('this product');

    let confirmed;
    if (confirm) {
      confirmed = await confirm({
        title: t('Delete {{name}}?', { name: productName }),
        message: t('Are you sure you want to permanently remove "{{name}}" from the product catalog? Existing historical sales and invoices will maintain their records.', { name: productName }),
        confirmText: t('Delete Product'),
        type: 'danger'
      });
    } else {
      confirmed = window.confirm(t('Are you sure you want to delete {{name}}?', { name: productName }));
    }

    if (!confirmed) return;

    try {
      await api.delete(`/products/${id}`);
      notify(t('Product "{{name}}" removed from catalog.', { name: productName }));
      setProducts((prev) => prev.filter((p) => (p.id || p._id) !== id));
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error deleting product:', err);
      notify(err.response?.data?.error || t('Failed to delete product.'), 'error');
    }
  };

  const activeUnitsList = units.filter((u) => u.status === 'Active');

  return (
    <div className="space-y-6">
      {/* Toast if no global showToast provided */}
      {localToast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-lg transition-all animate-fade-in ${
            localToast.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
              : 'bg-[#4F46E5]/10 border-[#4F46E5]/20 text-[#4F46E5] dark:text-indigo-400'
          }`}
        >
          <span className="text-sm font-bold">{localToast.message}</span>
          <button onClick={() => setLocalToast(null)} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-wide text-slate-900 dark:text-white uppercase">
                {t('Product Inventory Catalog')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('Define fruits & vegetables, standard units (crates, bags, boxes) and live stock availability')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => (onRefresh ? onRefresh() : fetchData())}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title={t('Refresh Catalog')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
          >
            <Plus size={16} />
            <span>{t('ADD NEW PRODUCT')}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Total Produce')}</span>
          <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</h4>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">{t('Active Items')}</span>
          <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</h4>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{t('Low Stock (≤20)')}</span>
          <h4 className="text-xl font-black text-amber-500 mt-1">{stats.lowStock}</h4>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">{t('Out of Stock (0)')}</span>
          <h4 className="text-xl font-black text-rose-500 mt-1">{stats.outOfStock}</h4>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">{t('Fruits')}</span>
          <h4 className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{stats.fruits}</h4>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-500">{t('Vegetables')}</span>
          <h4 className="text-xl font-black text-teal-600 dark:text-teal-400 mt-1">{stats.vegetables}</h4>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 flex-1">
            <Search size={16} className="text-slate-400 mr-2.5 shrink-0" />
            <input
              type="text"
              placeholder={t('Search produce catalog by name, category, unit...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-0 outline-none w-full text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {/* View Toggle & Sort Controls */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-700 rounded-xl p-1 bg-slate-50 dark:bg-[#0F172A]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={t('Grid Cards View')}
              >
                <Grid size={15} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={t('Table View')}
              >
                <List size={15} />
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="name_asc">{t('Name (A → Z)')}</option>
              <option value="name_desc">{t('Name (Z → A)')}</option>
              <option value="qty_desc">{t('Stock (Highest → Lowest)')}</option>
              <option value="qty_asc">{t('Stock (Lowest → Highest)')}</option>
              <option value="category">{t('Group by Category')}</option>
            </select>
          </div>
        </div>

        {/* Category & Stock Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">{t('Category:')}</span>
            <button
              onClick={() => setCategoryFilter('All')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                categoryFilter === 'All'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t('All')} ({products.length})
            </button>
            {categories.map((cat) => {
              const count = products.filter((p) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    categoryFilter === cat
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t(cat)} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">{t('Stock Level:')}</span>
            <button
              onClick={() => setStockFilter('All')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                stockFilter === 'All'
                  ? 'bg-slate-800 text-white dark:bg-slate-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {t('All')}
            </button>
            <button
              onClick={() => setStockFilter('in_stock')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                stockFilter === 'in_stock'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {t('In Stock (>20)')}
            </button>
            <button
              onClick={() => setStockFilter('low_stock')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                stockFilter === 'low_stock'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              {t('Low (≤20)')}
            </button>
            <button
              onClick={() => setStockFilter('out_of_stock')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                stockFilter === 'out_of_stock'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              {t('Out of Stock (0)')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && products.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800">
          <SpokeSpinner size={32} color="#6366F1" />
          <p className="text-xs text-slate-400 font-medium">{t('Loading produce catalog...')}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 p-6">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <ShoppingBag size={24} />
          </div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">{t('No Produce Found')}</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || categoryFilter !== 'All' || stockFilter !== 'All'
              ? t('No products match your current search and filter criteria. Try resetting filters.')
              : t('Your product catalog is currently empty. Get started by adding your first fruit or vegetable item.')}
          </p>
          <div className="pt-2 flex justify-center space-x-3">
            {(searchTerm || categoryFilter !== 'All' || stockFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('All');
                  setStockFilter('All');
                  setStatusFilter('All');
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300"
              >
                {t('Clear Filters')}
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-xs font-bold rounded-xl text-white shadow-md shadow-indigo-500/20 flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>{t('Add First Product')}</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedProducts.map((p) => {
            const qty = Number(p.currentQuantity) || 0;
            const isLowStock = qty <= 20 && qty > 0;
            const isOutOfStock = qty <= 0;
            const isFruit = (p.category || '').toLowerCase() === 'fruits';

            return (
              <div
                key={p.id || p._id}
                className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 space-y-4 transition-all shadow-sm hover:shadow-md relative overflow-hidden flex flex-col justify-between group"
              >
                {/* Visual Category Accent Tag */}
                <div
                  className={`absolute top-0 right-0 left-0 h-1.5 ${
                    isFruit ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  }`}
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Tag size={11} className="mr-0.5" />
                      {t(p.category)}
                    </span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        p.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}
                    >
                      {t(p.status)}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white tracking-wide group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {p.name}
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{t('Available Stock')}</span>
                    <span
                      className={`font-black text-sm ${
                        isOutOfStock
                          ? 'text-rose-500'
                          : isLowStock
                          ? 'text-amber-500'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {qty} <span className="text-xs font-semibold text-slate-400">{t(p.unit)}</span>
                    </span>
                    {isLowStock && (
                      <span className="block text-[9px] font-bold text-amber-500">{t('Near Depletion')}</span>
                    )}
                    {isOutOfStock && (
                      <span className="block text-[9px] font-bold text-rose-500">{t('Out of Stock')}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{t('Standard Unit')}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                      {t(p.unit)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  {/* <span className="text-[10px] text-slate-400 font-medium">
                    {p.defaultCommission ? `Commission: ${p.defaultCommission}%` : `Unit: ${p.unit}`}
                  </span> */}
                  <div className="flex space-x-1.5">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                      title={t('Edit Product')}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors"
                      title={t('Delete Product')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">{t('Produce Name')}</th>
                  <th className="py-3.5 px-4">{t('Category')}</th>
                  <th className="py-3.5 px-4">{t('Standard Unit')}</th>
                  <th className="py-3.5 px-4 text-right">{t('Available Stock')}</th>
                  <th className="py-3.5 px-4 text-center">{t('Status')}</th>
                  <th className="py-3.5 px-4 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedProducts.map((p) => {
                  const qty = Number(p.currentQuantity) || 0;
                  const isLowStock = qty <= 20 && qty > 0;
                  const isOutOfStock = qty <= 0;

                  return (
                    <tr key={p.id || p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                          {t(p.category)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                        {t(p.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-black ${
                            isOutOfStock
                              ? 'text-rose-500'
                              : isLowStock
                              ? 'text-amber-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {qty} {t(p.unit)}
                        </span>
                        {isLowStock && (
                          <span className="block text-[9px] font-bold text-amber-500">{t('Low Stock')}</span>
                        )}
                        {isOutOfStock && (
                          <span className="block text-[9px] font-bold text-rose-500">{t('Out of Stock')}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                            p.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          {t(p.status)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                            title={t('Edit Product')}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                            title={t('Delete Product')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {filteredProducts.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {t('Showing')} <strong className="text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</strong> {t('to')}{' '}
            <strong className="text-slate-900 dark:text-white">
              {Math.min(currentPage * itemsPerPage, filteredProducts.length)}
            </strong>{' '}
            {t('of')} <strong className="text-slate-900 dark:text-white">{filteredProducts.length}</strong> {t('produce items')}
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-bold text-slate-900 dark:text-white px-2">
              {t('Page')} {currentPage} {t('of')} {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ADD / EDIT PRODUCT MODAL */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl relative animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    {modalMode === 'add' ? t('Add New Produce Item') : t('Edit Product Details')}
                  </h3>
                  <p className="text-[11px] text-slate-400">{t('Specify produce name, commodity category and packaging unit')}</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <DialogAlert alert={modalAlert} onDismiss={() => setModalAlert(null)} />

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Product Name */}
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">
                  {t('Product / Produce Name')} <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleFormChange}
                  placeholder={t('e.g. Apple Kala Kulu (سیب کالا کولو) or Potato Lady Rosetta')}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none text-slate-900 dark:text-white focus:border-[#4F46E5]"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">
                    {t('Category')} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    name="category"
                    value={formData.category || 'Fruits'}
                    onChange={handleFormChange}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Fruits">{t('Fruits (پھل)')}</option>
                    <option value="Vegetables">{t('Vegetables (سبزیاں)')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">
                    {t('Standard Packaging Unit')} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    name="unit"
                    value={formData.unit || ''}
                    onChange={handleFormChange}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">{t('Select Unit')}</option>
                    {activeUnitsList.length > 0 ? (
                      activeUnitsList.map((u) => (
                        <option key={u.id || u._id} value={u.name}>
                          {u.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Crate">{t('Crate (کریٹ)')}</option>
                        <option value="Box">{t('Box (پیٹی / ڈبہ)')}</option>
                        <option value="Bag">{t('Bag (بوری / تھیلا)')}</option>
                        <option value="Kg">{t('Kg (کلو گرام)')}</option>
                        <option value="Maund">{t('Maund (من)')}</option>
                        <option value="Bunch">{t('Bunch (لُونگر)')}</option>
                        <option value="Carton">{t('Carton (کارٹن)')}</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">
                  {t('Catalog Status')}
                </label>
                <select
                  name="status"
                  value={formData.status || 'Active'}
                  onChange={handleFormChange}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none text-slate-900 dark:text-white font-medium"
                >
                  <option value="Active">{t('Active (فعال - دستیاب)')}</option>
                  <option value="Inactive">{t('Inactive (غیر فعال)')}</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2 shadow-md shadow-indigo-500/20 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <SpokeSpinner size={16} color="#FFFFFF" />
                      <span>{t('Saving...')}</span>
                    </>
                  ) : (
                    <span>{modalMode === 'add' ? t('Save Product') : t('Update Product')}</span>
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
