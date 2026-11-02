import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api.js';
import i18n from '../../i18n.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { Pencil, Search, Filter } from 'lucide-react';
import SpokeSpinner from '../common/SpokeSpinner.jsx';

export default function ProductDefaultSettings({ showToast }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [unitsList, setUnitsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    defaultCommission: '',
    commissionType: 'Percentage',
    defaultUnit: 'Crate',
    averageWeight: '',
    minPrice: '',
    maxPrice: '',
    status: 'Active'
  });

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const fetchProductsAndUnits = useCallback(async () => {
    try {
      const [productsRes, unitsRes] = await Promise.all([
        api.get('/products').catch(() => ({ data: [] })),
        api.get('/settings/units').catch(() => ({ data: [] }))
      ]);
      const extractArray = (data) => Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : (Array.isArray(data?.data) ? data.data : []));
      setProducts(extractArray(productsRes.data));
      setUnitsList(extractArray(unitsRes.data));
    } catch {
      showToast(i18n.t('Error loading product catalog and units'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timeoutId = setTimeout(fetchProductsAndUnits, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchProductsAndUnits]);

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      defaultCommission: String(product.defaultCommission || 0),
      commissionType: product.commissionType || 'Percentage',
      defaultUnit: product.defaultUnit || product.unit || 'Crate',
      averageWeight: String(product.averageWeight || 0),
      minPrice: String(product.minPrice || 0),
      maxPrice: String(product.maxPrice || 0),
      status: product.status || 'Active'
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const productId = selectedProduct.id || selectedProduct._id;
    try {
      const payload = {
        ...selectedProduct,
        defaultCommission: Number(formData.defaultCommission) || 0,
        commissionType: formData.commissionType,
        defaultUnit: formData.defaultUnit,
        averageWeight: Number(formData.averageWeight) || 0,
        minPrice: Number(formData.minPrice) || 0,
        maxPrice: Number(formData.maxPrice) || 0,
        status: formData.status
      };
      await api.put(`/products/${productId}`, payload);
      showToast(t('Product default settings updated successfully!'));
      setIsModalOpen(false);
      fetchProductsAndUnits();
    } catch {
      showToast(t('Failed to update product defaults'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Extract unique categories for filter
  const safeProducts = Array.isArray(products) ? products : [];
  const categories = [...new Set(safeProducts.map(p => p.category))];

  // Filters
  const filteredProducts = safeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('Product Default Settings')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('Establish standard parameters (rates, average weights, minimum/maximum values) on a per-product level.')}</p>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800">
        <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 col-span-2">
          <Search size={16} className="text-slate-500 dark:text-slate-400 mr-2" />
          <input
            type="text"
            placeholder={t('Search products by name or category...')}
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="bg-transparent border-0 outline-none w-full text-xs placeholder:text-slate-500 text-slate-700 dark:text-slate-200"
          />
        </div>

        <div className="flex items-center px-3 py-1 bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl">
          <Filter size={14} className="text-slate-500 mr-2" />
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="bg-transparent border-0 outline-none w-full text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="">{t('All Categories')}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {paginatedProducts.length > 0 ? (
          paginatedProducts.map(p => (
            <div key={p.id || p._id} className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 space-y-4 shadow-lg hover:shadow-xl transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 h-1 w-full bg-[#4F46E5]" />
              
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.category}</span>
                  <h4 className="text-sm font-black tracking-wide text-slate-800 dark:text-slate-100">{p.name}</h4>
                </div>
                <button
                  onClick={() => openEditModal(p)}
                  className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-500 dark:text-indigo-400"
                >
                  <Pencil size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block">{t('Default Unit')}</span>
                  <span className="font-semibold">{p.defaultUnit || p.unit || t('N/A')}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block">{t('Default Commission')}</span>
                  <span className="font-bold text-indigo-500">
                    {p.defaultCommission ? `${p.defaultCommission}${p.commissionType === 'Percentage' ? '%' : ' Rs.'}` : t('None')}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block">{t('Average Weight')}</span>
                  <span className="font-semibold">{p.averageWeight ? `${p.averageWeight} kg` : t('Not Set')}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block">{t('Price Range')}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {p.minPrice && p.maxPrice ? `Rs. ${p.minPrice} - ${p.maxPrice}` : t('Unlimited')}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${p.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
                  {t(p.status || 'Active')}
                </span>
                <span className="text-[10px] text-slate-400">{t('Current Qty')}: {p.currentQuantity || 0}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">{t('No products found in catalog.')}</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>{t('Page')} {currentPage} {t('of')} {totalPages}</span>
          <div className="flex space-x-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-50"
            >
              {t('Previous')}
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-50"
            >
              {t('Next')}
            </button>
          </div>
        </div>
      )}

      {/* Edit Default Presets Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up text-slate-800 dark:text-slate-100">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="text-sm font-black uppercase tracking-wider">{t('Edit Product Default Presets')}</h4>
              <p className="text-[10px] text-indigo-400 font-bold tracking-wide">{selectedProduct?.name} ({selectedProduct?.category})</p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* Default Unit */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Default Trading Unit')}</label>
                <select
                  value={formData.defaultUnit}
                  onChange={e => setFormData(prev => ({ ...prev, defaultUnit: e.target.value }))}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none focus:border-[#4F46E5] text-xs"
                  required
                >
                  <option value="">{t('Select Unit')}</option>
                  {unitsList.length > 0 ? (
                    unitsList.filter(u => u.status === 'Active').map(u => (
                      <option key={u.id || u._id} value={u.name}>{u.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="Crate">Crate</option>
                      <option value="Box">Box</option>
                      <option value="Bag">{t('Bag')}</option>
                      <option value="Kg">Kg</option>
                    </>
                  )}
                </select>
              </div>

              {/* Commission Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Commission Type')}</label>
                  <select
                    value={formData.commissionType}
                    onChange={e => setFormData(prev => ({ ...prev, commissionType: e.target.value }))}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
                  >
                    <option value="Percentage">{t('Percentage (%)')}</option>
                    <option value="Fixed Amount">{t('Fixed Amount (Rs.)')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Default Rate')}</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.defaultCommission}
                    onChange={e => setFormData(prev => ({ ...prev, defaultCommission: e.target.value }))}
                    placeholder={t('e.g. 5')}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Average Weight */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Average Weight per Unit (kg)')}</label>
                <input
                  type="number"
                  step="any"
                  value={formData.averageWeight}
                  onChange={e => setFormData(prev => ({ ...prev, averageWeight: e.target.value }))}
                  placeholder={t('e.g. 25')}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
                />
              </div>

              {/* Price Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Min Price Limit')}</label>
                  <input
                    type="number"
                    value={formData.minPrice}
                    onChange={e => setFormData(prev => ({ ...prev, minPrice: e.target.value }))}
                    placeholder={t('Min Rs.')}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">{t('Max Price Limit')}</label>
                  <input
                    type="number"
                    value={formData.maxPrice}
                    onChange={e => setFormData(prev => ({ ...prev, maxPrice: e.target.value }))}
                    placeholder={t('Max Rs.')}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase tracking-wider">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl outline-none"
                >
                  <option value="Active">{t('Active')}</option>
                  <option value="Inactive">{t('Inactive')}</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-500"
                >
                  {t('CANCEL')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold flex items-center space-x-2 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <SpokeSpinner size={16} color="#FFFFFF" />
                      <span>{t('SAVING...')}</span>
                    </>
                  ) : (
                    <span>{t('SAVE CHANGES')}</span>
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
