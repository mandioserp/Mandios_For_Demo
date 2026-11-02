import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Building2, Users, Layers, Search, FileText, Settings, 
  Plus, Edit2, Eye, Calendar, Clock, Key, LogIn, CheckCircle, 
  XCircle, RefreshCw, Sparkles, AlertCircle, X, Shield, HelpCircle
} from 'lucide-react';
import api from '../utils/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { TAB_TO_PATH, PATH_TO_TAB } from '../utils/routes.js';
import DialogAlert from './common/DialogAlert.jsx';
import SuperAdminOverview from './superAdmin/SuperAdminOverview.jsx';
import BusinessManagement from './superAdmin/BusinessManagement.jsx';
import SubscriptionManagement from './superAdmin/SubscriptionManagement.jsx';
import UserOverview from './superAdmin/UserOverview.jsx';
import SuperAdminSearch from './superAdmin/SuperAdminSearch.jsx';
import SuperAdminAuditLogs from './superAdmin/SuperAdminAuditLogs.jsx';
import PlatformSettings from './superAdmin/PlatformSettings.jsx';

export default function SuperAdminDashboard({ tab = 'saas-dashboard', onTabChange }) {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive active tab from URL pathname, fallback to prop
  const currentPathTab = PATH_TO_TAB[location.pathname];
  const activeTab = currentPathTab || tab || 'saas-dashboard';

  const handleTabChange = (newTabId) => {
    const path = TAB_TO_PATH[newTabId] || '/saas-dashboard';
    navigate(path);
    if (onTabChange) {
      onTabChange(newTabId);
    }
  };
  
  // Data State
  const [businesses, setBusinesses] = useState([]);
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalAlert, setModalAlert] = useState(null);

  // Filters & Query State for Business Management
  const [bizSearchQuery, setBizSearchQuery] = useState('');
  const [bizStatusFilter, setBizStatusFilter] = useState('all');
  const [bizPlanFilter, setBizPlanFilter] = useState('all');

  // Modals State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [resetPassModalOpen, setResetPassModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [viewUserModalOpen, setViewUserModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Forms State
  const [createFormData, setCreateFormData] = useState({
    name: '',
    arthiCode: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    city: '',
    country: 'Pakistan',
    plan: 'Pro',
    maxUsers: 10,
    subscriptionExpiresAt: '',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    businessCode: '',
    arthiCode: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Pakistan',
    plan: 'Pro',
    status: 'Active',
    subscriptionExpiresAt: '',
  });

  const [extendFormData, setExtendFormData] = useState({
    extendDays: 30,
    subscriptionExpiryDate: '',
    subscriptionPlan: 'Pro',
  });

  const [resetPassData, setResetPassData] = useState({
    newPassword: '',
  });

  const [planFormData, setPlanFormData] = useState({
    name: '',
    priceMonthly: 5000,
    priceAnnual: 50000,
    duration: '1 Month',
    maxUsers: 5,
    maxProducts: 100,
    description: '',
    features: {
      logistics: true,
      returnsModule: true,
      reportsExport: true,
      prioritySupport: false,
    },
    isPopular: false,
    status: 'Active',
  });

  // Sync prop tab changes via routing
  useEffect(() => {
    if (tab && !currentPathTab) {
      handleTabChange(tab);
    }
  }, [tab, currentPathTab]);

  // Load Initial Data
  useEffect(() => {
    fetchInitialData();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [bizRes, statsRes, plansRes, usersRes, logsRes] = await Promise.all([
        api.get('/super-admin/businesses'),
        api.get('/super-admin/stats'),
        api.get('/super-admin/plans'),
        api.get('/super-admin/users'),
        api.get('/super-admin/audit-logs'),
      ]);
      setBusinesses(bizRes.data || []);
      setStats(statsRes.data || null);
      setPlans(plansRes.data || []);
      setAllUsers(usersRes.data || []);
      setAuditLogs(logsRes.data || []);
    } catch (err) {
      console.error('Error loading super admin data:', err);
      showToast(t('Failed to load platform data.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers for Businesses ---
  const handleOpenCreateBusiness = async () => {
    setCreateFormData({
      name: '',
      arthiCode: '',
      ownerName: '',
      email: '',
      password: '',
      phone: '',
      address: '',
      city: '',
      country: 'Pakistan',
      plan: 'Pro',
      maxUsers: 10,
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setModalAlert(null);
    setCreateModalOpen(true);
  };

  const handleSuggestArthiCode = async (bizName) => {
    if (!bizName) return;
    try {
      const res = await api.get(`/super-admin/businesses/suggest-arthi-code?name=${encodeURIComponent(bizName)}`);
      if (res.data?.suggestedCode) {
        setCreateFormData(prev => ({ ...prev, arthiCode: res.data.suggestedCode }));
      }
    } catch (err) {
      console.error('Suggest code error:', err);
    }
  };

  const handleCreateBusinessSubmit = async (e) => {
    e.preventDefault();
    if (!createFormData.name || !createFormData.email) {
      setModalAlert({ type: 'error', message: t('Please fill in Business Name and Owner Email.') });
      return;
    }
    setModalAlert(null);
    try {
      await api.post('/super-admin/businesses', createFormData);
      showToast(t('Business tenant registered successfully!'), 'success');
      setCreateModalOpen(false);
      setModalAlert(null);
      fetchInitialData();
    } catch (err) {
      const errMsg = err.response?.data?.error || t('Failed to create business.');
      setModalAlert({ type: 'error', message: errMsg });
    }
  };

  const handleOpenEditBusiness = (biz) => {
    setSelectedBusiness(biz);
    setEditFormData({
      name: biz.name || biz.businessName || '',
      businessCode: biz.businessCode || '',
      arthiCode: biz.arthiCode || '',
      ownerName: biz.ownerName || '',
      email: biz.email || '',
      phone: biz.phone || '',
      address: biz.address || '',
      city: biz.city || '',
      country: biz.country || 'Pakistan',
      plan: biz.plan || biz.subscriptionPlan || 'Pro',
      status: biz.status || biz.subscriptionStatus || 'Active',
      subscriptionExpiresAt: biz.subscriptionExpiresAt || biz.subscriptionExpiryDate || '',
    });
    setModalAlert(null);
    setEditModalOpen(true);
  };

  const handleEditBusinessSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBusiness) return;
    const bizId = selectedBusiness.id || selectedBusiness._id;
    setModalAlert(null);
    try {
      await api.put(`/super-admin/businesses/${bizId}`, editFormData);
      showToast(t('Business details updated successfully!'), 'success');
      setEditModalOpen(false);
      setModalAlert(null);
      fetchInitialData();
    } catch (err) {
      const errMsg = err.response?.data?.error || t('Failed to update business.');
      setModalAlert({ type: 'error', message: errMsg });
    }
  };

  const handleOpenViewBusiness = (biz) => {
    setSelectedBusiness(biz);
    setViewModalOpen(true);
  };

  const handleToggleBusinessStatus = async (biz) => {
    const bizId = biz.id || biz._id;
    const nextStatus = biz.status === 'Active' ? 'Suspended' : 'Active';
    const confirmMsg = t('Are you sure you want to {{action}} "{{name}}"?', {
      action: t(nextStatus === 'Active' ? 'activate' : 'suspend'),
      name: biz.name,
    });
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.patch(`/super-admin/businesses/${bizId}/status`, { status: nextStatus, isActive: nextStatus === 'Active' });
      showToast(t('Business is now {{status}}.', { status: t(nextStatus) }), 'success');
      fetchInitialData();
    } catch (err) {
      showToast(t('Failed to toggle business status.'), 'error');
    }
  };

  const handleOpenExtendModal = (biz) => {
    setSelectedBusiness(biz);
    const currentExpiry = biz.subscriptionExpiresAt || biz.subscriptionExpiryDate;
    setExtendFormData({
      extendDays: 30,
      subscriptionExpiryDate: currentExpiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      subscriptionPlan: biz.plan || biz.subscriptionPlan || 'Pro',
    });
    setExtendModalOpen(true);
  };

  const handleExtendSubscriptionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBusiness) return;
    const bizId = selectedBusiness.id || selectedBusiness._id;
    try {
      await api.post(`/super-admin/businesses/${bizId}/renew`, {
        subscriptionExpiryDate: extendFormData.subscriptionExpiryDate,
        subscriptionPlan: extendFormData.subscriptionPlan,
      });
      showToast(t('Subscription updated and extended successfully!'), 'success');
      setExtendModalOpen(false);
      fetchInitialData();
    } catch (err) {
      showToast(t('Failed to renew subscription.'), 'error');
    }
  };

  const handleOpenResetPassModal = (biz) => {
    setSelectedBusiness(biz);
    setResetPassData({ newPassword: '' });
    setResetPassModalOpen(true);
  };

  const handleResetPassSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBusiness) return;
    const bizId = selectedBusiness.id || selectedBusiness._id;
    try {
      await api.post(`/super-admin/businesses/${bizId}/reset-password`, resetPassData);
      showToast(t('Owner password reset successfully!'), 'success');
      setResetPassModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.error || t('Failed to reset password.'), 'error');
    }
  };

  const handleImpersonate = async (biz) => {
    const bizId = biz.id || biz._id;
    try {
      const res = await api.post(`/super-admin/businesses/${bizId}/impersonate`);
      if (res.data?.success) {
        window.location.href = '/home';
      }
    } catch (err) {
      showToast(err.response?.data?.error || t('Support impersonation failed.'), 'error');
    }
  };

  // --- Handlers for Subscription Plans ---
  const handleOpenCreatePlan = () => {
    setSelectedPlan(null);
    setPlanFormData({
      name: '',
      priceMonthly: 5000,
      priceAnnual: 50000,
      duration: '1 Month',
      maxUsers: 5,
      maxProducts: 100,
      description: '',
      features: { logistics: true, returnsModule: true, reportsExport: true, prioritySupport: false },
      isPopular: false,
      status: 'Active',
    });
    setPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan) => {
    setSelectedPlan(plan);
    setPlanFormData({
      name: plan.name || '',
      priceMonthly: plan.priceMonthly || 0,
      priceAnnual: plan.priceAnnual || 0,
      duration: plan.duration || '1 Month',
      maxUsers: plan.maxUsers || 5,
      maxProducts: plan.maxProducts || 100,
      description: plan.description || '',
      features: plan.features || { logistics: true, returnsModule: true, reportsExport: true, prioritySupport: false },
      isPopular: Boolean(plan.isPopular),
      status: plan.status || 'Active',
    });
    setPlanModalOpen(true);
  };

  const handlePlanFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedPlan) {
        const pId = selectedPlan.id || selectedPlan._id;
        await api.put(`/super-admin/plans/${pId}`, planFormData);
        showToast(t('Plan updated successfully!'), 'success');
      } else {
        await api.post('/super-admin/plans', planFormData);
        showToast(t('New plan created successfully!'), 'success');
      }
      setPlanModalOpen(false);
      fetchInitialData();
    } catch (err) {
      showToast(t('Failed to save subscription plan.'), 'error');
    }
  };

  const handleTogglePlanStatus = async (plan) => {
    const pId = plan.id || plan._id;
    try {
      await api.patch(`/super-admin/plans/${pId}/status`);
      showToast(t('Plan status updated!'), 'success');
      fetchInitialData();
    } catch (err) {
      showToast(t('Failed to update plan status.'), 'error');
    }
  };

  const handleDeletePlan = async (plan) => {
    const pId = plan.id || plan._id;
    if (!window.confirm(t('Delete plan "{{name}}"?', { name: plan.name }))) return;
    try {
      await api.delete(`/super-admin/plans/${pId}`);
      showToast(t('Plan removed.'), 'success');
      fetchInitialData();
    } catch (err) {
      showToast(t('Failed to delete plan.'), 'error');
    }
  };

  // --- Handlers for User Overview ---
  const handleToggleUserStatus = async (u) => {
    const uId = u.id || u._id;
    try {
      await api.patch(`/super-admin/users/${uId}/status`);
      showToast(t('User status updated successfully.'), 'success');
      fetchInitialData();
    } catch (err) {
      showToast(t('Failed to update user status.'), 'error');
    }
  };

  const handleViewUserDetails = (u) => {
    setSelectedUser(u);
    setViewUserModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Super Admin Dashboard Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold scrollbar-none">
        {[
          { id: 'saas-dashboard', label: t('Dashboard'), icon: Building2 },
          { id: 'businesses', label: t('Businesses / Tenants'), icon: Building2 },
          { id: 'subscriptions', label: t('Subscriptions'), icon: Layers },
          { id: 'users', label: t('User Overview'), icon: Users },
          { id: 'search', label: t('Global Search'), icon: Search },
          { id: 'audit', label: t('Audit Logs'), icon: FileText },
          { id: 'settings', label: t('Platform Settings'), icon: Settings },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`px-4 py-2.5 rounded-xl whitespace-nowrap flex items-center gap-2 transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT ROUTING */}
      {activeTab === 'saas-dashboard' && (
        <SuperAdminOverview
          stats={stats}
          onNavigateTab={(tabName, filterValue) => {
            if (tabName === 'businesses' && filterValue) {
              setBizStatusFilter(filterValue);
            }
            handleTabChange(tabName);
          }}
          onOpenExtendModal={handleOpenExtendModal}
          onSelectBusiness={handleOpenViewBusiness}
        />
      )}

      {activeTab === 'businesses' && (
        <BusinessManagement
          businesses={businesses}
          loading={loading}
          searchQuery={bizSearchQuery}
          setSearchQuery={setBizSearchQuery}
          statusFilter={bizStatusFilter}
          setStatusFilter={setBizStatusFilter}
          planFilter={bizPlanFilter}
          setPlanFilter={setBizPlanFilter}
          onOpenCreateModal={handleOpenCreateBusiness}
          onOpenEditModal={handleOpenEditBusiness}
          onOpenViewModal={handleOpenViewBusiness}
          onOpenExtendModal={handleOpenExtendModal}
          onOpenResetPasswordModal={handleOpenResetPassModal}
          onToggleStatus={handleToggleBusinessStatus}
          onImpersonate={handleImpersonate}
          onRefresh={fetchInitialData}
        />
      )}

      {activeTab === 'subscriptions' && (
        <SubscriptionManagement
          plans={plans}
          businesses={businesses}
          onOpenCreatePlanModal={handleOpenCreatePlan}
          onOpenEditPlanModal={handleOpenEditPlan}
          onTogglePlanStatus={handleTogglePlanStatus}
          onDeletePlan={handleDeletePlan}
          onOpenExtendModal={handleOpenExtendModal}
          onRefresh={fetchInitialData}
        />
      )}

      {activeTab === 'users' && (
        <UserOverview
          users={allUsers}
          loading={loading}
          onToggleUserStatus={handleToggleUserStatus}
          onViewUserDetails={handleViewUserDetails}
          onRefresh={fetchInitialData}
        />
      )}

      {activeTab === 'search' && (
        <SuperAdminSearch
          onSelectBusiness={(biz) => {
            setBizSearchQuery(biz.name || biz.businessName || '');
            handleTabChange('businesses');
          }}
          onSelectUser={(u) => {
            handleTabChange('users');
          }}
        />
      )}

      {activeTab === 'audit' && (
        <SuperAdminAuditLogs
          logs={auditLogs}
          loading={loading}
          onRefresh={fetchInitialData}
        />
      )}

      {activeTab === 'settings' && (
        <PlatformSettings
          onShowToast={showToast}
        />
      )}

      {/* ======================================================== */}
      {/* 1. REGISTER NEW BUSINESS MODAL                           */}
      {/* ======================================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                {t('Register New Business (Tenant)')}
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DialogAlert alert={modalAlert} onDismiss={() => setModalAlert(null)} />

            <form onSubmit={handleCreateBusinessSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Business Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('e.g. Bismillah Commission Shop')}
                    value={createFormData.name}
                    onChange={(e) => {
                      setCreateFormData({ ...createFormData, name: e.target.value });
                      handleSuggestArthiCode(e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Arthi Code (2-5 Chars)')}
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder={t('e.g. BCS')}
                    value={createFormData.arthiCode}
                    onChange={(e) => setCreateFormData({ ...createFormData, arthiCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono uppercase dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Owner / Admin Full Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('e.g. Haji Muhammad Raheel')}
                    value={createFormData.ownerName}
                    onChange={(e) => setCreateFormData({ ...createFormData, ownerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Owner Email (Login Username)')} *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="owner@mandi.pk"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Password')} *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Phone / WhatsApp')}
                  </label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={createFormData.phone}
                    onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('City / Mandi Location')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('e.g. Lahore Vegetable Market')}
                    value={createFormData.city}
                    onChange={(e) => setCreateFormData({ ...createFormData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Address / Shop #')}
                  </label>
                  <input
                    type="text"
                    placeholder="Shop #12, Block C"
                    value={createFormData.address}
                    onChange={(e) => setCreateFormData({ ...createFormData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Initial Subscription Plan')}
                  </label>
                  <select
                    value={createFormData.plan}
                    onChange={(e) => setCreateFormData({ ...createFormData, plan: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  >
                    <option value="Trial">{t('Trial (30 Days)')}</option>
                    <option value="Basic">{t('Basic')}</option>
                    <option value="Pro">{t('Pro')}</option>
                    <option value="Enterprise">{t('Enterprise')}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Subscription Expiry Date')}
                  </label>
                  <input
                    type="date"
                    value={createFormData.subscriptionExpiresAt}
                    onChange={(e) => setCreateFormData({ ...createFormData, subscriptionExpiresAt: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition"
                >
                  {t('Register Business')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EDIT BUSINESS INFORMATION MODAL                       */}
      {/* ======================================================== */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                {t('Edit Business Information')}
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <DialogAlert alert={modalAlert} onDismiss={() => setModalAlert(null)} />

            <form onSubmit={handleEditBusinessSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Business Name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Registration Code')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.businessCode}
                    onChange={(e) => setEditFormData({ ...editFormData, businessCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Owner Name')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.ownerName}
                    onChange={(e) => setEditFormData({ ...editFormData, ownerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Email Address')}
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Phone / Mobile')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('City')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Subscription Plan')}
                  </label>
                  <select
                    value={editFormData.plan}
                    onChange={(e) => setEditFormData({ ...editFormData, plan: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  >
                    <option value="Trial">{t('Trial')}</option>
                    <option value="Basic">{t('Basic')}</option>
                    <option value="Pro">{t('Pro')}</option>
                    <option value="Enterprise">{t('Enterprise')}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Current Status')}
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  >
                    <option value="Active">{t('Active')}</option>
                    <option value="Suspended">{t('Suspended')}</option>
                    <option value="Expired">{t('Expired')}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Expiry Date')}
                  </label>
                  <input
                    type="date"
                    value={editFormData.subscriptionExpiresAt}
                    onChange={(e) => setEditFormData({ ...editFormData, subscriptionExpiresAt: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition"
                >
                  {t('Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. VIEW BUSINESS DETAILS MODAL                           */}
      {/* ======================================================== */}
      {viewModalOpen && selectedBusiness && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedBusiness.name || selectedBusiness.businessName}
                </h3>
                <p className="text-xs text-slate-500 font-mono"><span>{t('Tenant ID')}:</span> <bdi dir="ltr">{selectedBusiness.tenantId}</bdi></p>
              </div>
              <button onClick={() => setViewModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Registration Number')}</span>
                <strong className="text-slate-900 dark:text-white font-mono text-sm">
                  {selectedBusiness.businessCode || 'BUS-1001'}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Arthi Code')}</span>
                <strong className="text-slate-900 dark:text-white font-mono text-sm">
                  {selectedBusiness.arthiCode || 'N/A'}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Current Status')}</span>
                <span className={`inline-block font-bold ${
                  selectedBusiness.status === 'Active' ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {t(selectedBusiness.status)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Owner Name')}</span>
                <strong className="text-slate-900 dark:text-white">{selectedBusiness.ownerName}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Contact Email')}</span>
                <strong className="text-slate-900 dark:text-white" dir="ltr">{selectedBusiness.email}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Phone Number')}</span>
                <strong className="text-slate-900 dark:text-white">{selectedBusiness.phone || 'N/A'}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Location')}</span>
                <strong className="text-slate-900 dark:text-white">{selectedBusiness.city || selectedBusiness.address || 'Pakistan'}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Subscription Plan</span>
                <strong className="text-indigo-600 font-bold">{t(selectedBusiness.plan || selectedBusiness.subscriptionPlan)}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Expiry Date')}</span>
                <strong className="text-slate-900 dark:text-white">{selectedBusiness.subscriptionExpiresAt || selectedBusiness.subscriptionExpiryDate}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Registered Date')}</span>
                <strong className="text-slate-900 dark:text-white">{selectedBusiness.registrationDate || selectedBusiness.createdAt || 'N/A'}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Total Users')}</span>
                <strong className="text-slate-900 dark:text-white">{selectedBusiness.totalUsers ?? 1}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">{t('Last Activity')}</span>
                <strong className="text-slate-900 dark:text-white">{selectedBusiness.lastActivity || 'N/A'}</strong>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <button
                onClick={() => {
                  setViewModalOpen(false);
                  handleImpersonate(selectedBusiness);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                Support Impersonation Login
              </button>
              <button
                onClick={() => setViewModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. EXTEND SUBSCRIPTION / CHANGE PLAN MODAL               */}
      {/* ======================================================== */}
      {extendModalOpen && selectedBusiness && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Extend Subscription
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedBusiness.name}</p>
              </div>
              <button onClick={() => setExtendModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExtendSubscriptionSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subscription Plan
                </label>
                <select
                  value={extendFormData.subscriptionPlan}
                  onChange={(e) => setExtendFormData({ ...extendFormData, subscriptionPlan: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                >
                  <option value="Trial">Trial</option>
                  <option value="Basic">Basic</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              {/* Quick Duration Buttons */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Quick Extension Presets
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '+7 Days', days: 7 },
                    { label: '+15 Days', days: 15 },
                    { label: '+30 Days', days: 30 },
                    { label: '+1 Year', days: 365 },
                  ].map(p => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => {
                        const base = new Date();
                        base.setDate(base.getDate() + p.days);
                        setExtendFormData({
                          ...extendFormData,
                          extendDays: p.days,
                          subscriptionExpiryDate: base.toISOString().split('T')[0]
                        });
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-amber-500 hover:text-white rounded-lg font-semibold transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Expiry Date
                </label>
                <input
                  type="date"
                  required
                  value={extendFormData.subscriptionExpiryDate}
                  onChange={(e) => setExtendFormData({ ...extendFormData, subscriptionExpiryDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExtendModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow transition"
                >
                  Confirm & Renew
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. RESET OWNER PASSWORD MODAL                            */}
      {/* ======================================================== */}
      {resetPassModalOpen && selectedBusiness && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-600" />
                Reset Owner Password
              </h3>
              <button onClick={() => setResetPassModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassSubmit} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-500">
                Reset password for owner <strong>{selectedBusiness.email}</strong>.
              </p>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password (Min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={resetPassData.newPassword}
                  onChange={(e) => setResetPassData({ newPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPassModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow transition"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. CREATE / EDIT PLAN MODAL                              */}
      {/* ======================================================== */}
      {planModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                {selectedPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
              </h3>
              <button onClick={() => setPlanModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePlanFormSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pro"
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Duration Preset
                  </label>
                  <input
                    type="text"
                    placeholder="1 Month / 1 Year"
                    value={planFormData.duration}
                    onChange={(e) => setPlanFormData({ ...planFormData, duration: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Price (PKR)
                  </label>
                  <input
                    type="number"
                    value={planFormData.priceMonthly}
                    onChange={(e) => setPlanFormData({ ...planFormData, priceMonthly: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Annual Price (PKR)
                  </label>
                  <input
                    type="number"
                    value={planFormData.priceAnnual}
                    onChange={(e) => setPlanFormData({ ...planFormData, priceAnnual: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Max Users
                  </label>
                  <input
                    type="number"
                    value={planFormData.maxUsers}
                    onChange={(e) => setPlanFormData({ ...planFormData, maxUsers: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Max Products Catalog
                  </label>
                  <input
                    type="number"
                    value={planFormData.maxProducts}
                    onChange={(e) => setPlanFormData({ ...planFormData, maxProducts: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planFormData.features?.logistics}
                    onChange={(e) => setPlanFormData({
                      ...planFormData,
                      features: { ...planFormData.features, logistics: e.target.checked }
                    })}
                  />
                  <span>Enable Logistics & Truck Module</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planFormData.features?.returnsModule}
                    onChange={(e) => setPlanFormData({
                      ...planFormData,
                      features: { ...planFormData.features, returnsModule: e.target.checked }
                    })}
                  />
                  <span>Enable Returns & Crates Management</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planFormData.features?.prioritySupport}
                    onChange={(e) => setPlanFormData({
                      ...planFormData,
                      features: { ...planFormData.features, prioritySupport: e.target.checked }
                    })}
                  />
                  <span>24/7 Dedicated Priority Phone Support</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition"
                >
                  {selectedPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. VIEW USER DETAILS MODAL                               */}
      {/* ======================================================== */}
      {viewUserModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600" />
                User Account Overview
              </h3>
              <button onClick={() => setViewUserModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">User Full Name</span>
                <strong className="text-slate-900 dark:text-white text-sm">{selectedUser.name}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Email (Login ID)</span>
                <strong className="text-slate-900 dark:text-white">{selectedUser.email}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Role</span>
                <strong className="text-cyan-600 font-bold">{selectedUser.role}</strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Associated Business</span>
                <strong className="text-slate-900 dark:text-white">{selectedUser.businessName}</strong>
                <span className="block text-[10px] text-slate-400 font-mono mt-0.5">Tenant: {selectedUser.tenantId}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Account Status</span>
                <strong className={selectedUser.status === 'Active' ? 'text-emerald-600' : 'text-red-600'}>
                  {selectedUser.status}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Last Login / Activity</span>
                <strong className="text-slate-900 dark:text-white">{selectedUser.lastLogin || 'N/A'}</strong>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setViewUserModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
