import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ConfirmProvider } from './context/ConfirmContext.jsx';
import NetworkStatusBanner from './components/common/NetworkStatusBanner.jsx';
import Login from './components/Login.jsx';
import Layout from './components/Layout.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import SuperAdminDashboard from './components/SuperAdminDashboard.jsx';
import ClerkDashboard from './components/ClerkDashboard.jsx';
import CustomerDashboard from './components/CustomerDashboard.jsx';
import SupplierDashboard from './components/SupplierDashboard.jsx';

import CustomerLedgerPage from './components/reports/CustomerLedgerPage.jsx';
import SupplierLedgerPage from './components/reports/SupplierLedgerPage.jsx';
import SaleInvoicePage from './components/reports/SaleInvoicePage.jsx';
import LotDetailsPage from './components/reports/LotDetailsPage.jsx';
import StockReportPage from './components/reports/StockReportPage.jsx';
import ConsignmentReportPage from './components/reports/ConsignmentReportPage.jsx';
import AuditReportPage from './components/reports/AuditReportPage.jsx';
import LogisticsReportPage from './components/reports/LogisticsReportPage.jsx';
import DayBookReportPage from './components/reports/DayBookReportPage.jsx';
import ReportsHub from './components/reports/ReportsHub.jsx';
import ReportDetailPage from './components/reports/ReportDetailPage.jsx';

import { TAB_TO_PATH, PATH_TO_TAB, getDefaultRouteForRole, isRouteAllowedForRole } from './utils/routes.js';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-slate-400">Loading Mandi System...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isRouteAllowedForRole(user.role, location.pathname)) {
    const defaultRoute = getDefaultRouteForRole(user.role);
    return <Navigate to={defaultRoute} replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-slate-400">Loading Mandi System...</p>
      </div>
    );
  }

  if (user) {
    const defaultRoute = getDefaultRouteForRole(user.role);
    return <Navigate to={defaultRoute} replace />;
  }

  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-slate-400">Loading Mandi System...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const defaultRoute = getDefaultRouteForRole(user.role);
  return <Navigate to={defaultRoute} replace />;
}

function DashboardTabWrapper() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const currentTab = PATH_TO_TAB[location.pathname] || (user?.role === 'super_admin' ? 'saas-dashboard' : 'dashboard');

  const handleTabChange = (newTab) => {
    const path = TAB_TO_PATH[newTab] || (user?.role === 'super_admin' ? '/saas-dashboard' : '/dashboard');
    navigate(path);
  };

  return (
    <Layout currentTab={currentTab} setCurrentTab={handleTabChange}>
      {user.role === 'super_admin' && <SuperAdminDashboard tab={currentTab} onTabChange={handleTabChange} />}
      {user.role === 'Admin' && <AdminDashboard tab={currentTab} setCurrentTab={handleTabChange} />}
      {user.role === 'Clerk' && (['pay_or_receive', 'payments'].includes(currentTab)
        ? <AdminDashboard tab={currentTab} setCurrentTab={handleTabChange} />
        : <ClerkDashboard tab={currentTab} setCurrentTab={handleTabChange} />)}
      {user.role === 'Customer' && <CustomerDashboard tab={currentTab} setCurrentTab={handleTabChange} />}
      {user.role === 'Supplier' && <SupplierDashboard tab={currentTab} setCurrentTab={handleTabChange} />}
    </Layout>
  );
}

function ReportWrapper({ reportType }) {
  const navigate = useNavigate();

  const handleTabChange = (newTab) => {
    const path = TAB_TO_PATH[newTab] || '/dashboard';
    navigate(path);
  };

  const renderReport = () => {
    switch (reportType) {
      case 'customer-ledger':
        return <CustomerLedgerPage />;
      case 'supplier-ledger':
        return <SupplierLedgerPage />;
      case 'sale-invoice':
        return <SaleInvoicePage />;
      case 'lot-details':
        return <LotDetailsPage />;
      case 'stock-report':
        return <StockReportPage />;
      case 'consignment-report':
        return <ConsignmentReportPage />;
      case 'audit-report':
        return <AuditReportPage />;
      case 'logistics-report':
        return <LogisticsReportPage />;
      case 'day-book':
        return <DayBookReportPage />;
      default:
        return (
          <div className="p-8 text-center">
            <h2 className="text-xl font-bold">Report Not Found</h2>
            <p className="text-slate-500 mt-2">The requested report page ({reportType}) does not exist.</p>
          </div>
        );
    }
  };

  return (
    <Layout currentTab="reports" setCurrentTab={handleTabChange}>
      {renderReport()}
    </Layout>
  );
}

function ReportsHubWrapper() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleTabChange = (newTab) => {
    const path = TAB_TO_PATH[newTab] || '/dashboard';
    navigate(path);
  };

  return (
    <Layout currentTab="reports" setCurrentTab={handleTabChange}>
      <ReportsHub user={user} />
    </Layout>
  );
}

function ReportDetailWrapper() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleTabChange = (newTab) => {
    const path = TAB_TO_PATH[newTab] || '/dashboard';
    navigate(path);
  };

  return (
    <Layout currentTab="reports" setCurrentTab={handleTabChange}>
      <ReportDetailPage user={user} />
    </Layout>
  );
}

function MainApp() {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />

      {/* Root Path Redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Module / Dashboard Routes */}
      <Route path="/home" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/saas-dashboard" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/super-admin" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/businesses" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/subscriptions" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/super-admin/businesses" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/super-admin/subscriptions" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/super-admin/users" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/super-admin/search" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/super-admin/audit" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/super-admin/settings" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/logistics" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/business-profile" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/clerks" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/stock" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/sales/batch" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/sales/boli" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/sales/sold-consignments" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/sales/batch-custom-rate" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      {/* <Route path="/sales/sold-consignments" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} /> */}
      <Route path="/returns" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/pay-or-receive" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsHubWrapper /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/deleted-users" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/settings/units" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/settings/expenses" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/settings/payments" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/settings/invoice" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />

      {/* Role Specific Routes */}
      <Route path="/purchases" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/daywise" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/supplies" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />
      <Route path="/lot-report" element={<ProtectedRoute><DashboardTabWrapper /></ProtectedRoute>} />

      {/* Standalone Legacy Report Routes */}
      <Route path="/reports/customer-ledger" element={<ProtectedRoute><ReportWrapper reportType="customer-ledger" /></ProtectedRoute>} />
      <Route path="/reports/supplier-ledger" element={<ProtectedRoute><ReportWrapper reportType="supplier-ledger" /></ProtectedRoute>} />
      <Route path="/reports/sale-invoice" element={<ProtectedRoute><ReportWrapper reportType="sale-invoice" /></ProtectedRoute>} />
      <Route path="/reports/lot-details" element={<ProtectedRoute><ReportWrapper reportType="lot-details" /></ProtectedRoute>} />
      <Route path="/reports/stock-report" element={<ProtectedRoute><ReportWrapper reportType="stock-report" /></ProtectedRoute>} />
      <Route path="/reports/consignment-report" element={<ProtectedRoute><ReportWrapper reportType="consignment-report" /></ProtectedRoute>} />
      <Route path="/reports/audit-report" element={<ProtectedRoute><ReportWrapper reportType="audit-report" /></ProtectedRoute>} />
      <Route path="/reports/logistics-report" element={<ProtectedRoute><ReportWrapper reportType="logistics-report" /></ProtectedRoute>} />
      <Route path="/reports/day-book" element={<ProtectedRoute><ReportWrapper reportType="day-book" /></ProtectedRoute>} />

      {/* Dynamic Reports Hub Detail Route */}
      <Route path="/reports/:id" element={<ProtectedRoute><ReportDetailWrapper /></ProtectedRoute>} />

      {/* Fallback wildcard route */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LanguageProvider>
            <ConfirmProvider>
              <NetworkStatusBanner />
              <MainApp />
            </ConfirmProvider>
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
