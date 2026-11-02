// Navigation routes and permission mappings for Mandi OS

export const TAB_TO_PATH = {
  home: '/home',
  dashboard: '/dashboard',
  'saas-dashboard': '/saas-dashboard',
  'super-admin': '/saas-dashboard',
  businesses: '/businesses',
  subscriptions: '/subscriptions',
  users: '/users',
  search: '/search',
  logistics: '/logistics',
  business_profile: '/business-profile',
  clerks: '/clerks',
  employees: '/employees',
  suppliers: '/suppliers',
  customers: '/customers',
  products: '/products',
  stock: '/stock',
  sales: '/sales/batch',
  sales_batch: '/sales/batch',
  sales_boli: '/sales/boli',
  sales_batch_custom_rate: '/sales/batch-custom-rate',
  sales_sold_consignments: '/sales/sold-consignments',
  returns: '/returns',
  pay_or_receive: '/pay-or-receive',
  payments: '/payments',
  reports: '/reports',
  audit: '/audit',
  deleted_users: '/deleted-users',
  settings: '/settings',
  settings_units: '/settings/units',
  settings_expenses: '/settings/expenses',
  settings_payments: '/settings/payments',
  settings_invoice: '/settings/invoice',
  settings_password: '/settings/password',
  purchases: '/purchases',
  daywise: '/daywise',
  ledger: '/ledger',
  supplies: '/supplies',
  lot_report: '/lot-report',
};

export const PATH_TO_TAB = {
  '/home': 'home',
  '/dashboard': 'dashboard',
  '/saas-dashboard': 'saas-dashboard',
  '/super-admin': 'saas-dashboard',
  '/businesses': 'businesses',
  '/subscriptions': 'subscriptions',
  '/users': 'users',
  '/search': 'search',
  '/audit': 'audit',
  '/settings': 'settings',
  '/super-admin/businesses': 'businesses',
  '/super-admin/subscriptions': 'subscriptions',
  '/super-admin/users': 'users',
  '/super-admin/search': 'search',
  '/super-admin/audit': 'audit',
  '/super-admin/settings': 'settings',
  '/logistics': 'logistics',
  '/business-profile': 'business_profile',
  '/clerks': 'clerks',
  '/employees': 'employees',
  '/suppliers': 'suppliers',
  '/customers': 'customers',
  '/products': 'products',
  '/stock': 'stock',
  '/sales': 'sales_batch',
  '/sales/batch': 'sales_batch',
  '/sales/boli': 'sales_boli',
  '/sales/batch-custom-rate': 'sales_batch_custom_rate',
  '/sales/sold-consignments': 'sales_sold_consignments',
  '/returns': 'returns',
  '/pay-or-receive': 'pay_or_receive',
  '/payments': 'payments',
  '/reports': 'reports',
  '/deleted-users': 'deleted_users',
  '/settings/units': 'settings_units',
  '/settings/expenses': 'settings_expenses',
  '/settings/payments': 'settings_payments',
  '/settings/invoice': 'settings_invoice',
  '/settings/password': 'settings_password',
  '/purchases': 'purchases',
  '/daywise': 'daywise',
  '/ledger': 'ledger',
  '/supplies': 'supplies',
  '/lot-report': 'lot_report',
};

export function getDefaultRouteForRole(role) {
  switch (role) {
    case 'super_admin':
      return '/saas-dashboard';
    case 'Admin':
      return '/home';
    case 'Clerk':
      return '/dashboard';
    case 'Customer':
      return '/dashboard';
    case 'Supplier':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}

export function isRouteAllowedForRole(role, pathname) {
  if (!role) return false;
  if (role === 'super_admin') return true; // Super admin has global system permissions

  const cleanPath = pathname.split('?')[0];

  // Standalone report route checks
  if (cleanPath.startsWith('/reports/')) {
    const reportType = cleanPath.replace('/reports/', '');
    switch (reportType) {
      case 'customer-ledger':
        return ['Admin', 'Customer'].includes(role);
      case 'supplier-ledger':
        return ['Admin', 'Supplier'].includes(role);
      case 'sale-invoice':
        return ['Admin', 'Clerk', 'Customer', 'Supplier'].includes(role);
      case 'lot-details':
        return ['Admin', 'Clerk', 'Supplier'].includes(role);
      case 'stock-report':
        return ['Admin', 'Clerk'].includes(role);
      case 'consignment-report':
        return ['Admin', 'Clerk', 'Supplier'].includes(role);
      case 'audit-report':
        return ['Admin'].includes(role);
      case 'logistics-report':
        return ['Admin', 'Clerk'].includes(role);
      
      // New 16 Reports Hub detail routes
      case 'party-ledger':
        return ['Admin', 'Clerk', 'Supplier', 'Customer'].includes(role);
      case 'commission':
      case 'advance':
      case 'payables':
      case 'market-fee':
      case 'expense':
      case 'monthly-profit':
        return ['Admin'].includes(role);
      default:
        // All other hub reports allowed for Admin and Clerk
        return ['Admin', 'Clerk'].includes(role);
    }
  }

  // General tab routes checks
  switch (cleanPath) {
    case '/home':
      return ['Admin'].includes(role);
    case '/dashboard':
      return ['Admin', 'Clerk', 'Customer', 'Supplier'].includes(role);
    case '/logistics':
      return ['Admin', 'Clerk'].includes(role);
    case '/business-profile':
      return ['Admin'].includes(role);
    case '/clerks':
      return ['Admin'].includes(role);
    case '/employees':
      return ['Admin'].includes(role);
    case '/suppliers':
      return ['Admin'].includes(role);
    case '/customers':
      return ['Admin'].includes(role);
    case '/products':
      return ['Admin', 'Clerk'].includes(role);
    case '/stock':
      return ['Admin', 'Clerk'].includes(role);
    case '/sales':
    case '/sales/batch':
    case '/sales/boli':
    case '/sales/sold-consignments':
      return ['Admin', 'Clerk'].includes(role);
    case '/returns':
      return ['Admin', 'Clerk'].includes(role);
    case '/pay-or-receive':
      return ['Admin', 'Clerk'].includes(role);
    case '/payments':
      return ['Admin', 'Clerk'].includes(role);
    case '/reports':
      return ['Admin', 'Clerk'].includes(role);
    case '/audit':
      return ['Admin'].includes(role);
    case '/deleted-users':
      return ['Admin'].includes(role);
    case '/settings':
    case '/settings/units':
    case '/settings/expenses':
    case '/settings/payments':
    case '/settings/invoice':
      return ['Admin'].includes(role);
    case '/purchases':
    case '/daywise':
      return ['Customer'].includes(role);
    case '/supplies':
    case '/lot-report':
      return ['Supplier'].includes(role);
    case '/ledger':
      return ['Customer', 'Supplier'].includes(role);
    default:
      return true;
  }
}
