import express from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { login, getProfile, changePassword, refreshSession, logout, exitImpersonation } from '../controllers/authController.js';
import {
  getClerks, addClerk, editClerk, deleteClerk,
  getSuppliers, getSupplier, addSupplier, editSupplier, deleteSupplier, getNextSupplierKhataId,
  getCustomers, getCustomer, addCustomer, editCustomer, deleteCustomer, getNextCustomerKhataId,
  getDeletedUsers, restoreUser, deleteUser
} from '../controllers/userController.js';
import { getProducts, addProduct, editProduct, deleteProduct } from '../controllers/productController.js';
import { getStockEntries, addStockEntry, updateStockEntry, deleteStockEntry, updateLotFinancials, recordLotSettlement } from '../controllers/stockController.js';
import { getOwnTradingPurchases, createOwnTradingPurchase, updateOwnTradingPurchase, cancelOwnTradingPurchase } from '../controllers/ownTradingController.js';
import { getSales, addSale, updateSale, deleteSale } from '../controllers/saleController.js';
import { listBoliSessions, createBoliSession, getBoliSession, getBoliSessionSales, addSaleToBoliSession, closeBoliSession, reopenBoliSession } from '../controllers/boliSessionController.js';
import { getPayments, addPayment, deletePayment } from '../controllers/paymentController.js';
import { getDailyHisab } from '../controllers/dailyHisabController.js';
import { getReports, getReportData } from '../controllers/reportController.js';
import { getAuditLogs } from '../controllers/auditController.js';
import { getGlobalSearch, getRecentActivities } from '../controllers/searchController.js';
import { getExpenses, addExpense, editExpense, deleteExpense } from '../controllers/expenseController.js';
import { getTrucks, addTruck, editTruck, deleteTruck } from '../controllers/truckController.js';
import {
  getEmployees, addEmployee, editEmployee, deleteEmployee,
  getSalaries, addSalary, editSalary, deleteSalary,
  getAdvances, addAdvance, deleteAdvance,
  getEmployeeProfile, getEmployeeStats
} from '../controllers/employeeController.js';
import {
  getBusinessSettings, updateBusinessSettings,
  getCalculatedCommission,
  getCommissionRules, addCommissionRule, editCommissionRule, deleteCommissionRule,
  getUnits, addUnit, editUnit, deleteUnit,
  getCharges, addCharge, editCharge, deleteCharge,
  getExpenseCategories, addExpenseCategory, editExpenseCategory, deleteExpenseCategory,
  getPaymentMethods, addPaymentMethod, editPaymentMethod, deletePaymentMethod,
  getInvoiceSettings, updateInvoiceSettings,
  getApplicationSettings, updateApplicationSettings,
  getNotificationSettings, updateNotificationSettings,
  getLedgerSettings, updateLedgerSettings,
  getTaxSettings, updateTaxSettings
} from '../controllers/settingsController.js';
import {
  getReturns, getReturnById, createReturn, approveReturn, rejectReturn, updateReturn, deleteReturn, getCustomerCrates, getCustomerRecentSales
} from '../controllers/returnController.js';
import {
  getBusinesses, createBusiness, editBusiness, toggleBusinessStatus, resetOwnerPassword,
  renewSubscription, deleteBusiness, getSuperAdminStats, getAllUsers, toggleUserStatus,
  getGlobalSettings, updateGlobalSettings, updateSuperAdminProfile, suggestArthiCodeHandler,
  impersonateBusiness, getSystemHealth, exportAllDatabaseBackup, exportTenantData,
  getAnnouncements, createAnnouncement, toggleAnnouncementStatus, deleteAnnouncement,
  getActiveAnnouncements, getSubscriptionPlans, createSubscriptionPlan,
  updateSubscriptionPlan, deleteSubscriptionPlan, toggleSubscriptionPlanStatus,
  updateTenantFeatures, getSuperAdminAuditLogs, searchSuperAdminGlobal
} from '../controllers/superAdminController.js';

const router = express.Router();

// --- PUBLIC ROUTES ---
router.post('/auth/login', login);
router.post('/auth/refresh', refreshSession);
router.post('/auth/logout', logout);
router.get('/announcements/active', getActiveAnnouncements);

// --- PROTECTED ROUTES (Requires Login) ---
router.get('/auth/profile', authenticateJWT, getProfile);
router.post('/auth/exit-impersonation', authenticateJWT, exitImpersonation);
router.post('/auth/change-password', authenticateJWT, changePassword);
router.put('/auth/change-password', authenticateJWT, changePassword);

// --- PRODUCTS ---
router.get('/products', authenticateJWT, getProducts);
router.post('/products', authenticateJWT, authorizeRoles('Admin', 'Clerk'), addProduct);
router.put('/products/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), editProduct);
router.delete('/products/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), deleteProduct);

// --- CLERKS (Only Admin) ---
router.get('/clerks', authenticateJWT, authorizeRoles('Admin'), getClerks);
router.post('/clerks', authenticateJWT, authorizeRoles('Admin'), addClerk);
router.put('/clerks/:id', authenticateJWT, authorizeRoles('Admin'), editClerk);
router.delete('/clerks/:id', authenticateJWT, authorizeRoles('Admin'), deleteClerk);
router.post('/clerks/:id/restore', authenticateJWT, authorizeRoles('Admin'), restoreUser);

// --- SUPPLIERS ---
router.get('/suppliers/next-khata-id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), getNextSupplierKhataId);
router.get('/suppliers', authenticateJWT, getSuppliers);
router.get('/suppliers/:id', authenticateJWT, getSupplier);
router.post('/suppliers', authenticateJWT, authorizeRoles('Admin'), addSupplier);
router.put('/suppliers/:id', authenticateJWT, authorizeRoles('Admin'), editSupplier);
router.delete('/suppliers/:id', authenticateJWT, authorizeRoles('Admin'), deleteSupplier);
router.post('/suppliers/:id/restore', authenticateJWT, authorizeRoles('Admin'), restoreUser);

// --- CUSTOMERS ---
router.get('/customers/next-khata-id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), getNextCustomerKhataId);
router.get('/customers', authenticateJWT, getCustomers);
router.get('/customers/:id', authenticateJWT, getCustomer);
router.post('/customers', authenticateJWT, authorizeRoles('Admin'), addCustomer);
router.put('/customers/:id', authenticateJWT, authorizeRoles('Admin'), editCustomer);
router.delete('/customers/:id', authenticateJWT, authorizeRoles('Admin'), deleteCustomer);
router.post('/customers/:id/restore', authenticateJWT, authorizeRoles('Admin'), restoreUser);

// --- DELETED USERS / TRASH ---
router.get('/deleted-users', authenticateJWT, authorizeRoles('Admin'), getDeletedUsers);
router.delete('/users/:id', authenticateJWT, authorizeRoles('Admin'), deleteUser);
router.delete('/deleted-users/:id', authenticateJWT, authorizeRoles('Admin'), deleteUser);
router.post('/deleted-users/:id/restore', authenticateJWT, authorizeRoles('Admin'), restoreUser);
router.post('/employees/:id/restore', authenticateJWT, authorizeRoles('Admin'), restoreUser);

// --- STOCK ENTRIES (Admin & Clerk) ---
router.get('/own-trading-purchases', authenticateJWT, authorizeRoles('Admin', 'Clerk'), getOwnTradingPurchases);
router.post('/own-trading-purchases', authenticateJWT, authorizeRoles('Admin', 'Clerk'), createOwnTradingPurchase);
router.put('/own-trading-purchases/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), updateOwnTradingPurchase);
router.delete('/own-trading-purchases/:id', authenticateJWT, authorizeRoles('Admin'), cancelOwnTradingPurchase);
router.get('/stock', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'Supplier'), getStockEntries);
router.post('/stock', authenticateJWT, authorizeRoles('Admin', 'Clerk'), addStockEntry);
router.put('/stock/:id/lot-financials', authenticateJWT, authorizeRoles('Admin', 'Clerk'), updateLotFinancials);
router.post('/stock/:id/record-settlement', authenticateJWT, authorizeRoles('Admin', 'Clerk'), recordLotSettlement);
router.put('/stock/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), updateStockEntry);
router.delete('/stock/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), deleteStockEntry);

// --- SALES (Admin & Clerk) ---
router.get('/sales', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'Customer', 'Supplier'), getSales);
router.post('/sales', authenticateJWT, authorizeRoles('Admin', 'Clerk'), addSale);
router.put('/sales/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), updateSale);
router.delete('/sales/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), deleteSale);

// --- BOLI SESSION (Session container around the existing sales ledger) ---
router.get('/boli-sessions', authenticateJWT, listBoliSessions);
router.post('/boli-sessions', authenticateJWT, authorizeRoles('Admin', 'Clerk'), createBoliSession);
router.get('/boli-sessions/:id', authenticateJWT, getBoliSession);
router.get('/boli-sessions/:id/sales', authenticateJWT, getBoliSessionSales);
router.post('/boli-sessions/:id/sales', authenticateJWT, authorizeRoles('Admin', 'Clerk'), addSaleToBoliSession);
router.post('/boli-sessions/:id/close', authenticateJWT, authorizeRoles('Admin', 'Clerk'), closeBoliSession);
router.post('/boli-sessions/:id/reopen', authenticateJWT, authorizeRoles('Admin', 'Clerk'), reopenBoliSession);

// --- PAYMENTS (Admin & Clerk) ---
router.get('/payments', authenticateJWT, getPayments);
router.post('/payments', authenticateJWT, authorizeRoles('Admin', 'Clerk'), addPayment);
router.delete('/payments/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), deletePayment);
router.get('/daily-hisab', authenticateJWT, authorizeRoles('Admin', 'Clerk'), getDailyHisab);

// --- RETURNS & SETTLEMENTS (Admin & Clerk) ---
router.get('/returns', authenticateJWT, getReturns);
router.get('/returns/:id', authenticateJWT, getReturnById);
router.post('/returns', authenticateJWT, authorizeRoles('Admin', 'Clerk'), createReturn);
router.put('/returns/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), updateReturn);
router.post('/returns/:id/approve', authenticateJWT, authorizeRoles('Admin', 'Clerk'), approveReturn);
router.post('/returns/:id/reject', authenticateJWT, authorizeRoles('Admin', 'Clerk'), rejectReturn);
router.delete('/returns/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), deleteReturn);
router.get('/customer-crates', authenticateJWT, getCustomerCrates);
router.get('/customers/:customerId/recent-sales', authenticateJWT, getCustomerRecentSales);

// --- REPORTS ---
router.get('/reports', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'Customer', 'Supplier'), getReports);
router.get('/reports/data', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'Customer', 'Supplier'), getReportData);
router.get('/search', authenticateJWT, getGlobalSearch);
router.get('/recent-activities', authenticateJWT, getRecentActivities);

// --- AUDIT LOGS ---
router.get('/audit', authenticateJWT, authorizeRoles('Admin'), getAuditLogs);

// --- EXPENSES ---
router.get('/expenses', authenticateJWT, getExpenses);
router.post('/expenses', authenticateJWT, authorizeRoles('Admin', 'Clerk'), addExpense);
router.put('/expenses/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), editExpense);
router.delete('/expenses/:id', authenticateJWT, authorizeRoles('Admin'), deleteExpense);

// --- EMPLOYEES & SALARY (Admin only for mutators, Admin/Clerk for list) ---
router.get('/employees', authenticateJWT, authorizeRoles('Admin'), getEmployees);
router.post('/employees', authenticateJWT, authorizeRoles('Admin'), addEmployee);
router.put('/employees/:id', authenticateJWT, authorizeRoles('Admin'), editEmployee);
router.delete('/employees/:id', authenticateJWT, authorizeRoles('Admin'), deleteEmployee);
router.get('/employees/stats', authenticateJWT, authorizeRoles('Admin'), getEmployeeStats);
router.get('/employees/profile/:id', authenticateJWT, authorizeRoles('Admin'), getEmployeeProfile);

router.get('/salaries', authenticateJWT, authorizeRoles('Admin'), getSalaries);
router.post('/salaries', authenticateJWT, authorizeRoles('Admin'), addSalary);
router.put('/salaries/:id', authenticateJWT, authorizeRoles('Admin'), editSalary);
router.delete('/salaries/:id', authenticateJWT, authorizeRoles('Admin'), deleteSalary);

router.get('/advances', authenticateJWT, authorizeRoles('Admin'), getAdvances);
router.post('/advances', authenticateJWT, authorizeRoles('Admin'), addAdvance);
router.delete('/advances/:id', authenticateJWT, authorizeRoles('Admin'), deleteAdvance);

// --- TRUCKS ---
router.get('/trucks', authenticateJWT, getTrucks);
router.post('/trucks', authenticateJWT, authorizeRoles('Admin', 'Clerk'), addTruck);
router.put('/trucks/:id', authenticateJWT, authorizeRoles('Admin', 'Clerk'), editTruck);
router.delete('/trucks/:id', authenticateJWT, authorizeRoles('Admin'), deleteTruck);

// --- SETTINGS (Only Admin) ---
router.get('/settings/calculate-commission', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'Supplier', 'super_admin'), getCalculatedCommission);
router.get('/settings/business', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'Customer', 'Supplier'), getBusinessSettings);
router.put('/settings/business', authenticateJWT, authorizeRoles('Admin'), updateBusinessSettings);

// router.get('/settings/commission-rules', authenticateJWT, authorizeRoles('Admin'), getCommissionRules);
// router.post('/settings/commission-rules', authenticateJWT, authorizeRoles('Admin'), addCommissionRule);
// router.put('/settings/commission-rules/:id', authenticateJWT, authorizeRoles('Admin'), editCommissionRule);
// router.delete('/settings/commission-rules/:id', authenticateJWT, authorizeRoles('Admin'), deleteCommissionRule);

router.get('/settings/units', authenticateJWT, getUnits);
router.post('/settings/units', authenticateJWT, authorizeRoles('Admin'), addUnit);
router.put('/settings/units/:id', authenticateJWT, authorizeRoles('Admin'), editUnit);
router.delete('/settings/units/:id', authenticateJWT, authorizeRoles('Admin'), deleteUnit);

// router.get('/settings/charges', authenticateJWT, authorizeRoles('Admin'), getCharges);
// router.post('/settings/charges', authenticateJWT, authorizeRoles('Admin'), addCharge);
// router.put('/settings/charges/:id', authenticateJWT, authorizeRoles('Admin'), editCharge);
// router.delete('/settings/charges/:id', authenticateJWT, authorizeRoles('Admin'), deleteCharge);

router.get('/settings/expense-categories', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'super_admin'), getExpenseCategories);
router.post('/settings/expense-categories', authenticateJWT, authorizeRoles('Admin'), addExpenseCategory);
router.put('/settings/expense-categories/:id', authenticateJWT, authorizeRoles('Admin'), editExpenseCategory);
router.delete('/settings/expense-categories/:id', authenticateJWT, authorizeRoles('Admin'), deleteExpenseCategory);

router.get('/settings/payment-methods', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'Customer', 'Supplier', 'super_admin'), getPaymentMethods);
router.post('/settings/payment-methods', authenticateJWT, authorizeRoles('Admin'), addPaymentMethod);
router.put('/settings/payment-methods/:id', authenticateJWT, authorizeRoles('Admin'), editPaymentMethod);
router.delete('/settings/payment-methods/:id', authenticateJWT, authorizeRoles('Admin'), deletePaymentMethod);

router.get('/settings/invoice', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'Customer', 'Supplier', 'super_admin'), getInvoiceSettings);
router.put('/settings/invoice', authenticateJWT, authorizeRoles('Admin'), updateInvoiceSettings);

router.get('/settings/application', authenticateJWT, authorizeRoles('Admin', 'super_admin'), getApplicationSettings);
router.put('/settings/application', authenticateJWT, authorizeRoles('Admin'), updateApplicationSettings);

router.get('/settings/notification', authenticateJWT, authorizeRoles('Admin', 'super_admin'), getNotificationSettings);
router.put('/settings/notification', authenticateJWT, authorizeRoles('Admin'), updateNotificationSettings);

router.get('/settings/ledger', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'super_admin'), getLedgerSettings);
router.put('/settings/ledger', authenticateJWT, authorizeRoles('Admin'), updateLedgerSettings);

router.get('/settings/tax', authenticateJWT, authorizeRoles('Admin', 'Clerk', 'super_admin'), getTaxSettings);
router.put('/settings/tax', authenticateJWT, authorizeRoles('Admin'), updateTaxSettings);

// --- SUPER ADMIN ROUTES ---
router.get('/super-admin/businesses/suggest-arthi-code', authenticateJWT, authorizeRoles('super_admin'), suggestArthiCodeHandler);
router.get('/super-admin/businesses', authenticateJWT, authorizeRoles('super_admin'), getBusinesses);
router.post('/super-admin/businesses', authenticateJWT, authorizeRoles('super_admin'), createBusiness);
router.put('/super-admin/businesses/:id', authenticateJWT, authorizeRoles('super_admin'), editBusiness);
router.patch('/super-admin/businesses/:id/status', authenticateJWT, authorizeRoles('super_admin'), toggleBusinessStatus);
router.put('/super-admin/businesses/:id/status', authenticateJWT, authorizeRoles('super_admin'), toggleBusinessStatus);
router.post('/super-admin/businesses/:id/reset-password', authenticateJWT, authorizeRoles('super_admin'), resetOwnerPassword);
router.post('/super-admin/businesses/:id/renew', authenticateJWT, authorizeRoles('super_admin'), renewSubscription);
router.delete('/super-admin/businesses/:id', authenticateJWT, authorizeRoles('super_admin'), deleteBusiness);
router.get('/super-admin/stats', authenticateJWT, authorizeRoles('super_admin'), getSuperAdminStats);
router.get('/super-admin/users', authenticateJWT, authorizeRoles('super_admin'), getAllUsers);
router.patch('/super-admin/users/:id/status', authenticateJWT, authorizeRoles('super_admin'), toggleUserStatus);
router.get('/super-admin/settings', authenticateJWT, authorizeRoles('super_admin'), getGlobalSettings);
router.put('/super-admin/settings', authenticateJWT, authorizeRoles('super_admin'), updateGlobalSettings);
router.put('/super-admin/profile', authenticateJWT, authorizeRoles('super_admin'), updateSuperAdminProfile);

// Support Impersonation
router.post('/super-admin/businesses/:id/impersonate', authenticateJWT, authorizeRoles('super_admin'), impersonateBusiness);

// Quotas & Features
router.put('/super-admin/businesses/:id/features', authenticateJWT, authorizeRoles('super_admin'), updateTenantFeatures);

// Telemetry & Health
router.get('/super-admin/system-health', authenticateJWT, authorizeRoles('super_admin'), getSystemHealth);

// Backup & Disaster Recovery
router.get('/super-admin/backup/export-all', authenticateJWT, authorizeRoles('super_admin'), exportAllDatabaseBackup);
router.get('/super-admin/backup/export-tenant/:tenantId', authenticateJWT, authorizeRoles('super_admin'), exportTenantData);

// Broadcasts & Announcements (Super Admin Management)
router.get('/super-admin/announcements', authenticateJWT, authorizeRoles('super_admin'), getAnnouncements);
router.post('/super-admin/announcements', authenticateJWT, authorizeRoles('super_admin'), createAnnouncement);
router.patch('/super-admin/announcements/:id/toggle', authenticateJWT, authorizeRoles('super_admin'), toggleAnnouncementStatus);
router.delete('/super-admin/announcements/:id', authenticateJWT, authorizeRoles('super_admin'), deleteAnnouncement);

// Subscription Plans & Quotas
router.get('/super-admin/plans', authenticateJWT, authorizeRoles('super_admin'), getSubscriptionPlans);
router.post('/super-admin/plans', authenticateJWT, authorizeRoles('super_admin'), createSubscriptionPlan);
router.put('/super-admin/plans/:id', authenticateJWT, authorizeRoles('super_admin'), updateSubscriptionPlan);
router.patch('/super-admin/plans/:id/status', authenticateJWT, authorizeRoles('super_admin'), toggleSubscriptionPlanStatus);
router.delete('/super-admin/plans/:id', authenticateJWT, authorizeRoles('super_admin'), deleteSubscriptionPlan);

// Global Security Audit Logs
router.get('/super-admin/audit-logs', authenticateJWT, authorizeRoles('super_admin'), getSuperAdminAuditLogs);

// Cross-Tenant Global Search
router.get('/super-admin/search', authenticateJWT, authorizeRoles('super_admin'), searchSuperAdminGlobal);

export default router;
