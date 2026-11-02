// Configuration and Metadata Specification for Mandi OS Reports Module

export const REPORTS_SECTIONS = [
  {
    id: 'daily-financial',
    title: 'Daily & Financial',
    tier: 'Tier 1 — MVP',
    tierLevel: 1,
    description: 'Core daily transaction logs, party ledgers, and financial accounting reports.',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
  },
  {
    id: 'operations',
    title: 'Operations',
    tier: 'Tier 2 — Phase 2',
    tierLevel: 2,
    description: 'Crate inventory, beopari/grower advances, attendance logs, and market fee compliance.',
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/30'
  },
  {
    id: 'analytics',
    title: 'Analytics',
    tier: 'Tier 3 — Analytics',
    tierLevel: 3,
    description: 'Commodity price trends, commercial partner leaderboards, and profit margins.',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
  }
];

export const REPORTS_CONFIG = {
  'day-book': {
    id: 'day-book',
    name: 'Day Book (Roznamcha)',
    description: 'Every transaction across all parties recorded sequentially for a chosen date range with cash till balance and mandi trading audit.',
    iconName: 'BookOpen',
    tier: 'Tier 1 — MVP',
    tierLevel: 1,
    section: 'Daily & Financial',
    purpose: 'Provides a complete chronological record of all cash receipts, payouts, shop expenses, credit auctions, and consignment arrivals across the entire Mandi shop.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'chart_and_table',
    chartType: 'bar',
    summaryCardKeys: ['openingBalance', 'totalInflows', 'totalOutflows', 'closingBalance', 'netCashFlow', 'totalCommissionEarned'],
    dataSources: ['Sales', 'StockEntries', 'Payments', 'Expenses', 'Ledger'],
    columns: [
      { key: 'time', label: 'Time / Date', align: 'left', sortable: true },
      { key: 'partyName', label: 'Party / Entity', align: 'left', sortable: true },
      { key: 'type', label: 'Transaction Type', align: 'center', sortable: true, format: 'badge' },
      { key: 'item', label: 'Item / Particulars', align: 'left', sortable: false },
      { key: 'paymentMethod', label: 'Mode', align: 'center', sortable: true, format: 'badge' },
      { key: 'quantity', label: 'Qty', align: 'right', sortable: true, format: 'number' },
      { key: 'debit', label: 'Debit / Banam (Rs)', align: 'right', sortable: true, format: 'currency_red' },
      { key: 'credit', label: 'Credit / Jama (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'runningBalance', label: 'Cash Balance (Rs)', align: 'right', sortable: true, format: 'currency' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'transactionType', label: 'Transaction Nature', type: 'select', options: ['All', 'Cash Flow Only / Rokar (نقد بہاؤ)', 'Customer Receipts (وصولیاں)', 'Beopari/Grower Payments (ادائیگیاں)', 'Walk-in Cash Sales (نقد فروخت)', 'Credit Invoices (ادھار بل)', 'Shop Expenses (اخراجات)', 'Consignment Arrivals (آمد مال)'] },
      { id: 'paymentMode', label: 'Payment Mode', type: 'select', options: ['All', 'Cash Till (نقد روکڑ)', 'Bank Account', 'Online / Wallet', 'Cheque', 'Credit / Udhar'] },
      { id: 'partyType', label: 'Party Type', type: 'select', options: ['All', 'Customer', 'Beopari/Grower', 'Expense', 'Walk-In'] }
    ],
    calculationLogic: 'Tracks historical opening till cash before start date, processes daily cash receipts/sales as Jama (Inflows), beopari/grower payouts/expenses as Banam (Outflows), and maintains true double-entry closing till balances.'
  },

  'party-ledger': {
    id: 'party-ledger',
    name: 'Party Ledger / Khata',
    description: 'Full transaction statement and running account balance history for a single customer or beopari/grower.',
    iconName: 'FileText',
    tier: 'Tier 1 — MVP',
    tierLevel: 1,
    section: 'Daily & Financial',
    purpose: 'Displays complete debit, credit, and running balance history for a chosen party, with a summary card showing current outstanding balance.',
    allowedRoles: ['Admin', 'Clerk', 'Supplier', 'Customer'],
    visualizationType: 'table_with_summary',
    summaryCardKeys: ['openingBalance', 'totalDebit', 'totalCredit', 'closingBalance'],
    dataSources: ['Transactions', 'Payments', 'Sales', 'StockEntries', 'Ledger'],
    columns: [
      { key: 'date', label: 'Date', align: 'left', sortable: true },
      { key: 'description', label: 'Description', align: 'left', sortable: false },
      { key: 'debit', label: 'Debit (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'credit', label: 'Credit (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'balance', label: 'Balance (Rs)', align: 'right', sortable: true, format: 'currency' }
    ],
    availableFilters: [
      { id: 'partyId', label: 'Select Party', type: 'partySelect' },
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' }
    ],
    calculationLogic: 'Filters all ledger entries and transactions by party ID. Debits represent purchases or funds owed; Credits represent payments or settlements received. Running balance is updated sequentially: Balance = Previous Balance + Debit - Credit.'
  },

  'lot-sales': {
    id: 'lot-sales',
    name: 'Lot-wise Sales Report',
    description: 'Detailed breakdown of every consignment lot sold, with buyer allocations and sale rates.',
    iconName: 'Layers',
    tier: 'Tier 1 — MVP',
    tierLevel: 1,
    section: 'Daily & Financial',
    purpose: 'Tracks auction liquidation per consignment lot, showing exact buyer names, crate quantities, rates, and total sales value.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'table',
    dataSources: ['Sales', 'StockEntries'],
    columns: [
      { key: 'lotNo', label: 'Lot No', align: 'left', sortable: true },
      { key: 'item', label: 'Item / Product', align: 'left', sortable: true },
      { key: 'supplier', label: 'Beopari/Grower', align: 'left', sortable: true },
      { key: 'buyer', label: 'Buyer', align: 'left', sortable: true },
      { key: 'quantity', label: 'Qty (Crates)', align: 'right', sortable: true, format: 'number' },
      { key: 'rate', label: 'Rate (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'amount', label: 'Amount (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'date', label: 'Date', align: 'left', sortable: true }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'supplierId', label: 'Beopari/Grower', type: 'supplierSelect' },
      { id: 'lotId', label: 'Lot No', type: 'lotSelect' },
      { id: 'productId', label: 'Item', type: 'productSelect' },
      { id: 'customerId', label: 'Buyer', type: 'customerSelect' }
    ],
    calculationLogic: 'Joins sales transactions with stock consignment lots. Amount = Quantity * Sale Rate. The totals row sums total crate quantity and total gross sales value.'
  },

  'commission': {
    id: 'commission',
    name: 'Commission (Aarhat) Report',
    description: 'Brokerage commission earned by the Mandi agency across transactions.',
    iconName: 'Percent',
    tier: 'Tier 1 — MVP',
    tierLevel: 1,
    section: 'Daily & Financial',
    purpose: 'Provides an executive view of agency revenue generated from trade commission rates applied on sales transactions and beopari/grower lot settlements.',
    allowedRoles: ['Admin'],
    visualizationType: 'chart_and_table',
    chartType: 'bar',
    summaryCardKeys: ['totalCustomerCommission', 'totalSupplierCommission', 'totalCommissionEarned', 'totalTradeValue'],
    dataSources: ['Sales', 'StockEntries', 'CommissionRules'],
    columns: [
      { key: 'date', label: 'Date', align: 'left', sortable: true },
      { key: 'partyName', label: 'Party / Entity', align: 'left', sortable: true },
      { key: 'partyType', label: 'Party Type', align: 'center', sortable: true, format: 'badge' },
      { key: 'productName', label: 'Commodity', align: 'left', sortable: true },
      { key: 'lotNo', label: 'Lot #', align: 'left', sortable: true },
      { key: 'quantity', label: 'Quantity', align: 'center', sortable: true, format: 'number' },
      { key: 'saleAmount', label: 'Sale Value (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'commissionRate', label: 'Commission Rate / Mode', align: 'center', sortable: true },
      { key: 'commissionAmount', label: 'Commission (Rs)', align: 'right', sortable: true, format: 'currency' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'partyCategory', label: 'Party Filter', type: 'select', options: ['All Parties', 'All Beopari/Growers', 'All Customers'] },
      { id: 'partyId', label: 'Party', type: 'partySelect' },
      { id: 'productId', label: 'Item', type: 'productSelect' }
    ],
    calculationLogic: 'Calculates brokerage commission earned across transactions with options for All Parties, All Beopari/Growers, and All Customers. Shows customer sales commission and beopari/grower lot commission deductions with corresponding commission rates (percentage, per-unit, or fixed fee).'
  },

  'outstanding': {
    id: 'outstanding',
    name: 'Outstanding / Udhaar Report',
    description: 'Aging analysis of pending receivables owed by buyers to manage credit risk.',
    iconName: 'Clock',
    tier: 'Tier 1 — MVP',
    tierLevel: 1,
    section: 'Daily & Financial',
    purpose: 'Categorizes buyer credit into aging time buckets (0-7, 8-15, 16-30, 30+ days) to highlight overdue balances.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'table',
    dataSources: ['Transactions', 'Sales', 'Payments', 'Customers'],
    columns: [
      { key: 'buyerName', label: 'Buyer Name', align: 'left', sortable: true },
      { key: 'totalOutstanding', label: 'Total Outstanding (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'bucket0to7', label: '0–7 Days', align: 'right', sortable: true, format: 'currency' },
      { key: 'bucket8to15', label: '8–15 Days', align: 'right', sortable: true, format: 'currency' },
      { key: 'bucket16to30', label: '16–30 Days', align: 'right', sortable: true, format: 'currency' },
      { key: 'bucket30Plus', label: '30+ Days (Overdue)', align: 'right', sortable: true, format: 'currency_red' }
    ],
    availableFilters: [
      { id: 'asOfDate', label: 'As of Date', type: 'date' },
      { id: 'customerId', label: 'Buyer', type: 'customerSelect' }
    ],
    calculationLogic: 'Computes unpaid invoice balances for each customer. Each unpaid transaction amount is assigned to an aging bucket based on days elapsed between invoice date and As-Of date. Highlighted in red if 30+ days overdue.'
  },

  'cash-book': {
    id: 'cash-book',
    name: 'Cash / Bank Book',
    description: 'Real-time record of cash and bank account receipts, walk-in customer cash sales, beopari/grower payouts, and net liquidity balances.',
    iconName: 'Wallet',
    tier: 'Tier 1 — MVP',
    tierLevel: 1,
    section: 'Daily & Financial',
    purpose: 'Monitors daily liquidity movement across cash drawers and bank accounts including walk-in cash customer sales, customer recoveries, beopari/grower payouts, and shop expenses.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'table_with_summary',
    summaryCardKeys: ['openingBalance', 'totalIn', 'walkInCash', 'totalOut', 'closingBalance'],
    dataSources: ['Payments', 'Sales', 'Expenses', 'Transactions'],
    columns: [
      { key: 'time', label: 'Time / Date', align: 'left', sortable: true },
      { key: 'partyName', label: 'Party / Entity', align: 'left', sortable: true },
      { key: 'description', label: 'Particulars / Description', align: 'left', sortable: false },
      { key: 'category', label: 'Category', align: 'center', sortable: true, format: 'badge' },
      { key: 'mode', label: 'Mode (Cash/Bank)', align: 'center', sortable: true, format: 'badge' },
      { key: 'amountIn', label: 'In / Receipt (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'amountOut', label: 'Out / Payment (Rs)', align: 'right', sortable: true, format: 'currency_red' },
      { key: 'balance', label: 'Balance (Rs)', align: 'right', sortable: true, format: 'currency' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'paymentMode', label: 'Payment Mode', type: 'select', options: ['All', 'Cash', 'Bank'] },
      { id: 'transactionType', label: 'Transaction Type', type: 'select', options: ['All', 'Inflows (Receipts & Walk-In)', 'Outflows (Payouts & Expenses)', 'Walk-in Cash Sales', 'Customer Receipts', 'Beopari/Grower Payments', 'Shop Expenses'] }
    ],
    calculationLogic: 'Inflows (Customer Receipts & Walk-in Cash Sales) add to cash/bank balance (+); Outflows (Beopari/Grower Payouts & Expenses) subtract from balance (-). Opening Balance is computed prior to selected date range; Closing Balance = Opening + Total In - Total Out.'
  },

  // TIER 2 — Phase 2 ("Operations")
  'bardana': {
    id: 'bardana',
    name: 'Bardana / Crate Report',
    description: '2-Way balance ledger auditing beopari/grower inward vs customer outward crate movements and direct return settlements.',
    iconName: 'Boxes',
    tier: 'Tier 2 — Phase 2',
    tierLevel: 2,
    section: 'Operations',
    purpose: 'Tracks beopari/grower inward crates received vs dispatched and customer outward crates issued vs returned.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'table_with_summary',
    summaryCardKeys: ['supplierInward', 'supplierReturned', 'netSupplierOwed', 'customerOutward', 'customerReturned', 'netCustomerPending'],
    dataSources: ['StockEntries', 'Sales'],
    columns: [
      { key: 'partyName', label: 'Party / Entity', align: 'left', sortable: true },
      { key: 'partyType', label: 'Movement Ledger', align: 'center', sortable: true, format: 'badge' },
      { key: 'baseQuantity', label: 'Inward / Issued Crates', align: 'right', sortable: true, format: 'number' },
      { key: 'settledQuantity', label: 'Returned / Dispatched', align: 'right', sortable: true, format: 'number' },
      { key: 'netBalance', label: 'Net Crate Balance', align: 'right', sortable: true, format: 'number_bold' },
      { key: 'status', label: 'Status', align: 'center', sortable: true, format: 'badge' },
      { key: 'lastActivityDate', label: 'Last Activity', align: 'center', sortable: true }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'partyCategory', label: 'Ledger Category', type: 'select', options: ['All Entities (2-Way View)', 'Beopari/Grower Inward Ledger', 'Customer Outward Ledger'] },
      { id: 'partyId', label: 'Party', type: 'partySelect' },
      { id: 'riskThreshold', label: 'Settlement Filter', type: 'select', options: ['All Transactions', 'Pending Return Only', 'Settled Only'] }
    ],
    calculationLogic: 'Beopari/Grower Inward Ledger: Net Owed = Inward Received - Dispatched to Beopari/Grower. Customer Outward Ledger: Net Pending = Crates Issued - Empty Crates Received from Buyer.'
  },

  // Commented code of Peshgi / Advance Report
  /*
  'advance': {
    id: 'advance',
    name: 'Peshgi / Advance Report',
    description: 'Separation of Beopari/Grower vs Customer Peshgi with real-time auto-deductions and recovery tracking.',
    iconName: 'CreditCard',
    tier: 'Tier 2 — Phase 2',
    tierLevel: 2,
    section: 'Operations',
    purpose: 'Monitors financial advance loans given to growers/beopari (زمیندار پیشگی) and advance deposits received from buyers (خریدار پیشگی) with automatic lot-wise deduction and recovery velocity tracking.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'table_with_summary',
    summaryCardKeys: ['supplierAdvanceGiven', 'supplierDeductions', 'netSupplierAdvance', 'customerAdvanceReceived', 'customerAdvanceAdjusted', 'netCustomerAdvance'],
    dataSources: ['Payments', 'StockEntries', 'Sales', 'Suppliers', 'Customers'],
    columns: [
      { key: 'partyName', label: 'Party / Entity', align: 'left', sortable: true },
      { key: 'partyType', label: 'Peshgi Category', align: 'center', sortable: true, format: 'badge' },
      { key: 'issueDate', label: 'Period / Date', align: 'left', sortable: true },
      { key: 'totalAdvance', label: 'Total Advance (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'adjustedAmount', label: 'Auto-Deductions & Recoveries (Rs)', align: 'right', sortable: true, format: 'currency_red' },
      { key: 'remainingAdvance', label: 'Remaining Balance (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'recoveryRate', label: 'Recovery Rate %', align: 'center', sortable: true, format: 'progressBadge' },
      { key: 'deductionsCount', label: 'Deductions Audit', align: 'center', sortable: false },
      { key: 'status', label: 'Settlement Status', align: 'center', sortable: true, format: 'badge' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'partyCategory', label: 'Advance Category', type: 'select', options: ['All Advances (2-Way View)', 'Beopari/Grower Peshgi (زمیندار پیشگی)', 'Customer Advance (خریدار پیشگی)'] },
      { id: 'partyId', label: 'Party', type: 'partySelect' },
      { id: 'riskThreshold', label: 'Settlement Filter', type: 'select', options: ['All Accounts', 'Pending Recovery Only', 'Fully Settled Only'] }
    ],
    calculationLogic: 'Beopari/Grower Peshgi: Net Advance = Total Disbursed - Consignment Lot Deductions - Direct Repayments. Customer Advance: Net Advance = Advance Deposits Received - Invoice Deductions. Recovery Rate = (Adjusted / Total Advance) * 100.'
  },
  */

  'absent-party': {
    id: 'absent-party',
    name: 'Absent Party Report',
    description: 'Identify regular beopari/growers who have not delivered any crop arrivals on a given date for proactive follow-up.',
    iconName: 'UserX',
    tier: 'Tier 2 — Phase 2',
    tierLevel: 2,
    section: 'Operations',
    purpose: 'Helps shop clerks identify active growers with zero stock arrivals on a chosen date to trigger procurement outreach.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'table',
    dataSources: ['Suppliers', 'StockEntries', 'Users'],
    columns: [
      { key: 'supplierName', label: 'Beopari/Grower Name', align: 'left', sortable: true },
      { key: 'phone', label: 'Mobile / Phone', align: 'left', sortable: false },
      { key: 'primaryCommodity', label: 'Primary Commodity', align: 'left', sortable: true },
      { key: 'lastArrivalDate', label: 'Last Arrival Date', align: 'left', sortable: true },
      { key: 'daysInactive', label: 'Days Inactive', align: 'right', sortable: true }
    ],
    availableFilters: [
      { id: 'asOfDate', label: 'As of Date', type: 'date' }
    ],
    calculationLogic: 'Scans registered active beopari/growers whose latest StockEntry arrival date is strictly before the chosen As-Of date. Days Inactive = As-Of Date - Last Arrival Date.'
  },

  'supplier-deductions': {
    id: 'supplier-deductions',
    name: 'Beopari/Grower Expense Deductions Report',
    description: 'Itemized audit of freight, labor (hamali), crates, commissions, and lot-specific deductions withheld from beopari/grower consignments.',
    iconName: 'Receipt',
    tier: 'Tier 1 — MVP',
    tierLevel: 1,
    section: 'Daily & Financial',
    purpose: 'Provides a complete audit of all expense deductions withheld from beopari/grower consignment settlements per lot, distinguishing freight, labor/unloading, crate expenses, advance deductions, and beopari/grower commissions without mixing Mandi operating expenses.',
    allowedRoles: ['Admin', 'Clerk', 'Supplier'],
    visualizationType: 'chart_and_table',
    chartType: 'bar',
    summaryCardKeys: ['totalConsignmentCrates', 'totalGrossValue', 'totalCommissionDeductions', 'totalLotExpenses', 'totalDeductions', 'netPayableToSuppliers'],
    dataSources: ['StockEntries', 'Sales', 'Suppliers'],
    columns: [
      { key: 'date', label: 'Arrival Date', align: 'left', sortable: true },
      { key: 'lotNo', label: 'Lot #', align: 'left', sortable: true },
      { key: 'supplierName', label: 'Beopari/Grower', align: 'left', sortable: true },
      { key: 'productName', label: 'Commodity', align: 'left', sortable: true },
      { key: 'quantity', label: 'Arrived Qty/Crates', align: 'right', sortable: true, format: 'number' },
      { key: 'soldQuantity', label: 'Sold Crates', align: 'right', sortable: true, format: 'number' },
      { key: 'grossAmount', label: 'Gross Value (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'commissionDeduction', label: 'Commission Deducted (Rs)', align: 'right', sortable: true, format: 'currency_red' },
      { key: 'lotExpenseDeduction', label: 'Lot Expenses Deducted (Rs)', align: 'right', sortable: true, format: 'currency_red' },
      { key: 'totalDeductions', label: 'Total Deductions (Rs)', align: 'right', sortable: true, format: 'currency_red' },
      { key: 'netPayable', label: 'Net Payable (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'status', label: 'Settlement Status', align: 'center', sortable: true, format: 'badge' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'supplierId', label: 'Beopari/Grower', type: 'supplierSelect' },
      { id: 'productId', label: 'Commodity', type: 'productSelect' }
    ],
    calculationLogic: 'For each consignment lot: Gross Amount = Sold Crate Revenue (or Arrival Lot Value). Commission Deducted = Percentage or Fixed rate per lot. Lot Expenses Deducted = Sum of specific lot expense items (Freight, Unloading, Crates, Municipal/Advance). Total Deductions = Commission + Lot Expenses. Net Payable = Gross Amount - Total Deductions.'
  },

  'payables': {
    id: 'payables',
    name: 'Beopari/Grower Payables Report',
    description: 'Summary of net amounts owed to farmers/beopari-growers for sold consignments, with payment aging.',
    iconName: 'ArrowDownCircle',
    tier: 'Tier 2 — Phase 2',
    tierLevel: 2,
    section: 'Operations',
    purpose: 'Tracks pending financial settlements owed to growers after deducting commission, freight, labor, and prior advances.',
    allowedRoles: ['Admin'],
    visualizationType: 'table',
    dataSources: ['StockEntries', 'Sales', 'Payments', 'Suppliers'],
    columns: [
      { key: 'supplierName', label: 'Beopari/Grower Name', align: 'left', sortable: true },
      { key: 'totalPayable', label: 'Total Net Payable (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'bucket0to7', label: '0–7 Days', align: 'right', sortable: true, format: 'currency' },
      { key: 'bucket8to15', label: '8–15 Days', align: 'right', sortable: true, format: 'currency' },
      { key: 'bucket16to30', label: '16–30 Days', align: 'right', sortable: true, format: 'currency' },
      { key: 'bucket30Plus', label: '30+ Days', align: 'right', sortable: true, format: 'currency_red' }
    ],
    availableFilters: [
      { id: 'asOfDate', label: 'As of Date', type: 'date' },
      { id: 'supplierId', label: 'Beopari/Grower', type: 'supplierSelect' }
    ],
    calculationLogic: 'Net Payable = (Gross Crate Sales - Commission Deductions - Lot Expenses) - Payments Disbursed. Unpaid balances are categorized into aging intervals based on lot sale date.'
  },

  'market-fee': {
    id: 'market-fee',
    name: 'Market Fee / Committee Levy Report',
    description: 'Official register of fixed Market / Sarkari fees deducted per consignment lot.',
    iconName: 'Receipt',
    tier: 'Tier 2 — Phase 2',
    tierLevel: 2,
    section: 'Operations',
    purpose: 'Official register of fixed Market Committee fees per consignment lot, tracking assessed amounts and settlement status.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'table_with_summary',
    summaryCardKeys: ['assessedTurnover', 'totalMarketFeeDue', 'lotsAssessed', 'averageFeePerLot'],
    dataSources: ['StockEntries', 'Sales', 'Suppliers', 'TaxSettings'],
    columns: [
      { key: 'date', label: 'Date', align: 'left', sortable: true },
      { key: 'lotNo', label: 'Lot #', align: 'left', sortable: true },
      { key: 'supplierName', label: 'Beopari/Grower / Consignor (زمیندار)', align: 'left', sortable: true },
      { key: 'commodity', label: 'Commodity (جنس)', align: 'left', sortable: true },
      { key: 'quantity', label: 'Sold Volume', align: 'right', sortable: true, format: 'number' },
      { key: 'grossTurnover', label: 'Gross Turnover (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'feeAmount', label: 'Market Fee (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'status', label: 'Settlement Status', align: 'center', sortable: true, format: 'badge' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'supplierId', label: 'Beopari/Grower', type: 'supplierSelect' },
      { id: 'productId', label: 'Commodity', type: 'productSelect' },
      { id: 'riskThreshold', label: 'Status Filter', type: 'select', options: ['All Lots', 'Settled Lots Only', 'Active / Unsettled Lots'] }
    ],
    calculationLogic: 'Market / Sarkari Fee is a fixed amount per consignment lot. Summary tracks assessed turnover and total fixed fees accrued.'
  },

  'expense': {
    id: 'expense',
    name: 'Mandi Expenses & Deductions Report',
    description: 'Itemized breakdown of labor (hamali), weighing (tulai), transport, and shop operating expenses.',
    iconName: 'TrendingDown',
    tier: 'Tier 2 — Phase 2',
    tierLevel: 2,
    section: 'Operations',
    purpose: 'Detailed audit of per-consignment labor/freight deductions and shop overhead expenses grouped by expense categories.',
    allowedRoles: ['Admin'],
    visualizationType: 'chart_and_table',
    chartType: 'bar',
    dataSources: ['Expenses', 'StockEntries'],
    columns: [
      { key: 'date', label: 'Date', align: 'left', sortable: true },
      { key: 'category', label: 'Category', align: 'center', sortable: true, format: 'badge' },
      { key: 'payee', label: 'Payee / Reference', align: 'left', sortable: true },
      { key: 'description', label: 'Description', align: 'left', sortable: false },
      { key: 'amount', label: 'Amount (Rs)', align: 'right', sortable: true, format: 'currency' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'expenseCategory', label: 'Expense Category', type: 'select', options: ['All', 'Hamali / Coolie', 'Tulai / Weighing', 'Transport / Freight', 'Shop Rent & Utilities', 'Miscellaneous'] }
    ],
    calculationLogic: 'Aggregates recorded shop expenses and lot-specific deductions. Bar chart displays expense breakdown by category.'
  },

  // TIER 3 — Analytics ("Analytics")
  'price-trend': {
    id: 'price-trend',
    name: 'Item-wise Price Trend',
    description: 'Historical commodity rate trajectories tracking real-time daily average, minimum, and maximum selling rates per commodity over time.',
    iconName: 'TrendingUp',
    tier: 'Tier 3 — Analytics',
    tierLevel: 3,
    section: 'Analytics',
    purpose: 'Helps commission agents and traders analyze price trends, peak market rate periods, price corridor fluctuations, and commodity price seasonality.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'chart_and_table',
    chartType: 'line',
    dataSources: ['Sales', 'Products', 'StockEntries'],
    columns: [
      { key: 'date', label: 'Date', align: 'left', sortable: true },
      { key: 'commodity', label: 'Commodity', align: 'left', sortable: true },
      { key: 'minRate', label: 'Min Rate (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'maxRate', label: 'Max Rate (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'avgRate', label: 'Avg Selling Rate (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'totalQty', label: 'Qty Sold (Crates)', align: 'right', sortable: true, format: 'number' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'productId', label: 'Commodity', type: 'productSelect' }
    ],
    calculationLogic: 'Filters trade transactions by date range and selected commodity. Computes daily minimum rate, maximum rate, and quantity-weighted average selling rate (Total Value / Total Quantity). Line chart displays average trend line alongside high/low rate corridors.'
  },

  'top-entities': {
    id: 'top-entities',
    name: 'Top Beopari/Growers & Buyers',
    description: 'Ranked leaderboard of top beopari/growers by supply volume and top buyers by purchase value.',
    iconName: 'BarChart2',
    tier: 'Tier 3 — Analytics',
    tierLevel: 3,
    section: 'Analytics',
    purpose: 'Identifies key commercial partners, highest volume growers, and most valuable buyers in the Mandi.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'chart_and_table',
    chartType: 'bar',
    dataSources: ['Sales', 'StockEntries', 'Suppliers', 'Customers'],
    columns: [
      { key: 'rank', label: 'Rank', align: 'center', sortable: true },
      { key: 'partyName', label: 'Party Name', align: 'left', sortable: true },
      { key: 'role', label: 'Role', align: 'center', sortable: true, format: 'badge' },
      { key: 'totalVolume', label: 'Total Volume (Crates)', align: 'right', sortable: true, format: 'number' },
      { key: 'totalValue', label: 'Trade Value (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'commissionGenerated', label: 'Commission Generated (Rs)', align: 'right', sortable: true, format: 'currency' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'entityType', label: 'Entity Type', type: 'select', options: ['Top Buyers', 'Top Beopari/Growers'] }
    ],
    calculationLogic: 'Sums quantity, trade value, and commission per party across sales and stock entries. Ranks parties in descending order for leaderboard visualization.'
  },

  'monthly-profit': {
    id: 'monthly-profit',
    name: 'Monthly Profit Summary',
    description: 'Financial performance report summarizing monthly brokerage commission revenue (Customer + Beopari/Grower) and miscellaneous income minus shop operating expenses.',
    iconName: 'PieChart',
    tier: 'Tier 3 — Analytics',
    tierLevel: 3,
    section: 'Analytics',
    purpose: 'Evaluates shop profitability month-by-month by comparing dual-sided brokerage commissions (Customer & Beopari/Grower) and miscellaneous income against total operational expenses.',
    allowedRoles: ['Admin'],
    visualizationType: 'chart_and_table',
    chartType: 'bar',
    summaryCardKeys: ['totalCustomerCommission', 'totalSupplierCommission', 'totalGrossCommission', 'totalMiscIncome', 'totalExpenses', 'netProfit', 'profitMargin'],
    dataSources: ['Sales', 'StockEntries', 'Expenses', 'Payments'],
    columns: [
      { key: 'monthYear', label: 'Month / Year', align: 'left', sortable: true },
      { key: 'customerCommission', label: 'Customer Comm (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'supplierCommission', label: 'Beopari/Grower Comm (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'grossCommission', label: 'Total Comm (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'miscIncome', label: 'Misc Income (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'totalExpenses', label: 'Total Expenses (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'netProfit', label: 'Net Profit (Rs)', align: 'right', sortable: true, format: 'currency' },
      { key: 'profitMargin', label: 'Profit Margin %', align: 'right', sortable: true, format: 'profitMargin' }
    ],
    availableFilters: [
      { id: 'dateRange', label: 'Date / Year Range', type: 'dateRange' }
    ],
    calculationLogic: 'Aggregated by Calendar Month. Total Commission = Customer Commission + Beopari/Grower Commission. Total Revenue = Total Commission + Misc Income. Net Profit = Total Revenue - Total Expenses. Margin % = (Net Profit / Total Revenue) * 100.'
  },

  'inventory': {
    id: 'inventory',
    name: 'Stock & Unsold Lot Report',
    description: 'Audit of unsold consignment lots categorized by aging days to flag perishability and spoilage risk.',
    iconName: 'AlertTriangle',
    tier: 'Tier 3 — Analytics',
    tierLevel: 3,
    section: 'Analytics',
    purpose: 'Highlights unsold stock in shop storage with perishability risk flags (Green/Yellow/Red) based on arrival age to prevent crop spoilage.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'table',
    dataSources: ['StockEntries', 'Products', 'Suppliers'],
    columns: [
      { key: 'lotNo', label: 'Lot No', align: 'left', sortable: true },
      { key: 'commodity', label: 'Commodity', align: 'left', sortable: true },
      { key: 'supplierName', label: 'Beopari/Grower Name', align: 'left', sortable: true },
      { key: 'arrivalDate', label: 'Arrival Date', align: 'left', sortable: true },
      { key: 'daysInShop', label: 'Days in Shop', align: 'right', sortable: true },
      { key: 'arrivedQty', label: 'Arrived Qty', align: 'right', sortable: true, format: 'number' },
      { key: 'unsoldQty', label: 'Unsold Qty', align: 'right', sortable: true, format: 'number_bold' },
      { key: 'riskLevel', label: 'Perishability Risk', align: 'center', sortable: true, format: 'riskBadge' }
    ],
    availableFilters: [
      { id: 'riskThreshold', label: 'Risk Threshold', type: 'select', options: ['All Lots', '2+ Days (Caution)', '4+ Days (High Risk)'] },
      { id: 'productId', label: 'Commodity', type: 'productSelect' },
      { id: 'supplierId', label: 'Beopari/Grower', type: 'supplierSelect' }
    ],
    calculationLogic: 'Filters StockEntries with remainingQuantity > 0. Days in Shop = Current Date - Arrival Date. Risk Level: High Risk (> 4 days, Red), Caution (2–4 days, Yellow), Normal (< 2 days, Green).'
  },

  'own-trading': {
    id: 'own-trading',
    name: 'Own Trading Report',
    description: 'Purchase-to-sale activity for goods purchased by the business, including landed cost, inventory value, receivables, payables, and lot-wise trading profit.',
    iconName: 'ShoppingBag',
    tier: 'Tier 3 — Analytics',
    tierLevel: 3,
    section: 'Analytics',
    purpose: 'Tracks Own Trading purchases separately from commission consignments. Profit recognizes cost only for sold or wasted stock; unsold stock remains valued as inventory.',
    allowedRoles: ['Admin', 'Clerk'],
    visualizationType: 'table',
    dataSources: ['OwnTradingPurchases', 'StockEntries', 'Sales', 'Returns', 'Payments'],
    summaryCardKeys: ['totalPurchaseValue', 'totalSalesRevenue', 'costOfGoodsSold', 'outstandingSupplierPayables', 'outstandingCustomerReceivables', 'remainingStockValue', 'grossTradingProfit', 'totalAllocatedExpenses', 'totalWastageCost', 'netTradingProfit'],
    columns: [
      { key: 'purchaseDate', label: 'Purchase Date', sortable: true },
      { key: 'purchaseReference', label: 'Purchase Reference', sortable: true },
      { key: 'sourceMandi', label: 'Source Mandi', sortable: true },
      { key: 'truckNumber', label: 'Truck Number', sortable: true },
      { key: 'lotId', label: 'Lot ID', sortable: true },
      { key: 'supplierName', label: 'Supplier / Beopari', sortable: true },
      { key: 'productName', label: 'Product', sortable: true },
      { key: 'purchasedQuantity', label: 'Purchased Qty', align: 'right', format: 'number', sortable: true },
      { key: 'unit', label: 'Unit', sortable: true },
      { key: 'purchaseRate', label: 'Purchase Rate', align: 'right', format: 'currency', sortable: true },
      { key: 'purchaseAmount', label: 'Purchase Amount', align: 'right', format: 'currency', sortable: true },
      { key: 'allocatedExpenses', label: 'Allocated Expenses', align: 'right', format: 'currency', sortable: true },
      { key: 'landedCost', label: 'Landed Cost', align: 'right', format: 'currency', sortable: true },
      { key: 'landedUnitCost', label: 'Landed Cost / Unit', align: 'right', format: 'currency', sortable: true },
      { key: 'soldQuantity', label: 'Sold Qty', align: 'right', format: 'number', sortable: true },
      { key: 'remainingQuantity', label: 'Remaining Qty', align: 'right', format: 'number', sortable: true },
      { key: 'returnedQuantity', label: 'Returned Qty', align: 'right', format: 'number', sortable: true },
      { key: 'wastageQuantity', label: 'Wasted Qty', align: 'right', format: 'number', sortable: true },
      { key: 'salesRevenue', label: 'Sales Revenue', align: 'right', format: 'currency', sortable: true },
      { key: 'costOfGoodsSold', label: 'Cost of Goods Sold', align: 'right', format: 'currency', sortable: true },
      { key: 'grossTradingProfit', label: 'Realized Profit', align: 'right', format: 'currency', sortable: true },
      { key: 'wastageCost', label: 'Wastage Cost', align: 'right', format: 'currency', sortable: true },
      { key: 'netTradingProfit', label: 'Net Trading Profit', align: 'right', format: 'currency', sortable: true },
      { key: 'supplierPayments', label: 'Supplier Payments', align: 'right', format: 'currency', sortable: true },
      { key: 'supplierPayable', label: 'Outstanding Supplier Balance', align: 'right', format: 'currency', sortable: true },
      { key: 'customerName', label: 'Customer', sortable: true },
      { key: 'customerRecoveries', label: 'Customer Recoveries', align: 'right', format: 'currency', sortable: true },
      { key: 'customerReceivable', label: 'Customer Receivable', align: 'right', format: 'currency', sortable: true },
      { key: 'saleStatus', label: 'Sale Status', sortable: true },
      { key: 'paymentStatus', label: 'Payment Status', sortable: true }
    ],
    availableFilters: [
      { id: 'dateBasis', label: 'Date Basis', type: 'select', options: ['Purchase Date', 'Purchase or Activity Date'] },
      { id: 'saleStatus', label: 'Sale Status', type: 'select', options: ['All', 'Unsold', 'Partially Sold', 'Sold'] },
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'purchaseReference', label: 'Purchase Reference', type: 'text' },
      { id: 'sourceMandi', label: 'Source Mandi', type: 'text' },
      { id: 'supplierId', label: 'Supplier / Beopari', type: 'supplierSelect' },
      { id: 'productId', label: 'Product', type: 'productSelect' },
      { id: 'lotId', label: 'Lot ID', type: 'lotSelect' },
      { id: 'paymentStatus', label: 'Payment Status', type: 'select', options: ['All', 'Paid', 'Partially Paid', 'Unpaid'] }
    ],
    calculationLogic: 'Landed cost = purchase line amount + allocated transport/loading/unloading/other costs. Cost of goods sold = net sold quantity × landed unit cost. Remaining inventory is valued at landed unit cost and is not included in sold cost. Gross trading profit = sales revenue after approved returns − cost of goods sold. Wastage cost is deducted separately for net trading profit.'
  }
};

export function getReportsBySection(userRole) {
  return REPORTS_SECTIONS.map(section => {
    const reports = Object.values(REPORTS_CONFIG).filter(
      r => r.section === section.title && (r.allowedRoles.includes(userRole) || userRole === 'super_admin')
    );
    return {
      ...section,
      reports
    };
  }).filter(s => s.reports.length > 0);
}
