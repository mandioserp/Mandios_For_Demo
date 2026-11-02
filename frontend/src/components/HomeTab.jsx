import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Search, X, Users, ShoppingBag, Boxes, DollarSign, Percent, Truck, Activity,
  ArrowUpRight, ArrowDownRight, Clock, Calendar, ChevronRight, Loader2, RefreshCw,
  User, CheckSquare, Layers, HelpCircle, FileText, ArrowRight
} from 'lucide-react';

export default function HomeTab({ setCurrentTab }) {
  const { t } = useLanguage();
  const { user } = useAuth();

  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All'); // 'All', 'Customers', 'Suppliers', 'Products', 'Trucks', 'Lots', 'Invoices', 'Payments', 'Expenses', 'Users'
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('mandi_search_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Recent Transactions States
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('All'); // 'All', 'Today', 'Week', 'Month'
  const [moduleFilter, setModuleFilter] = useState('All'); // 'All', 'Sales', 'Purchases', 'Expenses', 'Payments', 'Customers', 'Suppliers', 'User', 'Clerk'
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Done', 'Cancelled'

  // UI States
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [focusedResultIndex, setFocusedResultIndex] = useState(-1);

  // Refs
  const searchInputRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // Quick Search Shortcut Configuration
  const shortcuts = [
    { label: 'Search Customer', filter: 'Customers', gradient: 'from-blue-500/10 to-indigo-500/10 hover:border-blue-500/40 text-blue-400' },
    { label: 'Search Beopari/Grower', filter: 'Suppliers', gradient: 'from-cyan-500/10 to-teal-500/10 hover:border-cyan-500/40 text-cyan-400' },
    { label: 'Search Product', filter: 'Products', gradient: 'from-emerald-500/10 to-green-500/10 hover:border-emerald-500/40 text-emerald-400' },
    { label: 'Search Truck', filter: 'Trucks', gradient: 'from-amber-500/10 to-orange-500/10 hover:border-amber-500/40 text-amber-400' },
    { label: 'Search Invoice', filter: 'Invoices', gradient: 'from-rose-500/10 to-pink-500/10 hover:border-rose-500/40 text-rose-400' },
    { label: 'Search Lot', filter: 'Lots', gradient: 'from-indigo-500/10 to-violet-500/10 hover:border-indigo-500/40 text-indigo-400' },
    { label: 'Search Payments', filter: 'Payments', gradient: 'from-purple-500/10 to-fuchsia-500/10 hover:border-purple-500/40 text-purple-400' },
    { label: 'Search Expenses', filter: 'Expenses', gradient: 'from-red-500/10 to-orange-500/10 hover:border-red-500/40 text-red-400' },
  ];

  // Fetch Recent Activities
  const fetchRecentActivities = async () => {
    setActivitiesLoading(true);
    try {
      const res = await api.get('/recent-activities');
      const data = res.data;
      if (Array.isArray(data)) {
        setRecentActivities(data);
      } else if (data && Array.isArray(data.activities)) {
        setRecentActivities(data.activities);
      } else {
        setRecentActivities([]);
      }
    } catch (err) {
      console.warn('Error fetching activities:', err?.message || err);
      setRecentActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivities();
    // Auto refresh every 30 seconds for dynamic updates without manual refresh
    const interval = setInterval(fetchRecentActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  // Debounced Search trigger
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      setFocusedResultIndex(-1);
      return;
    }

    setSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(trimmed)}`);
        setSearchResults(res.data);
        setFocusedResultIndex(-1);
      } catch (err) {
        console.error('Search query error:', err);
      } finally {
        setSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Handle click on Quick Search shortcut
  const handleShortcutClick = (filter) => {
    setSelectedFilter(filter);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Search History helpers
  const saveToHistory = (query) => {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    setSearchHistory(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== cleanQuery.toLowerCase());
      const updated = [cleanQuery, ...filtered].slice(0, 5); // store up to 5 entries
      localStorage.setItem('mandi_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = (e) => {
    e.stopPropagation();
    setSearchHistory([]);
    localStorage.removeItem('mandi_search_history');
  };

  // Filter & Flatten search results for keyboard navigation
  const getFilteredCategories = () => {
    if (!searchResults) return {};
    if (selectedFilter === 'All') return searchResults;

    const keyMap = {
      'Customers': 'customers',
      'Suppliers': 'suppliers',
      'Products': 'products',
      'Trucks': 'trucks',
      'Lots': 'lots',
      'Invoices': 'invoices',
      'Payments': 'payments',
      'Expenses': 'expenses',
      'Users': 'users'
    };

    const targetKey = keyMap[selectedFilter];
    const filteredResults = {};
    Object.keys(searchResults).forEach(key => {
      filteredResults[key] = key === targetKey ? searchResults[key] : [];
    });
    return filteredResults;
  };

  const getFlatResultsList = () => {
    const filteredCats = getFilteredCategories();
    const flat = [];
    Object.keys(filteredCats).forEach(cat => {
      if (Array.isArray(filteredCats[cat])) {
        filteredCats[cat].forEach(item => {
          flat.push({ ...item, categoryKey: cat });
        });
      }
    });
    return flat;
  };

  const flatResults = getFlatResultsList();

  // Keyboard navigation event handler
  const handleKeyDown = (e) => {
    if (!flatResults || flatResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedResultIndex(prev => {
        const nextIdx = prev + 1 >= flatResults.length ? 0 : prev + 1;
        // Scroll into view
        const activeElem = resultsContainerRef.current?.children[nextIdx];
        if (activeElem) {
          activeElem.scrollIntoView({ block: 'nearest' });
        }
        return nextIdx;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedResultIndex(prev => {
        const nextIdx = prev - 1 < 0 ? flatResults.length - 1 : prev - 1;
        // Scroll into view
        const activeElem = resultsContainerRef.current?.children[nextIdx];
        if (activeElem) {
          activeElem.scrollIntoView({ block: 'nearest' });
        }
        return nextIdx;
      });
    } else if (e.key === 'Enter') {
      if (focusedResultIndex >= 0 && focusedResultIndex < flatResults.length) {
        e.preventDefault();
        const selected = flatResults[focusedResultIndex];
        setSelectedDetailItem(selected);
        saveToHistory(searchQuery);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
      setFocusedResultIndex(-1);
      searchInputRef.current?.blur();
    }
  };

  // Timeline Activity Filter Logic
  const getFilteredActivities = () => {
    const activitiesList = Array.isArray(recentActivities) ? recentActivities : [];
    return activitiesList.filter(act => {
      if (!act) return false;
      // 1. Date Filter
      const dateObj = new Date(act.timestamp);
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      let dateMatch = true;
      if (dateFilter === 'Today') {
        dateMatch = dateObj >= today;
      } else if (dateFilter === 'Week') {
        dateMatch = dateObj >= oneWeekAgo;
      } else if (dateFilter === 'Month') {
        dateMatch = dateObj >= oneMonthAgo;
      }

      // 2. Module / Type Filter
      let moduleMatch = true;
      if (moduleFilter !== 'All') {
        if (moduleFilter === 'Sales') {
          moduleMatch = act.module === 'Sales';
        } else if (moduleFilter === 'Purchases') {
          moduleMatch = act.module === 'Purchases';
        } else if (moduleFilter === 'Expenses') {
          moduleMatch = act.module === 'Expenses';
        } else if (moduleFilter === 'Payments') {
          moduleMatch = act.module === 'Payments';
        } else if (moduleFilter === 'Customers') {
          moduleMatch = act.module === 'Customers';
        } else if (moduleFilter === 'Suppliers') {
          moduleMatch = act.module === 'Suppliers';
        } else if (moduleFilter === 'User' || moduleFilter === 'Clerk') {
          moduleMatch = act.user?.toLowerCase() !== 'admin';
        }
      }

      // 3. Status Filter
      let statusMatch = true;
      if (statusFilter !== 'All') {
        const isCancelled = act.status === 'Cancelled' || 
                            String(act.type || '').toLowerCase().includes('cancelled') || 
                            String(act.type || '').toLowerCase().includes('deleted');
        if (statusFilter === 'Cancelled') {
          statusMatch = isCancelled;
        } else if (statusFilter === 'Done') {
          statusMatch = !isCancelled;
        }
      }

      return dateMatch && moduleMatch && statusMatch;
    });
  };

  const filteredActivities = getFilteredActivities();

  // Helper to format currency
  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '';
    return `Rs. ${Number(val).toLocaleString()}`;
  };

  // Helper to retrieve color classes for each activity type
  const getActivityStyles = (type) => {
    switch (type) {
      case 'Sale Created':
        return {
          bg: 'bg-white dark:bg-[#1E293B] border border-slate-200/5 text-emerald-500 dark:text-white',
          dot: 'bg-emerald-500 ring-emerald-500/30',
          icon: FileText
        };
      case 'Lot Created':
      case 'Purchase Created':
        return {
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400',
          dot: 'bg-blue-500 ring-blue-500/30',
          icon: Boxes
        };
      case 'Expense Added':
        return {
          bg: 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400',
          dot: 'bg-rose-500 ring-rose-500/30',
          icon: Percent
        };
      case 'Payment Received':
        return {
          bg: 'bg-purple-500/10 border-purple-500/20 text-purple-500 dark:text-purple-400',
          dot: 'bg-purple-500 ring-purple-500/30',
          icon: DollarSign
        };
      case 'Payment Paid':
        return {
          bg: 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-500 dark:text-fuchsia-400',
          dot: 'bg-fuchsia-500 ring-fuchsia-500/30',
          icon: DollarSign
        };
      case 'Customer Added':
        return {
          bg: 'bg-orange-500/10 border-orange-500/20 text-orange-500 dark:text-orange-400',
          dot: 'bg-orange-500 ring-orange-500/30',
          icon: Users
        };
      case 'Supplier Added':
        return {
          bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500 dark:text-cyan-400',
          dot: 'bg-cyan-500 ring-cyan-500/30',
          icon: Users
        };
      case 'Product Added':
        return {
          bg: 'bg-teal-500/10 border-teal-500/20 text-teal-500 dark:text-teal-400',
          dot: 'bg-teal-500 ring-teal-500/30',
          icon: ShoppingBag
        };
      case 'Truck Received':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-500 dark:text-amber-400',
          dot: 'bg-amber-500 ring-amber-500/30',
          icon: Truck
        };
      default:
        return {
          bg: 'bg-slate-500/10 border-slate-500/20 text-slate-500 dark:text-slate-400',
          dot: 'bg-slate-500 ring-slate-500/30',
          icon: Activity
        };
    }
  };

  // Navigates directly from detail modal to the specific parent tab
  const handleGoToModule = (moduleName) => {
    setSelectedDetailItem(null);
    const tabMap = {
      'Customers': 'customers',
      'Suppliers': 'suppliers',
      'Products': 'products',
      'Trucks': 'logistics',
      'Lots': 'stock',
      'Purchases': 'stock',
      'Invoices': 'sales',
      'Sales': 'sales',
      'Payments': 'payments',
      'Expenses': 'dashboard', // expenses rendered inside Dashboard SubTab
      'Clerks': 'clerks',
      'Users': 'audit',
      'User': 'audit',
    };
    const tabId = tabMap[moduleName] || 'dashboard';
    setCurrentTab(tabId);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* 1. Header welcome banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4  p-6 rounded-3xl bg-[#3029ae] dark:bg-black border border-slate-200/5 dark:border-slate-800/40 shadow-inner">
        <div className="space-y-1">
        
          <h2 className="text-2xl font-black tracking-tight font-display text-white">
            {t("Assalam-o-Alaikum")}, {user.name}
          </h2>
          <p className="text-xs text-zinc-100 dark:text-slate-400 font-medium">
            {t("Mandi Brokerage Business Command Hub. Manage shipments, auctions, and accounting in one place.")}
          </p>
        </div>
        <button
          onClick={fetchRecentActivities}
          className="self-start md:self-auto flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500 text-xs font-bold shadow-sm transition-all"
        >
          <RefreshCw size={14} className={activitiesLoading ? 'animate-spin text-indigo-500' : 'text-slate-400'} />
          <span>{t("Refresh Live Data")}</span>
        </button>
      </div>

      {/* 2. GLOBAL SEARCH AREA */}
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-black dark:text-white">{t("Global Search & Intelligence")}</h3>
          {/* <p className="text-xs text-slate-400 dark:text-slate-500">{t("Instantly lookup ledger entries, lot shipments, sales tickets, phone numbers, or users.")}</p> */}
        </div>

        {/* Search Bar + Filter select */}
        <div className="relative flex flex-col sm:flex-row gap-2">
          
          {/* Dropdown Filter */}
          <div className="relative">
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="w-full sm:w-44 h-12 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl px-4 text-xs font-bold uppercase tracking-wider outline-none text-slate-700 dark:text-slate-300 focus:border-[#4F46E5] appearance-none cursor-pointer"
            >
              {['All', 'Customers', 'Suppliers', 'Products', 'Trucks', 'Lots', 'Invoices', 'Payments', 'Expenses', 'Users'].map(f => (
                <option key={f} value={f}>{t(f)}</option>
              ))}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-slate-400">▼</span>
          </div>

          {/* Search Input Box */}
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {searching ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Search size={18} />}
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("Search by customer, invoice ID, truck, lot, CNIC, mobile number, user...")}
              className="w-full h-12 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-2xl pl-12 pr-12 text-sm outline-none focus:border-[#4F46E5] placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-white font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* SEARCH RESULTS DROPDOWN GRID */}
        {searchQuery.trim() && (
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl max-h-[500px] overflow-y-auto animate-fade-in divide-y divide-slate-100 dark:divide-slate-800/50">
            {searching && !searchResults && (
              <div className="p-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Loader2 size={24} className="animate-spin text-indigo-500" />
                <span className="text-xs font-semibold">{t("Querying all mandi modules simultaneously...")}</span>
              </div>
            )}

            {/* Flat results mapping */}
            {searchResults && flatResults.length > 0 ? (
              <div ref={resultsContainerRef} className="divide-y divide-slate-50 dark:divide-slate-800/30">
                {flatResults.map((item, idx) => {
                  const isFocused = idx === focusedResultIndex;
                  return (
                    <div
                      key={`${item.categoryKey}-${item.id}`}
                      onClick={() => {
                        setSelectedDetailItem(item);
                        saveToHistory(searchQuery);
                      }}
                      className={`p-4 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2
                        ${isFocused ? 'bg-indigo-500/10 dark:bg-indigo-500/5 border-l-4 border-indigo-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/10 border-l-4 border-transparent'}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-xl text-xs flex items-center justify-center font-bold ${getActivityStyles(item.categoryKey === 'invoices' ? 'Sale Created' : item.categoryKey === 'lots' ? 'Lot Created' : item.moduleName + ' Added').bg}`}>
                          {item.moduleName === 'Invoices' && <FileText size={16} />}
                          {item.moduleName === 'Lots' && <Boxes size={16} />}
                          {item.moduleName === 'Customers' && <Users size={16} />}
                          {item.moduleName === 'Suppliers' && <Users size={16} />}
                          {item.moduleName === 'Products' && <ShoppingBag size={16} />}
                          {item.moduleName === 'Trucks' && <Truck size={16} />}
                          {item.moduleName === 'Payments' && <DollarSign size={16} />}
                          {item.moduleName === 'Expenses' && <Percent size={16} />}
                          {item.moduleName === 'Users' && <User size={16} />}
                          {item.moduleName === 'Clerks' && <User size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{item.name}</h4>
                            <span className="text-[10px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {item.recordNumber}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {item.relatedInfo}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 self-end sm:self-auto">
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t(item.moduleName)}</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !searching && searchResults && (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <p className="text-sm font-bold">😕 {t("No Results Found")}</p>
                <p className="text-xs">{t("We couldn't find any records matching your search term across the database.")}</p>
              </div>
            )}
          </div>
        )}

        {/* Recent Search Queries history row */}
        {searchHistory.length > 0 && !searchQuery && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 animate-fade-in mt-1">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mr-1">{t("Recent Searches")}:</span>
            {searchHistory.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setSearchQuery(q)}
                className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-[#4F46E5] hover:text-white transition-colors border border-slate-200 dark:border-slate-700/50"
              >
                {q}
              </button>
            ))}
            <button
              onClick={clearHistory}
              className="text-[10px] font-bold text-rose-500 hover:underline hover:text-rose-400 uppercase tracking-widest ml-auto"
            >
              {t("Clear History")}
            </button>
          </div>
        )}
      </div>

      {/* 3. QUICK SEARCH SHORTCUTS */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-black dark:text-white">{t("Quick Filter Shortcuts")}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t("Select a category to automatically lock search parameters and focus search bar.")}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {shortcuts.map((sc, index) => (
            <button
              key={index}
              onClick={() => handleShortcutClick(sc.filter)}
              className={`p-4 rounded-2xl  ${sc.gradient} border border-slate-200/5 hover:border-slate-500/25 shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between h-24 relative overflow-hidden group`}
            >
              <div className="absolute right-2 top-2 opacity-5 group-hover:opacity-10 group-hover:scale-125 transition-transform">
                <Search size={48} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("Mandi Module")}</span>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs font-black uppercase text-slate-800 dark:text-white group-hover:translate-x-1 transition-transform">{t(sc.label)}</span>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 4. RECENT TRANSACTIONS TIMELINE */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-black dark:text-white">{t("Recent Activities & Financial Transactions")}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("Live stream of arrivals, sales, expenses, and counter payments.")}</p>
          </div>

          {/* Real-time Filter Row */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Time Filters */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-[10px] font-bold uppercase tracking-wider">
              {['All', 'Today', 'Week', 'Month'].map(df => (
                <button
                  key={df}
                  onClick={() => setDateFilter(df)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${dateFilter === df ? 'bg-[#4F46E5] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {t(df)}
                </button>
              ))}
            </div>

            {/* Category Filter dropdown */}
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {['All', 'Sales', 'Purchases', 'Expenses', 'Payments', 'Customers', 'Suppliers', 'User', 'Clerk'].map(mf => (
                <option key={mf} value={mf}>{t(mf)}</option>
              ))}
            </select>

            {/* Status Filter dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {['All', 'Done', 'Cancelled'].map(sf => (
                <option key={sf} value={sf}>{sf === 'All' ? t('All Statuses') : t(sf)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TIMELINE VIEW CONTAINER */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm">
          {activitiesLoading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <Loader2 size={36} className="animate-spin text-indigo-500" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t("Compiling real-time bookkeeping logs...")}</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="py-24 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <p className="text-base font-bold">💤 {t("No Recent Transactions")}</p>
              <p className="text-xs">{t("No bookkeeping logs matched your filters in this period.")}</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 pl-6 space-y-8 py-2">
              {filteredActivities.slice(0, 20).map((act) => {
                const styles = getActivityStyles(act.type);
                const Icon = styles.icon;

                return (
                  <div
                    key={act.id}
                    onClick={() => setSelectedDetailItem({ ...act, isActivity: true })}
                    className="relative group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/5 p-3 rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Timeline dot marker with colored pulse ring */}
                    <div className="absolute -left-[31px] top-1/2 -translate-y-1/2 flex items-center justify-center">
                      <span className={`w-2.5 h-2.5 rounded-full ring-4 ${styles.dot} transition-transform group-hover:scale-125`} />
                    </div>

                    {/* Left: icon + date + details */}
                    <div className="flex items-start space-x-4">
                      
                      {/* Round Type badge */}
                      <div className={`p-3 rounded-2xl border ${styles.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                        <Icon size={18} />
                      </div>

                      {/* Info text */}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">{t(act.type)}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                            {act.reference}
                          </span>
                        </div>

                        {/* Description line */}
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {act.type === 'Sale Created' && `${t("Invoice generated for")} `}
                          {act.type === 'Lot Created' && `${t("Consignment shipment arrived from")} `}
                          {act.type === 'Expense Added' && `${t("Operating expense for")} `}
                          {act.type === 'Payment Received' && `${t("Received payment from")} `}
                          {act.type === 'Payment Paid' && `${t("Cash payout to")} `}
                          {act.type === 'Customer Added' && `${t("Registered customer")} `}
                          {act.type === 'Supplier Added' && `${t("Registered beopari/grower")} `}
                          {act.type === 'Product Added' && `${t("Registered product")} `}
                          {act.type === 'Truck Received' && `${t("Truck shipment from")} `}
                          <strong className="font-bold text-slate-700 dark:text-slate-300">{act.relatedParty}</strong>
                        </p>

                        {/* Clerk / Timestamp Meta row */}
                        <div className="flex items-center space-x-3 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                          <span className="flex items-center space-x-1 text-[#4F46E5] dark:text-indigo-400">
                            <User size={10} />
                            <span>{act.user}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Clock size={10} />
                            <span>{act.time}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Status */}
                    <div className="flex items-center space-x-4 self-end sm:self-auto shrink-0">
                      {act.amount !== null && (
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-800 dark:text-white">
                            {formatCurrency(act.amount)}
                          </p>
                          <span className={`inline-block mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            act.type === 'Sale Created' ? 'bg-emerald-500/10 text-emerald-500' :
                            act.type === 'Expense Added' ? 'bg-rose-500/10 text-rose-500' :
                            act.type === 'Payment Received' ? 'bg-purple-500/10 text-purple-500' :
                            'bg-blue-500/10 text-blue-500'
                          }`}>
                            {act.status}
                          </span>
                        </div>
                      )}
                      
                      {/* Non-financial events show just status */}
                      {act.amount === null && (
                        <span className="text-[10px] font-black uppercase bg-[#1E293B]/40 px-2.5 py-1 rounded-xl text-slate-400">
                          {act.status}
                        </span>
                      )}

                      <ChevronRight size={16} className="text-slate-400 hidden sm:block" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. GORGEOUS DETAIL MODAL DIALOG */}
      {selectedDetailItem && (() => {
        const item = selectedDetailItem;
        const isAct = Boolean(item.isActivity);
        
        // Title Name
        const title = isAct
          ? item.type
          : (item.name || item.title || 'Record Details');

        // Reference Code
        const refCode = item.reference || item.recordNumber || (item.id ? String(item.id).slice(-8).toUpperCase() : 'N/A');

        // Module Name
        const modName = item.module || item.moduleName || 'General';

        // Related Party / Contact
        const party = item.relatedParty || item.partyName || item.supplierName || item.customerName || item.name || 'N/A';

        // Operator / User
        const operator = item.user || item.recordedBy || 'Admin';

        // Date & Time
        const dateStr = item.date || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '--');
        const timeStr = item.time || (item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

        // Amount
        const hasAmount = item.amount !== undefined && item.amount !== null;
        const amountVal = hasAmount ? item.amount : null;

        // Status
        const statusVal = item.status || 'Active';

        // Styles based on type
        const styles = getActivityStyles(isAct ? item.type : (item.moduleName ? item.moduleName + ' Added' : 'General'));
        const Icon = styles.icon;

        // Generate narrative description
        let narrative = item.details || item.relatedInfo || '';
        if (!narrative) {
          if (isAct) {
            switch (item.type) {
              case 'Sale Created':
                narrative = `${t("Invoice generated for customer")} "${party}" ${t("with total amount")} ${formatCurrency(amountVal)}. ${t("Processed by")} ${operator} ${t("on")} ${dateStr} ${timeStr}.`;
                break;
              case 'Lot Created':
                narrative = `${t("Consignment lot shipment received from beopari/grower")} "${party}" ${t("with total value")} ${formatCurrency(amountVal)}. ${t("Registered by")} ${operator} ${t("on")} ${dateStr} ${timeStr}.`;
                break;
              case 'Expense Added':
                narrative = `${t("Operating expenditure recorded under category")} "${party}" ${t("for amount")} ${formatCurrency(amountVal)}. ${t("Logged by")} ${operator} ${t("on")} ${dateStr} ${timeStr}.`;
                break;
              case 'Payment Received':
                narrative = `${t("Received customer payment of")} ${formatCurrency(amountVal)} ${t("from")} "${party}". ${t("Processed by")} ${operator} ${t("on")} ${dateStr} ${timeStr}.`;
                break;
              case 'Payment Paid':
                narrative = `${t("Cash payout of")} ${formatCurrency(amountVal)} ${t("issued to beopari/grower/party")} "${party}". ${t("Handled by")} ${operator} ${t("on")} ${dateStr} ${timeStr}.`;
                break;
              case 'Customer Added':
                narrative = `${t("New customer profile")} "${party}" ${t("was registered in the Mandi ledger by")} ${operator} ${t("on")} ${dateStr}.`;
                break;
              case 'Supplier Added':
                narrative = `${t("New beopari/grower profile")} "${party}" ${t("was created in the system by")} ${operator} ${t("on")} ${dateStr}.`;
                break;
              case 'Product Added':
                narrative = `${t("New fruit commodity")} "${party}" ${t("was added to the catalog by")} ${operator} ${t("on")} ${dateStr}.`;
                break;
              case 'Truck Received':
                narrative = `${t("Gate logistics vehicle arrival registered for truck number")} "${refCode}" ${t("from beopari/grower")} "${party}". ${t("Status")}: ${statusVal}. ${t("Logged by")} ${operator} ${t("on")} ${dateStr}.`;
                break;
              default:
                narrative = `${t("Bookkeeping activity")} "${item.type}" ${t("logged for")} "${party}" ${t("by operator")} ${operator} ${t("on")} ${dateStr} ${timeStr}.`;
            }
          } else {
            narrative = `${t("Record details for")} ${title} (${refCode}) ${t("saved in Mandi database.")}`;
          }
        }

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 p-6 sm:p-7 space-y-6 shadow-2xl relative text-xs">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-2 rounded-xl ${styles.bg}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">
                      {t("Activity Record Details")}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{t("Mandi Bookkeeping Audit Log")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDetailItem(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Content Details */}
              <div className="space-y-4">
                
                {/* Hero Header Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md inline-block">
                      {t(modName)}
                    </span>
                    <h4 className="text-base font-black text-slate-800 dark:text-white leading-snug">{t(title)}</h4>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
                      <span>{party}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span className="text-[10px] font-mono font-extrabold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg block">
                      {refCode}
                    </span>
                    <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      statusVal === 'Completed' || statusVal === 'Done' || statusVal === 'Paid' ? 'bg-emerald-500/10 text-emerald-500' :
                      statusVal === 'Arrived' || statusVal === 'Active' ? 'bg-sky-500/10 text-sky-500' :
                      statusVal === 'Waiting' || statusVal === 'Pending' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-rose-500/10 text-rose-500'
                    }`}>
                      {t(statusVal)}
                    </span>
                  </div>
                </div>

                {/* Amount Banner if present */}
                {hasAmount && (
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">{t("Recorded Transaction Amount")}</span>
                      <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {formatCurrency(amountVal)}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                      <DollarSign size={22} />
                    </div>
                  </div>
                )}

                {/* Grid Meta Details */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t("Reference ID")}</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{refCode}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t("Related Party / Contact")}</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">{party}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t("Logged By (Operator)")}</span>
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center space-x-1">
                      <User size={12} />
                      <span>{operator}</span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t("Date & Timestamp")}</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center space-x-1">
                      <Clock size={12} className="text-slate-400" />
                      <span>{dateStr} {timeStr}</span>
                    </p>
                  </div>
                </div>

                {/* Detailed Description / Narrative Callout */}
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 space-y-1">
                  <span className="text-[10px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider block">
                    {t("Audit Log Narrative & Summary")}
                  </span>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
                    {narrative}
                  </p>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-4 gap-3">
                <button
                  onClick={() => setSelectedDetailItem(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all cursor-pointer"
                >
                  {t("Close")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
