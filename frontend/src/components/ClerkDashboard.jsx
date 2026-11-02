import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { openSafePrintWindowFromElement } from '../utils/safePrint.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  Plus, Pencil,RotateCcw,Tag,Activity, Trash, Search, ShieldAlert, Calendar, Printer, Filter, CheckCircle2, Home, Boxes, DollarSign, X, Truck
} from 'lucide-react';
import RecordBatchSale from './RecordBatchSale.jsx';
import BoliSessionPage from './BoliSessionPage.jsx';
import BatchSaleCustomRate from './BatchSaleCustomRate.jsx';
import SoldConsignments from './SoldConsignments.jsx';
import TruckLogsAndLogistics from './TruckLogsAndLogistics.jsx';
import OwnTradingPurchases from './OwnTradingPurchases.jsx';
import ProductCatalog from './ProductCatalog.jsx';
import ReturnsManagement from './ReturnsManagement.jsx';
import BusinessProfile from './settings/BusinessProfile.jsx';
import { openReportInNewTab } from '../utils/navigation.js';
import SpokeSpinner from './common/SpokeSpinner.jsx';

import { useConfirm } from '../context/ConfirmContext.jsx';

export default function ClerkDashboard({ tab, setCurrentTab }) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockEntries, setStockEntries] = useState([]);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Search & Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState('');
  const [invoiceSettings, setInvoiceSettings] = useState(null);

  // Modals
  const [modalType, setModalType] = useState(null); // 'stock', 'sale', 'invoice'
  const [editingOwnPurchaseId, setEditingOwnPurchaseId] = useState(null);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit'
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [suppliersRes, customersRes, productsRes, stockRes, salesRes, returnsRes, invoiceSettingsRes] = await Promise.all([
        api.get('/suppliers').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/products').catch(() => ({ data: [] })),
        api.get('/stock').catch(() => ({ data: [] })),
        api.get('/sales').catch(() => ({ data: [] })),
        api.get('/returns').catch(() => ({ data: [] })),
        api.get('/settings/invoice').catch(() => ({ data: null })),
      ]);

      const extractArray = (data) => Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : (Array.isArray(data?.data) ? data.data : []));

      setSuppliers(extractArray(suppliersRes.data));
      setCustomers(extractArray(customersRes.data));
      setProducts(extractArray(productsRes.data));
      setStockEntries(extractArray(stockRes.data));
      setSales(extractArray(salesRes.data));
      setReturns(extractArray(returnsRes.data));
      setInvoiceSettings(invoiceSettingsRes.data || null);
    } catch (err) {
      showToast(t('Error loading server data'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tab]);

  const openModal = (type, mode, item = null) => {
    if (type === 'stock' && mode === 'edit' && item?.businessMode === 'Own Trading') {
      if (!item.ownTradingPurchaseId) {
        showToast?.('This lot has no linked Own Trading purchase.', 'error');
        return;
      }
      setEditingOwnPurchaseId(item.ownTradingPurchaseId);
      return;
    }
    setModalType(type);
    setModalMode(mode);
    setSelectedItem(item);
    if (mode === 'edit' && item) {
      setFormData({ ...item });
    } else {
      setFormData({});
    }
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedItem(null);
    setFormData({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (modalSubmitting) return;
    setModalSubmitting(true);
    try {
      let endpoint = modalType === 'stock' ? '/stock' : '/sales';
      if (modalMode === 'add') {
        if (!formData.date) {
          formData.date = new Date().toISOString().split('T')[0];
        }
        await api.post(endpoint, formData);
        showToast(t('{{type}} entry successfully recorded!', { type: t(modalType === 'stock' ? 'Stock' : 'Sales') }));
      } else {
        const updateEndpoint = modalType === 'stock' ? `/stock/${selectedItem.id || selectedItem._id}` : `/sales/${selectedItem.id || selectedItem._id}`;
        await api.put(updateEndpoint, formData);
        showToast(t('{{type}} entry successfully updated!', { type: t(modalType === 'stock' ? 'Stock' : 'Sales') }));
      }
      closeModal();
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || t('Operation failed'), 'error');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDelete = async (type, id, name) => {
    const confirmed = await confirm({
      title: t('Delete {{name}}?', { name }),
      message: t('Are you sure you want to delete {{name}}? This action cannot be undone.', { name }),
      confirmText: t('Delete'),
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      const endpoint = type === 'stock' ? `/stock/${id}` : `/sales/${id}`;
      await api.delete(endpoint);
      showToast(t('{{type}} deleted successfully.', { type: t(type === 'stock' ? 'Stock' : 'Sales') }));
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || t('Delete failed'), 'error');
    }
  };

  // Enriched Stock Entries with Returns calculations
  const enrichedStockEntries = React.useMemo(() => {
    return stockEntries.map(entry => {
      const entryId = String(entry.id || entry._id);
      const lotNumStr = entry.lotNumber ? String(entry.lotNumber) : null;

      // Find linked sales
      const lotSales = (sales || []).filter(s => {
        if (s.isDeleted) return false;
        const sStockId = s.stockEntryId ? String(s.stockEntryId) : null;
        const sLotNum = s.stockLotNumber ? String(s.stockLotNumber) : null;
        if (sStockId && sStockId === entryId) return true;
        if (sLotNum && lotNumStr && sLotNum === lotNumStr) return true;
        return false;
      });

      // Find linked approved returns
      const lotReturns = (returns || []).filter(r => {
        if (r.isDeleted || r.status !== 'Approved') return false;
        const rStockId = r.stockEntryId ? String(r.stockEntryId) : null;
        const rSaleId = r.saleId ? String(r.saleId) : null;
        const matchesStock = (rStockId && rStockId === entryId);
        const matchesSale = rSaleId && lotSales.some(s => String(s.id || s._id) === rSaleId);
        return matchesStock || matchesSale;
      });

      const arrivedQty = entry.arrivedQuantity !== undefined ? Number(entry.arrivedQuantity) : (Number(entry.quantity) || 0);
      const rawSoldQty = lotSales.length > 0
        ? lotSales.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0)
        : (entry.soldQuantity !== undefined ? Number(entry.soldQuantity) : 0);

      const returnedProduceQty = lotReturns.length > 0
        ? lotReturns.reduce((acc, r) => acc + (Number(r.produceReturnedQty) || 0), 0)
        : (entry.returnedQuantity !== undefined ? Number(entry.returnedQuantity) : 0);

      const netSoldQty = Math.max(0, rawSoldQty - returnedProduceQty);
      const remainingQty = entry.remainingQuantity !== undefined 
        ? Number(entry.remainingQuantity) 
        : Math.max(0, arrivedQty - netSoldQty);

      const rawGrossSales = lotSales.reduce((acc, s) => acc + (Number(s.grossSale) || (Number(s.quantity || 0) * Number(s.saleRate || 0)) || 0), 0);
      const returnedGross = lotReturns.reduce((acc, r) => acc + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0)) || 0), 0);
      const totalAmount = (rawGrossSales > 0 || returnedGross > 0)
        ? Math.max(0, Math.round((rawGrossSales - returnedGross) * 100) / 100)
        : (Number(entry.totalAmount) || 0);

      const avgRate = netSoldQty > 0 
        ? (Math.round((totalAmount / netSoldQty) * 100) / 100)
        : (Number(entry.purchaseRate) || 0);

      const status = remainingQty === 0 ? 'Depleted' : (netSoldQty > 0 ? 'Partially Sold' : 'In-Stock');
      const lotNumber = entry.lotNumber || (entryId.substring(0, 6).toUpperCase());
      const unit = entry.unit || 'Crates';

      return {
        ...entry,
        lotNumber,
        unit,
        arrivedQty,
        soldQty: rawSoldQty,
        returnedProduceQty,
        netSoldQty,
        remainingQty,
        avgRate,
        totalAmount,
        status,
      };
    });
  }, [stockEntries, sales, returns]);

  // Stock Summary calculations
  const stockSummary = React.useMemo(() => {
    let totalLots = enrichedStockEntries.length;
    let totalArrived = 0;
    let totalSold = 0;
    let totalReturned = 0;
    let totalRemaining = 0;
    let totalCreditedAmount = 0;

    enrichedStockEntries.forEach(item => {
      totalArrived += (item.arrivedQty || 0);
      totalSold += (item.soldQty || 0);
      totalReturned += (item.returnedProduceQty || 0);
      totalRemaining += (item.remainingQty || 0);
      totalCreditedAmount += (item.totalAmount || 0);
    });

    return {
      totalLots,
      totalArrived,
      totalSold,
      totalReturned,
      netSold: Math.max(0, totalSold - totalReturned),
      totalRemaining,
      totalCreditedAmount
    };
  }, [enrichedStockEntries]);

  const filterAndPaginate = (list) => {
    let filtered = Array.isArray(list) ? list : [];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        Object.values(item).some(val => 
          String(val).toLowerCase().includes(term)
        ) ||
        (item.lotNumber && String(item.lotNumber).toLowerCase().includes(term)) ||
        (item.vehicleNumber && String(item.vehicleNumber).toLowerCase().includes(term))
      );
    }

    if (filterSupplier) {
      filtered = filtered.filter(item => item.supplierId === filterSupplier);
    }
    if (filterProduct) {
      filtered = filtered.filter(item => item.productId === filterProduct || item.productName?.toLowerCase().includes(filterProduct.toLowerCase()));
    }
    if (filterCustomer) {
      filtered = filtered.filter(item => item.customerId === filterCustomer);
    }
    if (filterDate) {
      filtered = filtered.filter(item => item.date === filterDate);
    }
    if (tab === 'stock' && filterStockStatus) {
      filtered = filtered.filter(item => item.status === filterStockStatus);
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(startIdx, startIdx + itemsPerPage);

    return { paginated, totalPages, totalItems };
  };

  const triggerPrint = (title) => {
    const printContent = document.getElementById('printable-area');
    const win = openSafePrintWindowFromElement(title, printContent, 'height=700,width=900');
    if (!win) return;
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">{t("Loading Clerk Desk...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl transition-all border
          ${toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-[#4F46E5]/10 border-[#4F46E5]/20 text-[#4F46E5] dark:text-indigo-400'}`}>
          <CheckCircle2 size={18} />
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* ----------------- TAB: TRUCK LOGS & LOGISTICS ----------------- */}
      {tab === 'logistics' && (
        <TruckLogsAndLogistics suppliers={suppliers} showToast={showToast} />
      )}

      {/* ----------------- TAB: BUSINESS PROFILE ----------------- */}
      {(tab === 'business_profile' || tab === 'business') && (
        <BusinessProfile showToast={showToast} />
      )}

      {/* ----------------- TAB: DASHBOARD ----------------- */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{t("Products")}</p>
                <h3 className="text-2xl font-black mt-1 text-[#4F46E5] dark:text-indigo-400">{(products || []).length}</h3>
              </div>
              <div className="p-3 bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400 rounded-xl"><Boxes size={22} /></div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{t("Today's Supplies")}</p>
                <h3 className="text-2xl font-black mt-1 text-blue-400">
                  {(stockEntries || []).filter(s => s.date === new Date().toISOString().split('T')[0]).length} {t("Entries")}
                </h3>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><Home size={22} /></div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{t("Today's Sales")}</p>
                <h3 className="text-2xl font-black mt-1 text-amber-400">
                  {(sales || []).filter(s => s.date === new Date().toISOString().split('T')[0]).length} {t("Tickets")}
                </h3>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl"><DollarSign size={22} /></div>
            </div>
          </div>

          {/* Low Stock Alerts */}
          {(products || []).some(p => p.currentQuantity <= 20) && (
            <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-300 flex items-center space-x-3">
              <ShieldAlert size={20} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">{t("Low Stock Warnings!")}</p>
                <p className="text-xs opacity-80 mt-0.5">
                  {t("Items near depletion")}: {products.filter(p => p.currentQuantity <= 20).map(p => `${p.name} (${p.currentQuantity} ${p.unit} ${t("left")})`).join(', ')}. {t("Coordinate with Beopari/Growers!")}
                </p>
              </div>
            </div>
          )}

          {/* Recent entries board */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 space-y-4">
              <h4 className="text-sm font-black uppercase tracking-wider">{t("Recent Stock Supplies (Purchase)")}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                      <th className="py-2.5">{t("Date")}</th>
                      <th className="py-2.5">{t("Supplier")}</th>
                      <th className="py-2.5">{t("Item")}</th>
                      <th className="py-2.5 text-right">{t("Qty")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockEntries.slice(0, 5).map(e => (
                      <tr key={e.id || e._id} className="border-b border-slate-800/20">
                        <td className="py-2 text-slate-500 dark:text-slate-400">{e.date}</td>
                        <td className="py-2 font-semibold">{e.supplierName}</td>
                        <td className="py-2">{e.productName}</td>
                        <td className="py-2 text-right text-indigo-400 font-bold">{e.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 space-y-4">
              <h4 className="text-sm font-black uppercase tracking-wider">{t("Recent Sales Tickets")}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                      <th className="py-2.5">{t("Date")}</th>
                      <th className="py-2.5">{t("Buyer")}</th>
                      <th className="py-2.5">{t("Item")}</th>
                      <th className="py-2.5 text-right">{t("Sum")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.slice(0, 5).map(s => (
                      <tr key={s.id || s._id} className="border-b border-slate-800/20">
                        <td className="py-2 text-slate-500 dark:text-slate-400">{s.date}</td>
                        <td className="py-2 font-semibold">{s.customerName}</td>
                        <td className="py-2">{s.productName}</td>
                        <td className="py-2 text-right text-[#4F46E5] dark:text-indigo-400 font-bold">{t("Rs.")} {s.totalAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB: SUPPLIER STOCK (PURCHASE) ----------------- */}
      {tab === 'stock' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider">{t("Supplies Inventory Log (Purchase)")}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("Record and track consignment lots, produce arrivals, sales dispatches, and restocked customer returns")}</p>
            </div>
            <button 
              onClick={() => openModal('stock', 'add')}
              className="flex items-center space-x-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
            >
              <Plus size={16} />
              <span>{t("RECORD NEW STOCK ARRIVAL")}</span>
            </button>
          </div>

          <OwnTradingPurchases editPurchaseId={editingOwnPurchaseId} onEditClosed={() => setEditingOwnPurchaseId(null)} suppliers={suppliers} products={products} showToast={showToast} onSaved={fetchData} />

          {/* Top Summary Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Total Lots")}</div>
              <div className="text-lg font-black text-slate-800 dark:text-white mt-1">{stockSummary.totalLots}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t("Consignments")}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{t("Arrived Stock")}</div>
              <div className="text-lg font-black text-indigo-500 dark:text-indigo-400 mt-1">{stockSummary.totalArrived.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t("Total received")}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{t("Gross Sold")}</div>
              <div className="text-lg font-black text-blue-500 dark:text-blue-400 mt-1">{stockSummary.totalSold.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t("Sales tickets")}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-amber-200/50 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/10 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 flex items-center gap-1">
                {/* <RotateCcw size={11} /> */}
                <span>{t("Returned Qty")}</span>
              </div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">{stockSummary.totalReturned.toLocaleString()}</div>
              <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">{t("Restocked")}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-emerald-200/50 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/10 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">{t("Remaining Stock")}</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">{stockSummary.totalRemaining.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{t("In warehouse")}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">{t("Total Value")}</div>
              <div className="text-lg font-black text-rose-500 dark:text-rose-400 mt-1">{t("Rs.")} {stockSummary.totalCreditedAmount.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t("Net turnover")}</div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="flex items-center px-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
              <Search size={16} className="text-slate-500 dark:text-slate-400 mr-2 shrink-0" />
              <input 
                type="text" 
                placeholder={t("Search by Lot #, beopari/grower, produce...")}
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="bg-transparent border-0 outline-none text-xs w-full placeholder:text-slate-500" 
              />
            </div>
            <div className="flex items-center px-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
              <Filter size={16} className="text-slate-500 dark:text-slate-400 mr-2 shrink-0" />
              <select 
                value={filterSupplier} 
                onChange={e => setFilterSupplier(e.target.value)} 
                className="bg-transparent border-0 outline-none text-xs w-full"
              >
                <option value="">{t("All Beopari/Growers")}</option>
                {suppliers.map(s => <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex items-center px-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
              <Tag size={16} className="text-slate-500 dark:text-slate-400 mr-2 shrink-0" />
              <select 
                value={filterProduct} 
                onChange={e => setFilterProduct(e.target.value)} 
                className="bg-transparent border-0 outline-none text-xs w-full"
              >
                <option value="">{t("All Products")}</option>
                {products.map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex items-center px-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
              <Activity size={16} className="text-slate-500 dark:text-slate-400 mr-2 shrink-0" />
              <select 
                value={filterStockStatus} 
                onChange={e => setFilterStockStatus(e.target.value)} 
                className="bg-transparent border-0 outline-none text-xs w-full"
              >
                <option value="">{t("All Statuses")}</option>
                <option value="In-Stock">{t("In-Stock (Available)")}</option>
                <option value="Partially Sold">{t("Partially Sold")}</option>
                <option value="Depleted">{t("Depleted (Zero Balance)")}</option>
              </select>
            </div>
            <div className="flex items-center px-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80">
              <Calendar size={16} className="text-slate-500 dark:text-slate-400 mr-2 shrink-0" />
              <input 
                type="date" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)} 
                className="bg-transparent border-0 outline-none text-xs w-full" 
              />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider bg-slate-50/50 dark:bg-slate-900/40">
                    <th className="py-4 px-5">{t("Lot # & Date")}</th>
                    <th className="py-4 px-5">{t("Beopari/Grower")}</th>
                    <th className="py-4 px-5">{t("Commodity")}</th>
                    <th className="py-4 px-5 text-right">{t("Arrived Qty")}</th>
                    <th className="py-4 px-5 text-right">{t("Sold Qty")}</th>
                    <th className="py-4 px-5 text-right">{t("Returned Qty")}</th>
                    <th className="py-4 px-5 text-right">{t("Remaining Qty")}</th>
                    <th className="py-4 px-5 text-right">{t("Avg Realized Rate")}</th>
                    <th className="py-4 px-5 text-right">{t("Total Credited")}</th>
                    <th className="py-4 px-5 text-center">{t("Status")}</th>
                    <th className="py-4 px-5 text-right">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {(() => {
                    const { paginated, totalPages } = filterAndPaginate(enrichedStockEntries);
                    if (paginated.length === 0) {
                      return (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-slate-400">
                            {t("No stock arrival supplies found matching current filters.")}
                          </td>
                        </tr>
                      );
                    }
                    return paginated.map(entry => {
                      const hasReturns = (entry.returnedProduceQty || 0) > 0;
                      return (
                        <tr key={entry.id || entry._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded text-[11px] border border-indigo-200/40 dark:border-indigo-800/40">
                                #{entry.lotNumber}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{entry.date}</div>
                            {entry.vehicleNumber && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Truck size={10} />
                                <span>{entry.vehicleNumber}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-slate-900 dark:text-white">{entry.supplierName}</div>
                            {entry.businessMode === 'Own Trading' && <span className="inline-block mt-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-600">{t('Own Trading')}</span>}
                            {entry.supplierPhone && <div className="text-[11px] text-slate-400">{entry.supplierPhone}</div>}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{entry.productName}</div>
                            <span className="inline-block text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 mt-0.5">
                              {entry.unit || 'Crates'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-indigo-600 dark:text-indigo-400">
                            {entry.arrivedQty} <span className="text-[10px] font-normal text-slate-400">{entry.unit || 'Crates'}</span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-semibold text-blue-600 dark:text-blue-400">
                            {entry.soldQty} <span className="text-[10px] font-normal text-slate-400">{entry.unit || 'Crates'}</span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            {hasReturns ? (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-xs border border-amber-200/50 dark:border-amber-800/40">
                                <RotateCcw size={10} />
                                {entry.returnedProduceQty} {entry.unit || 'Crates'}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            {entry.remainingQty} <span className="text-[10px] font-normal text-slate-400">{entry.unit || 'Crates'}</span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-semibold text-slate-700 dark:text-slate-300">
                            {t("Rs.")} {entry.avgRate || 0}
                          </td>
                          <td className="py-3.5 px-5 text-right font-black text-rose-600 dark:text-rose-400">
                            {t("Rs.")} {(entry.totalAmount || 0).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              entry.status === 'Depleted'
                                ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                : entry.status === 'Partially Sold'
                                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/40 dark:border-indigo-800/40'
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-800/40'
                            }`}>
                              {t(entry.status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button 
                                onClick={() => openModal('stock', 'edit', entry)} 
                                title={t(entry.businessMode === 'Own Trading' ? 'Edit Own Trading Purchase' : 'Edit Lot Arrival')}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                              >
                                <Pencil size={13} />
                              </button>
                              <button 
                                onClick={() => handleDelete('stock', entry.id || entry._id, `Lot #${entry.lotNumber} (${entry.arrivedQty} of ${entry.productName})`)} 
                                title={t("Delete Lot Arrival")}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 transition-colors cursor-pointer"
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {(() => {
              const { totalPages, totalItems } = filterAndPaginate(enrichedStockEntries);
              if (totalPages <= 1) return null;
              return (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-xs">
                  <div className="text-slate-500 dark:text-slate-400">
                    {t("Showing Page")} <span className="font-bold text-slate-800 dark:text-white">{currentPage}</span> {t("of")} <span className="font-bold text-slate-800 dark:text-white">{totalPages}</span> ({totalItems} {t("total supply lots)")}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 font-medium hover:bg-slate-50 cursor-pointer"
                    >
                      {t("Previous")}
                    </button>
                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 font-medium hover:bg-slate-50 cursor-pointer"
                    >
                      {t("Next")}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ----------------- TAB: SALES TRANSACTIONS ----------------- */}
      {tab === 'sales' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider">{t("Commission Brokerage Sales Tickets")}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("Record fruit and vegetable sales to wholesale and retail buyers")}</p>
            </div>
            <button 
              onClick={() => openModal('sale', 'add')}
              className="flex items-center space-x-2 bg-[#4F46E5] hover:bg-[#4F46E5] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
            >
              <Plus size={16} />
              <span>{t("RECORD NEW SALE")}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center px-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80">
              <Search size={16} className="text-slate-500 dark:text-slate-400 mr-2" />
              <input type="text" placeholder={t("Search sales tickets...")} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent border-0 outline-none text-xs w-full" />
            </div>
            <div className="flex items-center px-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80">
              <Filter size={16} className="text-slate-500 dark:text-slate-400 mr-2" />
              <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="bg-transparent border-0 outline-none text-xs w-full">
                <option value="">{t("All Customers")}</option>
                {customers.map(c => <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-center px-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80">
              <Calendar size={16} className="text-slate-500 dark:text-slate-400 mr-2" />
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="bg-transparent border-0 outline-none text-xs w-full" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                  <th className="py-4 px-5">{t("Date")}</th>
                  <th className="py-4 px-5">{t("Customer Name")}</th>
                  <th className="py-4 px-5">{t("Product Name")}</th>
                  <th className="py-4 px-5 text-right">{t("Quantity")}</th>
                  <th className="py-4 px-5 text-right">{t("Sale Rate")}</th>
                  <th className="py-4 px-5 text-right">{t("Discount")}</th>
                  <th className="py-4 px-5 text-right">{t("Billing Sum")}</th>
                  <th className="py-4 px-5 text-right">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-200 dark:divide-slate-800/50">
                {filterAndPaginate(sales).paginated.map(sale => (
                  <tr key={sale.id || sale._id}>
                    <td className="py-3 px-5 font-bold text-slate-700 dark:text-slate-300">{sale.date}</td>
                    <td className="py-3 px-5 font-semibold">{sale.customerName}</td>
                    <td className="py-3 px-5">{sale.productName}</td>
                    <td className="py-3 px-5 text-right font-bold text-blue-400">{sale.quantity}</td>
                    <td className="py-3 px-5 text-right">{t("Rs.")} {sale.saleRate}</td>
                    <td className="py-3 px-5 text-right text-rose-400">{t("Rs.")} {sale.discount || 0}</td>
                    <td className="py-3 px-5 text-right font-black text-[#4F46E5] dark:text-indigo-400">{t("Rs.")} {sale.totalAmount.toLocaleString()}</td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => {
                            openReportInNewTab('sale-invoice', { saleId: sale.id || sale._id });
                          }} 
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          <Printer size={13} />
                        </button>
                        <button onClick={() => handleDelete('sale', sale.id || sale._id, `${sale.quantity} of ${sale.productName}`)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"><Trash size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- TAB: RECORD BATCH SALE ----------------- */}
      {tab === 'sales_batch' && (
        <RecordBatchSale setCurrentTab={setCurrentTab} />
      )}

      {/* ----------------- TAB: LOT SALE / BOLI SESSION ----------------- */}
      {tab === 'sales_boli' && (
        <BoliSessionPage setCurrentTab={setCurrentTab} />
      )}

      {/* ----------------- TAB: BATCH SALE (CUSTOM RATE) ----------------- */}
      {tab === 'sales_batch_custom_rate' && (
        <BatchSaleCustomRate setCurrentTab={setCurrentTab} />
      )}

      {/* ----------------- TAB: SOLD CONSIGNMENTS ----------------- */}
      {tab === 'sales_sold_consignments' && (
        <SoldConsignments setCurrentTab={setCurrentTab} />
      )}

      {/* ----------------- TAB: RETURNS & SETTLEMENTS ----------------- */}
      {tab === 'returns' && (
        <ReturnsManagement role="Clerk" />
      )}

      {/* ----------------- TAB: PRODUCT CATALOG ----------------- */}
      {tab === 'products' && (
        <ProductCatalog
          products={products}
          onRefresh={fetchData}
          showToast={showToast}
          role="Clerk"
        />
      )}

      {/* --- MODALS --- */}
      {modalType && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          {modalType === 'stock' && (
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 p-6 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
                <h3 className="text-base font-black uppercase tracking-wider">{t(modalMode === 'add' ? 'RECORD' : 'EDIT')} {t("BEOPARI/GROWER STOCK ARRIVAL")}</h3>
                <button onClick={closeModal} className="text-slate-500 dark:text-slate-400 hover:text-white"><X size={18} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block">{t("Beopari/Grower")}</label>
                    <select required name="supplierId" value={formData.supplierId || ''} onChange={handleFormChange} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none">
                      <option value="">{t("Select Beopari/Grower")}</option>
                      {suppliers.map(s => <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block">{t("Product")}</label>
                    <select required name="productId" value={formData.productId || ''} onChange={handleFormChange} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none">
                      <option value="">{t("Select Product")}</option>
                      {products.map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name} ({p.unit})</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block">{t("Arrival Quantity")}</label>
                    <input required type="number" name="quantity" value={formData.quantity || ''} onChange={handleFormChange} placeholder={t("Enter physical units received")} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block">{t("Voucher Date")}</label>
                    <input required type="date" name="date" value={formData.date || ''} onChange={handleFormChange} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block">{t("Vehicle / Truck No. (Optional)")}</label>
                    <input type="text" name="vehicleNumber" value={formData.vehicleNumber || ''} onChange={handleFormChange} placeholder={t("e.g. LES-4921")} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none uppercase font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block">{t("Lot Reference # (Optional)")}</label>
                    <input type="text" name="lotNumber" value={formData.lotNumber || ''} onChange={handleFormChange} placeholder={t("Auto-assigned if empty")} className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none uppercase font-mono" />
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-[11px]">
                  <strong>{t("Note:")}</strong> {t("Rate will be left pending at arrival, and will be updated automatically as you make sales tickets from this lot.")}
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                  <button type="button" onClick={closeModal} className="px-5 py-3 rounded-xl hover:bg-slate-800 text-xs font-bold uppercase">{t("Cancel")}</button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    className="px-6 py-3 bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase flex items-center space-x-2 cursor-pointer"
                  >
                    {modalSubmitting ? (
                      <>
                        <SpokeSpinner size={16} color="#FFFFFF" />
                        <span>{t("Saving...")}</span>
                      </>
                    ) : (
                      <span>{t("Save Arrival")}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {modalType === 'sale' && (
            <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
                <h3 className="text-base font-black uppercase tracking-wider">{t("RECORD BATCH CONSIGNMENT SALE")}</h3>
                <button onClick={closeModal} className="text-slate-500 dark:text-slate-400 hover:text-white"><X size={18} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block text-[10px]">{t("Select Available Farmer Consignment")}</label>
                  <select 
                    required 
                    name="stockEntryId" 
                    value={formData.stockEntryId || ''} 
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        stockEntryId: selectedId,
                        date: prev.date || new Date().toISOString().split('T')[0],
                        buyers: [] // Reset buyers list
                      }));
                    }} 
                    className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none"
                  >
                    <option value="">{t("Select active consignment")}</option>
                    {stockEntries
                      .filter(s => (s.remainingQuantity !== undefined ? s.remainingQuantity : s.quantity) > 0)
                      .map(s => (
                        <option key={s.id || s._id} value={s.id || s._id}>
                          {s.businessMode === 'Own Trading' ? `${t('Own Trading')} — ` : ''}{s.productName} ({(s.remainingQuantity !== undefined ? s.remainingQuantity : s.quantity)} {t("left) - Supplier:")} {s.supplierName} {t("(Arrived:")} {s.date})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block text-[10px]">{t("Set Sale Rate (Rs.)")}</label>
                    <input 
                      required 
                      type="number" 
                      name="saleRate" 
                      placeholder={t("Set flat rate for selected buyers")}
                      value={formData.saleRate || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, saleRate: e.target.value }))}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none font-bold text-sm" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block text-[10px]">{t("Booking Date")}</label>
                    <input 
                      required 
                      type="date" 
                      name="date" 
                      value={formData.date || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3 outline-none" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-slate-500 dark:text-slate-400 font-bold uppercase block text-[10px]">{t("Select Buyers & Enter Quantities")}</label>
                  <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3 bg-[#F8FAFC] dark:bg-[#0F172A]">
                    {customers.map(c => {
                      const buyerConfig = (formData.buyers || []).find(b => b.customerId === (c.id || c._id));
                      const isChecked = !!buyerConfig;
                      return (
                        <div key={c.id || c._id} className="space-y-2 border-b border-slate-100 dark:border-slate-800/40 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (checked) {
                                  const updatedBuyers = [...(formData.buyers || []), { customerId: c.id || c._id, name: c.name, quantity: '', discount: '' }];
                                  setFormData(prev => ({ ...prev, buyers: updatedBuyers }));
                                } else {
                                  const updatedBuyers = (formData.buyers || []).filter(b => b.customerId !== (c.id || c._id));
                                  setFormData(prev => ({ ...prev, buyers: updatedBuyers }));
                                }
                              }}
                              className="rounded text-[#4F46E5] focus:ring-[#4F46E5] h-4 w-4"
                            />
                            <span className="font-bold text-slate-700 dark:text-slate-300">{c.name}</span>
                          </div>
                          {isChecked && (
                            <div className="grid grid-cols-2 gap-3 pl-6">
                              <div>
                                <span className="text-[9px] text-slate-500 uppercase block mb-1">{t("Quantity to Buy")}</span>
                                <input 
                                  required
                                  type="number" 
                                  placeholder={t("Qty")}
                                  value={buyerConfig.quantity || ''}
                                  onChange={(e) => {
                                    const updatedBuyers = (formData.buyers || []).map(b => 
                                      b.customerId === (c.id || c._id) ? { ...b, quantity: e.target.value } : b
                                    );
                                    setFormData(prev => ({ ...prev, buyers: updatedBuyers }));
                                  }}
                                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 outline-none"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500 uppercase block mb-1">{t("Discount (Rs.)")}</span>
                                <input 
                                  type="number" 
                                  placeholder={t("Discount")}
                                  value={buyerConfig.discount || ''}
                                  onChange={(e) => {
                                    const updatedBuyers = (formData.buyers || []).map(b => 
                                      b.customerId === (c.id || c._id) ? { ...b, discount: e.target.value } : b
                                    );
                                    setFormData(prev => ({ ...prev, buyers: updatedBuyers }));
                                  }}
                                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {formData.stockEntryId && formData.saleRate && (formData.buyers || []).length > 0 && (
                  <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-[#4F46E5] uppercase block">{t("Batch Sale Summary")}</span>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{t("Total Buyers Selected:")}</span>
                      <span>{formData.buyers.length}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{t("Total Units Sold:")}</span>
                      <span>
                        {formData.buyers.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0)} {t("units")}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-black text-[#4F46E5]">
                      <span>{t("Total Billing Amount:")}</span>
                      <span>
                        {t("Rs.")} {formData.buyers.reduce((acc, curr) => {
                          const amt = ((Number(curr.quantity) || 0) * Number(formData.saleRate)) - (Number(curr.discount) || 0);
                          return acc + amt;
                        }, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                  <button type="button" onClick={closeModal} className="px-5 py-3 rounded-xl hover:bg-slate-800 text-xs font-bold uppercase">{t("Cancel")}</button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    className="px-6 py-3 bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase flex items-center space-x-2 cursor-pointer"
                  >
                    {modalSubmitting ? (
                      <>
                        <SpokeSpinner size={16} color="#FFFFFF" />
                        <span>{t("Recording...")}</span>
                      </>
                    ) : (
                      <span>{t("Record Batch Sales")}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* INVOICE VIEWER */}
          {modalType === 'invoice' && selectedItem && (
            <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 p-6 space-y-6 shadow-2xl relative flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-200 dark:border-slate-800/80 pb-4">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-black uppercase tracking-wider">{t("SALES BILL INVOICE")}</h3>
                  {invoiceSettings?.paperSize && (
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full font-bold">
                      {t("Format:")} {invoiceSettings.paperSize}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => triggerPrint(`Invoice-${selectedItem.id || selectedItem._id}`)} className="flex items-center space-x-1 bg-[#4F46E5] hover:bg-[#4F46E5] text-white font-bold text-xs px-3 py-1.5 rounded-xl">
                    <Printer size={13} />
                    <span>{t("PRINT")}</span>
                  </button>
                  <button onClick={closeModal} className="text-slate-500 dark:text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
              </div>

              <div
                id="printable-area"
                className={`p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl mx-auto shadow-sm ${
                  invoiceSettings?.paperSize === 'Thermal 3-inch'
                    ? 'w-[76mm] max-w-[320px] font-mono text-[10px] space-y-3'
                    : invoiceSettings?.paperSize === 'A5'
                    ? 'w-[148mm] max-w-md text-[11px] space-y-4'
                    : 'w-full max-w-xl space-y-6 text-xs'
                }`}
              >
                {/* Header block */}
                <div className={`flex ${invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'flex-col items-center text-center' : 'justify-between items-start'} border-b-2 border-slate-200 pb-4`}>
                  <div className={invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'space-y-1' : ''}>
                    {invoiceSettings?.companyLogo ? (
                      <img
                        src={invoiceSettings.companyLogo}
                        alt={t("Logo")}
                        className="h-10 object-contain mb-1.5"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex items-center space-x-2 mb-1">
                        <img 
                          src="/mandi_logo.jpg" 
                          alt={t("Mandi OS Logo")}
                          referrerPolicy="no-referrer"
                          className="h-9 w-auto object-contain rounded"
                        />
                        <h2 className="text-base font-black tracking-wider uppercase text-[#4F46E5]">
                          {invoiceSettings?.header || t('Mandi OS - Sabzi & Fruit Broker')}
                        </h2>
                      </div>
                    )}
                    {!invoiceSettings?.companyLogo && invoiceSettings?.header && (
                      <h2 className="text-sm font-black tracking-wide uppercase text-slate-800">
                        {invoiceSettings.header}
                      </h2>
                    )}
                    <p className="text-[10px] text-slate-500">{t("Shop 12, Fruit Market, Lahore, Pakistan")}</p>
                  </div>
                  <div className={invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'text-center mt-2 pt-2 border-t border-dashed border-slate-300 w-full' : 'text-right'}>
                    <p className="font-bold text-[10px]">
                      {t("Invoice:")} {invoiceSettings?.invoicePrefix || 'MANDI'}-{selectedItem.id?.substring(0, 5) || selectedItem._id?.substring(0, 5)}
                    </p>
                    <p className="text-[10px] text-slate-500">{t("Date:")} {selectedItem.date}</p>
                  </div>
                </div>

                <div className={`grid ${invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'grid-cols-1 space-y-2' : 'grid-cols-2 gap-4'} py-3 border-b border-slate-200 text-[10px]`}>
                  <div>
                    <span className="text-slate-500 font-bold block text-[8px]">{t("Billed To:")}</span>
                    <p className="font-bold text-sm text-slate-800">{selectedItem.customerName}</p>
                  </div>
                  <div className={invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'text-left' : 'text-right'}>
                    <span className="text-slate-500 font-bold block text-[8px]">{t("Account Category:")}</span>
                    <p className="text-slate-600 text-[9px]">{t("Mandi Trade Account Buyer")}</p>
                  </div>
                </div>

                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 font-bold uppercase text-slate-500 text-[8px]">
                      <th className="py-1">{t("Description")}</th>
                      <th className="py-1 text-right">{t("Qty")}</th>
                      <th className="py-1 text-right">{t("Rate")}</th>
                      <th className="py-1 text-right">{t("Total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-bold text-slate-800 text-[10px]">
                      <td className="py-2">{selectedItem.productName}</td>
                      <td className="py-2 text-right">{selectedItem.quantity}</td>
                      <td className="py-2 text-right">{t("Rs.")} {selectedItem.saleRate}</td>
                      <td className="py-2 text-right">{t("Rs.")} {(selectedItem.quantity * selectedItem.saleRate).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="border-t border-slate-200 pt-3 flex justify-end">
                  <div className={`${invoiceSettings?.paperSize === 'Thermal 3-inch' ? 'w-full' : 'w-1/2'} space-y-1 text-right font-bold text-[10px]`}>
                    {(() => {
                      const grossSub = selectedItem.grossSale || ((selectedItem.quantity || 0) * (selectedItem.saleRate || 0));
                      const comm = selectedItem.commissionAmount || 0;
                      const disc = selectedItem.discount || selectedItem.discountAmount || 0;
                      const netTotal = grossSub + comm - disc;
                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t("Gross Subtotal:")}</span>
                            <span>{t("Rs.")} {grossSub.toLocaleString()}</span>
                          </div>
                          {comm > 0 && (
                            <div className="flex justify-between text-slate-600">
                              <span className="text-slate-500">{t("Buyer Commission:")}</span>
                              <span>{t("+ Rs.")} {comm.toLocaleString()}</span>
                            </div>
                          )}
                          {disc > 0 && (
                            <div className="flex justify-between text-rose-600">
                              <span>{t("Discount:")}</span>
                              <span>{t("- Rs.")} {disc.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-slate-300 pt-1.5 text-xs font-black text-slate-900">
                            <span>{t("Total Invoice:")}</span>
                            <span>{t("Rs.")} {netTotal.toLocaleString()}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Terms and Conditions */}
                {invoiceSettings?.termsAndConditions && (
                  <div className="border-t border-slate-200 pt-3 text-[9px] text-slate-500 text-left">
                    <span className="font-bold block uppercase text-[8px]">{t("Terms & Conditions:")}</span>
                    <p className="whitespace-pre-line leading-normal text-slate-600">{invoiceSettings.termsAndConditions}</p>
                  </div>
                )}

                {/* Signature Block */}
                <div className="flex justify-between items-end pt-5 border-t border-slate-200 text-[9px]">
                  <div className="text-slate-400 text-[8px]">
                    {t("Format:")} {invoiceSettings?.paperSize || 'A4 Standard'}
                  </div>
                  <div className="text-right">
                    <div className="w-24 border-b border-slate-300 mx-auto"></div>
                    <p className="text-[9px] text-slate-500 mt-1.5 font-bold">
                      {invoiceSettings?.signature || t('Authorized Signatory')}
                    </p>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="border-t border-slate-100 pt-3 text-center text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
                  {invoiceSettings?.footer || t('Thank you for trading at Lahore Sabzi & Fruit Mandi!')}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={closeModal} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold uppercase">{t("Close Invoice")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
