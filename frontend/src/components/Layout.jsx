import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { TAB_TO_PATH, PATH_TO_TAB } from '../utils/routes.js';
import LanguageSwitcher from './common/LanguageSwitcher.jsx';
import {
  Home, Users, ShoppingBag, Boxes, FileText, DollarSign,
  LogOut, Menu, X, ShieldAlert, Clock, Sun, Moon, Activity, Settings, Truck, Briefcase, Trash2, BarChart2, Calendar, Layers, RotateCcw,
  Building2, Search
} from 'lucide-react';
import logo from "../../assets/logo.png";
export default function Layout({ children, currentTab: propCurrentTab, setCurrentTab: propSetCurrentTab }) {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTabFromPath = PATH_TO_TAB[location.pathname] || propCurrentTab || 'home';
  const currentTab = activeTabFromPath;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(currentTab.startsWith('settings'));
  const [isSalesOpen, setIsSalesOpen] = useState(currentTab.startsWith('sales'));

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNavigateTab = (tabId) => {
    const path = TAB_TO_PATH[tabId] || '/dashboard';
    if (propSetCurrentTab) {
      propSetCurrentTab(tabId);
    }
    navigate(path);
    setSidebarOpen(false);
  };


  if (!user) return null;

  const adminMenu = [
    { id: 'home', name: 'Home', icon: Home },
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'logistics', name: 'Truck Logs & Logistics', icon: Truck },
    { id: 'clerks', name: 'Register Munshi', icon: Users },
    { id: 'employees', name: 'Employee & Salary', icon: Users },
    { id: 'suppliers', name: 'Beopari Khata', icon: Users },
    { id: 'customers', name: 'Customers Khata', icon: Users },
    { id: 'products', name: 'Product Catalog', icon: ShoppingBag },
    { id: 'stock', name: 'Lot Supplies', icon: Boxes },
    { id: 'sales', name: 'Sales Lots', icon: DollarSign },
    { id: 'returns', name: 'Returns', icon: RotateCcw },
    { id: 'pay_or_receive', name: 'Pay or Receive', icon: DollarSign },
    { id: 'payments', name: 'Daily Hisab', icon: DollarSign },
    { id: 'reports', name: 'Reports', icon: BarChart2 },
    { id: 'audit', name: 'Audit & Log Activity', icon: Activity },
    { id: 'deleted_users', name: 'Deleted Users / Trash', icon: Trash2 },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const clerkMenu = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'logistics', name: 'Truck Logs & Logistics', icon: Truck },
    { id: 'stock', name: 'Beopari/Grower Stock', icon: Boxes },
    { id: 'sales', name: 'Sales Transactions', icon: DollarSign },
    { id: 'returns', name: 'Returns', icon: RotateCcw },
    { id: 'products', name: 'Product Catalog', icon: ShoppingBag },
    { id: 'pay_or_receive', name: 'Pay or Receive', icon: DollarSign },
    { id: 'payments', name: 'Daily Hisab', icon: DollarSign },
    { id: 'reports', name: 'Reports', icon: BarChart2 },
  ];

  const customerMenu = [
    { id: 'dashboard', name: 'My Dashboard', icon: Activity },
    { id: 'purchases', name: 'Purchase History', icon: ShoppingBag },
    { id: 'daywise', name: 'Day Wise Report', icon: Calendar },
    { id: 'ledger', name: 'My General Ledger', icon: FileText },
  ];

  const supplierMenu = [
    { id: 'dashboard', name: 'My Dashboard', icon: Activity },
    { id: 'supplies', name: 'Supply History', icon: Boxes },
    { id: 'lot_report', name: 'Lot Wise Report', icon: Layers },
    { id: 'ledger', name: 'My General Ledger', icon: FileText },
  ];

  const superAdminMenu = [
    { id: 'saas-dashboard', name: 'Dashboard', icon: Activity },
    { id: 'businesses', name: 'Businesses / Tenants', icon: Building2 },
    { id: 'subscriptions', name: 'Subscriptions', icon: Layers },
    { id: 'users', name: 'Users Overview', icon: Users },
    { id: 'search', name: 'Global Search', icon: Search },
    { id: 'audit', name: 'Audit Logs', icon: FileText },
    { id: 'settings', name: 'Platform Settings', icon: Settings },
  ];

  const menuItems = user.role === 'super_admin' ? superAdminMenu
    : user.role === 'Admin' ? adminMenu
      : user.role === 'Clerk' ? clerkMenu
        : user.role === 'Customer' ? customerMenu
          : supplierMenu;

  return (
    <div className={`min-h-screen font-sans flex transition-colors duration-200 ${theme === 'dark' ? 'bg-[#0F172A] text-slate-100' : 'bg-[#F8FAFC] text-slate-800'}`}>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar navigation */}
      <aside className={`fixed inset-y-0 w-64 transition-transform duration-300 transform z-50 h-full
        ${sidebarOpen ? 'translate-x-0' : language === 'ur' ? 'translate-x-full' : '-translate-x-full'}
        lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 flex flex-col ${theme === 'dark' ? 'bg-[#222c41]' : 'bg-[#3029ae]'} text-white
        ${language === 'ur' ? 'right-0 border-l border-r-0' : 'left-0 border-r border-l-0'} border-[#1E293B]/20`}>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-white rounded-xl shadow-md border border-emerald-500/30 flex items-center justify-center shrink-0">
              <img
                src={logo}
                alt="Mandi OS logo"
                referrerPolicy="no-referrer"
                className="h-8 w-8 object-contain rounded-lg"
              />
            </div>
            <div className="flex ">
              <h1 className="text-sm font-bold tracking-tight uppercase text-white font-display">{t("Mandi OS")}</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
                ERP
              </span>
              {/* <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">{t("ERP Broker System")}</p> */}
            </div>
          </div>
          <button className="lg:hidden p-1 rounded-md opacity-70 hover:opacity-100" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto animate-fade-in">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            if (item.id === 'settings' && user.role !== 'super_admin') {
              const isAnySettingActive = currentTab.startsWith('settings');
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => {
                      setIsSettingsOpen(!isSettingsOpen);
                      handleNavigateTab('settings_units');
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-150 border-l-4 ${isAnySettingActive
                        ? 'bg-white/5 text-white border-blue-400 opacity-100'
                        : 'text-white hover:bg-white/5 border-transparent opacity-80 hover:opacity-100'
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon size={16} className="text-white opacity-70" />
                      <span>{t(item.name)}</span>
                    </div>
                    <span className="text-[10px] opacity-60">{isSettingsOpen ? '▼' : '▶'}</span>
                  </button>

                  {isSettingsOpen && (
                    <div className="pl-6 space-y-1 transition-all text-white">
                      {[
                        { subId: 'units', subName: 'Unit Management' },
                        { subId: 'expenses', subName: 'Expense Categories' },
                        { subId: 'payments', subName: 'Payment Methods' },
                        { subId: 'invoice', subName: 'Invoice Layout' },
                        { subId: 'password', subName: 'Change Password' },
                      ].map(sub => {
                        const isSubActive = currentTab === `settings_${sub.subId}`;
                        return (
                          <button
                            key={sub.subId}
                            onClick={() => handleNavigateTab(`settings_${sub.subId}`)}
                            className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${isSubActive
                                ? 'text-white bg-white/5'
                                : 'text-white hover:bg-white/5'
                              }`}
                          >
                            • {t(sub.subName)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.id === 'sales') {
              const isAnySalesActive = currentTab.startsWith('sales');
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => {
                      setIsSalesOpen(!isSalesOpen);
                      handleNavigateTab('sales_batch');
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-150 border-l-4 ${isAnySalesActive
                        ? 'bg-white/5 text-white border-blue-400 opacity-100'
                        : 'text-white hover:bg-white/5 border-transparent opacity-80 hover:opacity-100'
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon size={16} className="text-white opacity-70" />
                      <span>{t(item.name)}</span>
                    </div>
                    <span className="text-[10px] opacity-60">{isSalesOpen ? '▼' : '▶'}</span>
                  </button>

                  {isSalesOpen && (
                    <div className="pl-6 space-y-1 transition-all text-white">
                      {/* <div className="text-[9px] font-black tracking-widest text-slate-500 uppercase px-4 pt-2 pb-1">
                        {t('Record Sales')}
                      </div> */}
                      <button
                        onClick={() => handleNavigateTab('sales_batch')}
                        className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${currentTab === 'sales_batch' || currentTab === 'sales'
                            ? 'text-white bg-white/5'
                            : 'text-white hover:bg-white/5'
                          }`}
                      >
                        • {t('Record Batch Sale')}
                      </button>

                      <button
                        onClick={() => handleNavigateTab('sales_boli')}
                        className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${currentTab === 'sales_boli'
                            ? 'text-white bg-white/5'
                            : 'text-white hover:bg-white/5'
                          }`}
                      >
                        • {t('Lot Sale / Boli Session')}
                      </button>

                      <button
                        onClick={() => handleNavigateTab('sales_batch_custom_rate')}
                        className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${currentTab === 'sales_batch_custom_rate'
                            ? 'text-white bg-white/5'
                            : 'text-white hover:bg-white/5'
                          }`}
                      >
                        • {t('Batch Sale (Custom Rate)')}
                      </button>

                      {/* <div className="text-[9px] font-black tracking-widest text-slate-500 uppercase px-4 pt-2 pb-1">
                        {t('Sold Consignments')}
                      </div> */}
                      <button
                        onClick={() => handleNavigateTab('sales_sold_consignments')}
                        className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${currentTab === 'sales_sold_consignments'
                            ? 'text-white bg-white/5'
                            : 'text-white hover:bg-white/5'
                          }`}
                      >
                        • {t('Sold Consignments')}
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleNavigateTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-150 border-l-4 ${isActive
                    ? 'bg-white/20 text-white border-blue-950 opacity-100'
                    : 'text-white hover:bg-white/5 border-transparent opacity-80 hover:opacity-100'
                  }`}
              >
                <Icon size={16} className="text-white opacity-70" />
                <span>{t(item.name)}</span>
              </button>
            );
          })}
        </nav>

        {/* User Badge Profile Section */}
        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => handleNavigateTab('business_profile')}
            className={`w-full text-left p-3 rounded-xl flex items-center space-x-3 transition-all cursor-pointer border ${currentTab === 'business_profile' || currentTab === 'business'
                ? 'bg-[#4F46E5]/20 border-[#4F46E5]'
                : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
              }`}
            title={t("View Business Profile")}
          >
            <div className="w-10 h-10 rounded-full bg-[#4F46E5]/20 text-[#818CF8] flex items-center justify-center font-bold text-base shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate leading-tight text-white hover:text-indigo-300 transition-colors">
                {user?.name}
              </p>
              <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase leading-none ${user?.role === 'Admin' ? 'bg-rose-500/20 text-rose-400' :
                  user?.role === 'Clerk' ? 'bg-amber-500/20 text-amber-400' :
                    user?.role === 'Customer' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-purple-500/20 text-purple-400'
                }`}>
                {t(user?.role)}
              </span>
            </div>
          </button>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full mt-4 flex items-center justify-center bg-red-500 space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-500/30 text-white hover:bg-red-600 transition-all"
          >
            <LogOut size={16} />
            <span>{t("Sign Out")}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Sticky Header */}
        <header className={`sticky top-0 z-30 border-b flex items-center justify-between px-6 py-4 backdrop-blur-md transition-colors duration-200
          ${theme === 'dark' ? 'bg-[#0F172A]/85 border-slate-800/80 text-white' : 'bg-white/85 border-slate-200 text-[#1E293B]'}`}>

          <div className="flex items-center space-x-4">
            <button
              className={`lg:hidden p-2 rounded-xl border transition-all ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800 text-white' : 'border-slate-200 hover:bg-slate-100 text-[#1E293B]'
                }`}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-lg font-bold tracking-tight font-display"> {t("Welcome to MandiOS")}</h2>
              <p className="text-xs opacity-60 font-medium">{t("Sabzi & Fruit Mandi ka Complete Digital System")}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Live Clock */}
            <div className={`hidden md:flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all
              ${theme === 'dark' ? 'bg-[#1E293B] border-slate-800 text-slate-300' : 'bg-[#F1F5F9] border-slate-200 text-[#475569]'}`}>
              <Clock size={14} className="text-[#4F46E5] animate-pulse" />
              <span dir="ltr">{time.toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-PK')}</span>
              <span className="opacity-40">•</span>
              <span dir="ltr">{time.toLocaleTimeString(language === 'ur' ? 'ur-PK' : 'en-PK')}</span>
            </div>
<div className="flex items-center gap-3">
  <LanguageSwitcher />
</div>
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-full border transition-all hover:scale-105 active:scale-95
                ${theme === 'dark' ? 'bg-[#1E293B] border-slate-800 text-amber-400' : 'bg-[#F1F5F9] border-slate-200 text-slate-600'}`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Tab Content Panel */}
        <main className="p-6 max-w-7xl w-full mx-auto flex-1">
          {children}
        </main>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                <LogOut size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t("Confirm Sign Out")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("Are you sure you want to sign out?")}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-300 transition-colors"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 font-semibold text-xs text-white shadow-lg shadow-red-500/20 transition-all flex items-center justify-center space-x-1.5"
              >
                <LogOut size={14} />
                <span>{t("Sign Out")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
