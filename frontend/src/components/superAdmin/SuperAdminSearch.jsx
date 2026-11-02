import React, { useState, useEffect } from 'react';
import { 
  Search, Building2, Users, ShoppingBag, Truck, 
  MapPin, Phone, Mail, ArrowUpRight, CheckCircle, Clock, FileText
} from 'lucide-react';
import api from '../../utils/api.js';

export default function SuperAdminSearch({ onSelectBusiness, onSelectUser }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({
    businesses: [],
    users: [],
    customers: [],
    suppliers: [],
    totalMatches: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    if (!query.trim()) {
      setResults({ businesses: [], users: [], customers: [], suppliers: [], totalMatches: 0 });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/super-admin/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data || { businesses: [], users: [], customers: [], suppliers: [], totalMatches: 0 });
      } catch (err) {
        console.error('Super admin search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const categories = [
    { id: 'all', label: 'All Results', count: results.totalMatches },
    { id: 'businesses', label: 'Businesses / Tenants', count: results.businesses?.length || 0 },
    { id: 'users', label: 'Platform Users', count: results.users?.length || 0 },
    { id: 'customers', label: 'Customer Accounts', count: results.customers?.length || 0 },
    { id: 'suppliers', label: 'Beopari/Grower Accounts', count: results.suppliers?.length || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
          <Search className="w-5 h-5 text-blue-600" />
          Cross-Tenant Global Search
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Query records across all tenant boundaries with clear business attribution
        </p>

        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type business name, registration #, owner, phone, email, customer or beopari/grower..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
          {loading && (
            <div className="absolute right-4 top-3.5 text-xs text-blue-600 animate-pulse font-medium">
              Searching...
            </div>
          )}
        </div>

        {/* Category Filters */}
        {query.trim() && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedCategory === c.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Container */}
      {query.trim() && (
        <div className="space-y-6">
          {/* 1. Businesses Section */}
          {(selectedCategory === 'all' || selectedCategory === 'businesses') && results.businesses?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-600" />
                Businesses / Tenants ({results.businesses.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.businesses.map(b => (
                  <div 
                    key={b.id}
                    onClick={() => onSelectBusiness(b)}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{b.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>Code: <strong>{b.businessCode}</strong></span>
                        <span>Arthi: <strong>{b.arthiCode}</strong></span>
                        <span>Owner: <strong>{b.ownerName}</strong></span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                        <span>City: {b.city || 'Pakistan'}</span>
                        <span>Plan: <strong>{b.plan}</strong></span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px] text-blue-600 font-medium flex items-center justify-between">
                      <span>Tenant ID: {b.tenantId}</span>
                      <span className="flex items-center gap-0.5">View Tenant <ArrowUpRight className="w-3 h-3" /></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Users Section */}
          {(selectedCategory === 'all' || selectedCategory === 'users') && results.users?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-cyan-600" />
                Platform Users ({results.users.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.users.map(u => (
                  <div 
                    key={u.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{u.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-900">
                          {u.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        <div>Email: {u.email}</div>
                        {u.phone && <div>Phone: {u.phone}</div>}
                      </div>
                    </div>
                    {/* Multi-Tenant Identifier Badge */}
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold rounded">
                        Business: {u.businessName}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        Tenant: {u.tenantId}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Customers Section */}
          {(selectedCategory === 'all' || selectedCategory === 'customers') && results.customers?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                Customer Records ({results.customers.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.customers.map(c => (
                  <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{c.name}</h4>
                      <span className="font-mono text-xs font-semibold text-emerald-600">
                        Khata: {c.khataId}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      <span>Phone: {c.phone || 'N/A'} • Balance: Rs. {c.currentBalance}</span>
                    </div>
                    {/* Multi-Tenant Identifier Badge */}
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold rounded">
                        Business: {c.businessName}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        Tenant: {c.tenantId}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Suppliers Section */}
          {(selectedCategory === 'all' || selectedCategory === 'suppliers') && results.suppliers?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-amber-600" />
                Beopari/Grower Records ({results.suppliers.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.suppliers.map(s => (
                  <div key={s.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{s.name}</h4>
                      <span className="font-mono text-xs font-semibold text-amber-600">
                        Khata: {s.khataId}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      <span>Phone: {s.phone || 'N/A'} • CNIC: {s.cnic || 'N/A'} • Balance: Rs. {s.currentBalance}</span>
                    </div>
                    {/* Multi-Tenant Identifier Badge */}
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold rounded">
                        Business: {s.businessName}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        Tenant: {s.tenantId}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.totalMatches === 0 && !loading && (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Search className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No records found</h4>
              <p className="text-xs text-slate-500 mt-1">Try a different search keyword or number</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
