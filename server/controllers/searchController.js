import { Customer, Supplier, Product, Truck, StockEntry, Sale, Payment, Expense, User, AuditLog } from '../models/index.js';
import { buildTenantQuery } from '../utils/tenant.js';
import { sanitizeCustomerData } from '../utils/customerDataAccess.js';
import { getTruckBeoparis, getTruckSupplierNames } from '../utils/truckCargo.js';

export async function getGlobalSearch(req, res) {
  try {
    const { q = '' } = req.query;
    const queryStr = String(q).trim().toLowerCase();

    if (!queryStr) {
      return res.json({
        customers: [],
        suppliers: [],
        products: [],
        trucks: [],
        lots: [],
        invoices: [],
        payments: [],
        expenses: [],
        users: []
      });
    }

    const tenantQuery = buildTenantQuery(req);
    const activeTenantQuery = buildTenantQuery(req, { isDeleted: { $ne: true } });

    // Fetch all collections in parallel
    const [
      customers,
      suppliers,
      products,
      trucks,
      stockEntries,
      sales,
      payments,
      expenses,
      users
    ] = await Promise.all([
      Customer.find(activeTenantQuery),
      Supplier.find(activeTenantQuery),
      Product.find(tenantQuery),
      Truck.find(tenantQuery),
      StockEntry.find(tenantQuery),
      Sale.find(tenantQuery),
      Payment.find(tenantQuery),
      Expense.find(tenantQuery),
      User.find(activeTenantQuery)
    ]);

    // Perform case-insensitive search matching in JS for maximum compatibility
    const results = {
      customers: [],
      suppliers: [],
      products: [],
      trucks: [],
      lots: [],
      invoices: [],
      payments: [],
      expenses: [],
      users: []
    };

    // Helper match function
    const matches = (field, term) => {
      if (!field) return false;
      return String(field).toLowerCase().includes(term);
    };

    // 1. Customers
    customers.forEach(c => {
      if (matches(c.name, queryStr) || matches(c.phone, queryStr) || matches(c.address, queryStr)) {
        results.customers.push({
          id: c.id || c._id,
          name: c.name,
          recordNumber: c.id || c._id,
          relatedInfo: `Phone: ${c.phone || 'N/A'} | Balance: Rs. ${c.currentBalance || 0}`,
          moduleName: 'Customers',
          createdAt: c.createdAt || c.updatedAt
        });
      }
    });

    // 2. Suppliers
    suppliers.forEach(s => {
      if (matches(s.name, queryStr) || matches(s.phone, queryStr) || matches(s.cnic, queryStr) || matches(s.address, queryStr)) {
        results.suppliers.push({
          id: s.id || s._id,
          name: s.name,
          recordNumber: s.id || s._id,
          relatedInfo: `Phone: ${s.phone || 'N/A'} | CNIC: ${s.cnic || 'N/A'} | Balance: Rs. ${s.currentBalance || 0}`,
          moduleName: 'Suppliers',
          createdAt: s.createdAt || s.updatedAt
        });
      }
    });

    // 3. Products
    products.forEach(p => {
      if (matches(p.name, queryStr) || matches(p.category, queryStr)) {
        results.products.push({
          id: p.id || p._id,
          name: p.name,
          recordNumber: p.id || p._id,
          relatedInfo: `Category: ${p.category} | Unit: ${p.unit} | Stock: ${p.currentQuantity || 0}`,
          moduleName: 'Products',
          createdAt: p.createdAt || p.updatedAt
        });
      }
    });

    // 4. Trucks
    trucks.forEach(t => {
      const supplierNames = getTruckSupplierNames(t);
      const productNames = getTruckBeoparis(t).flatMap(entry => entry.products || []).map(product => product.productName);
      if (matches(t.truckNumber, queryStr) || matches(t.driverName, queryStr) || matches(t.driverPhone, queryStr) || supplierNames.some(name => matches(name, queryStr)) || productNames.some(name => matches(name, queryStr)) || matches(t.notes, queryStr)) {
        results.trucks.push({
          id: t.id || t._id,
          name: `Truck: ${t.truckNumber}`,
          recordNumber: t.truckNumber,
          relatedInfo: `Driver: ${t.driverName || 'N/A'} | Supplier: ${supplierNames.join(', ') || t.supplierName || 'N/A'} | Status: ${t.status}`,
          moduleName: 'Trucks',
          createdAt: t.createdAt || t.arrivalDate
        });
      }
    });

    // 5. Lots (StockEntries)
    stockEntries.forEach(se => {
      const lotId = se.id || se._id;
      if (matches(lotId, queryStr) || matches(se.supplierName, queryStr) || matches(se.productName, queryStr) || matches(String(se.purchaseRate), queryStr)) {
        results.lots.push({
          id: lotId,
          name: `Lot of ${se.productName}`,
          recordNumber: lotId ? `LOT-${String(lotId).slice(-6).toUpperCase()}` : 'LOT-N/A',
          relatedInfo: `Supplier: ${se.supplierName} | Qty: ${se.quantity} | Rate: Rs. ${se.purchaseRate}`,
          moduleName: 'Lots',
          createdAt: se.createdAt || se.date
        });
      }
    });

    // 6. Invoices (Sales)
    sales.forEach(sale => {
      const saleId = sale.id || sale._id;
      if (matches(saleId, queryStr) || matches(sale.customerName, queryStr) || matches(sale.productName, queryStr) || matches(String(sale.saleRate), queryStr)) {
        results.invoices.push({
          id: saleId,
          name: `Sale: ${sale.productName}`,
          recordNumber: saleId ? `INV-${String(saleId).slice(-6).toUpperCase()}` : 'INV-N/A',
          relatedInfo: `Customer: ${sale.customerName} | Qty: ${sale.quantity} | Rate: Rs. ${sale.saleRate} | Total: Rs. ${sale.totalAmount}`,
          moduleName: 'Invoices',
          createdAt: sale.createdAt || sale.date
        });
      }
    });

    // 7. Payments
    payments.forEach(p => {
      const paymentId = p.id || p._id;
      if (matches(paymentId, queryStr) || matches(p.partyName, queryStr) || matches(p.description, queryStr) || matches(String(p.amount), queryStr)) {
        results.payments.push({
          id: paymentId,
          name: `${p.partyType} Payment (${p.type})`,
          recordNumber: paymentId ? `PAY-${String(paymentId).slice(-6).toUpperCase()}` : 'PAY-N/A',
          relatedInfo: `Party: ${p.partyName} | Amount: Rs. ${p.amount} | Description: ${p.description || 'N/A'}`,
          moduleName: 'Payments',
          createdAt: p.createdAt || p.date
        });
      }
    });

    // 8. Expenses
    expenses.forEach(e => {
      const expId = e.id || e._id;
      if (matches(expId, queryStr) || matches(e.category, queryStr) || matches(e.description, queryStr) || matches(String(e.amount), queryStr)) {
        results.expenses.push({
          id: expId,
          name: `Expense: ${e.category}`,
          recordNumber: expId ? `EXP-${String(expId).slice(-6).toUpperCase()}` : 'EXP-N/A',
          relatedInfo: `Amount: Rs. ${e.amount} | Description: ${e.description || 'N/A'}`,
          moduleName: 'Expenses',
          createdAt: e.createdAt || e.date
        });
      }
    });

    // 9. Users / Clerks
    users.forEach(u => {
      if (matches(u.name, queryStr) || matches(u.email, queryStr) || matches(u.phone, queryStr) || matches(u.role, queryStr)) {
        results.users.push({
          id: u.id || u._id,
          name: u.name,
          recordNumber: u.role,
          relatedInfo: `Email: ${u.email} | Phone: ${u.phone} | Status: ${u.status}`,
          moduleName: u.role === 'Clerk' ? 'Clerks' : 'Users',
          createdAt: u.createdAt || u.updatedAt
        });
      }
    });

    if (req.user?.role === 'Customer') {
      const customer = await Customer.findOne(buildTenantQuery(req, { userId: req.user.id }));
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      const customerId = String(customer.id || customer._id);
      const ownInvoices = sales.filter(sale => String(sale.customerId) === customerId && (
        matches(sale.id || sale._id, queryStr) || matches(sale.customerName, queryStr) || matches(sale.productName, queryStr)
      )).map(sale => ({
        id: sale.id || sale._id,
        name: `Sale: ${sale.productName}`,
        recordNumber: `INV-${String(sale.id || sale._id).slice(-6).toUpperCase()}`,
        relatedInfo: `Product: ${sale.productName} | Qty: ${sale.quantity} | Total payable: Rs. ${sale.totalAmount}`,
        moduleName: 'Invoices',
        createdAt: sale.createdAt || sale.date,
      }));
      const ownPayments = payments.filter(payment =>
        payment.partyType === 'Customer' && String(payment.partyId) === customerId && (
          matches(payment.id || payment._id, queryStr) || matches(payment.partyName, queryStr) || matches(String(payment.amount), queryStr)
        )
      ).map(payment => ({
        id: payment.id || payment._id,
        name: `Customer Payment (${payment.type})`,
        recordNumber: `PAY-${String(payment.id || payment._id).slice(-6).toUpperCase()}`,
        relatedInfo: `Amount: Rs. ${payment.amount} | Date: ${payment.date}`,
        moduleName: 'Payments',
        createdAt: payment.createdAt || payment.date,
      }));
      return res.json(sanitizeCustomerData({
        customers: results.customers.filter(item => String(item.id) === customerId),
        suppliers: [],
        products: results.products,
        trucks: [],
        lots: [],
        invoices: ownInvoices,
        payments: ownPayments,
        expenses: [],
        users: [],
      }));
    }

    res.json(results);
  } catch (err) {
    console.error('Global search error:', err);
    res.status(500).json({ error: 'Failed to perform search query.' });
  }
}

export async function getRecentActivities(req, res) {
  try {
    const tenantQuery = buildTenantQuery(req);

    // Fetch all relevant collections in parallel safely
    const [
      sales,
      stockEntries,
      expenses,
      payments,
      suppliers,
      customers,
      products,
      trucks,
      auditLogs
    ] = await Promise.all([
      Sale.find(tenantQuery).catch(() => []),
      StockEntry.find(tenantQuery).catch(() => []),
      Expense.find(tenantQuery).catch(() => []),
      Payment.find(tenantQuery).catch(() => []),
      Supplier.find(tenantQuery).catch(() => []),
      Customer.find(tenantQuery).catch(() => []),
      Product.find(tenantQuery).catch(() => []),
      Truck.find(tenantQuery).catch(() => []),
      AuditLog.find(tenantQuery).catch(() => [])
    ]);

    // Create a helper map to find User/Clerk name from AuditLog
    const getOperatorName = (entityId, actionPrefix) => {
      try {
        if (!entityId) return 'Admin';
        const entityStr = String(entityId);
        const matchedLog = (auditLogs || []).find(log => {
          if (!log) return false;
          let detailsStr = '';
          if (typeof log.details === 'string') {
            detailsStr = log.details;
          } else if (log.details) {
            try { detailsStr = JSON.stringify(log.details); } catch (e) { detailsStr = ''; }
          }
          let actionStr = '';
          if (typeof log.action === 'string') {
            actionStr = log.action;
          } else if (log.action) {
            actionStr = String(log.action);
          }
          return detailsStr.includes(entityStr) || (actionPrefix && actionStr.includes(actionPrefix));
        });
        return matchedLog ? (matchedLog.userName || matchedLog.user || 'Admin') : 'Admin';
      } catch (err) {
        return 'Admin';
      }
    };

    const activities = [];
    const isCustomer = req.user?.role === 'Customer';
    const customer = isCustomer ? await Customer.findOne(buildTenantQuery(req, { userId: req.user.id })) : null;
    if (isCustomer && !customer) return res.status(404).json({ error: 'Customer not found.' });
    const customerId = isCustomer ? String(customer.id || customer._id) : null;
    const customerVisibleActivityIds = new Set();

    // Helper to safely format Date and Time
    const getFormattedDateTime = (dateStr) => {
      try {
        if (!dateStr) return { date: '--', time: '--:--', timestamp: new Date(0) };
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return { date: String(dateStr) || '--', time: '--:--', timestamp: new Date(0) };
        
        const datePart = d.toISOString().split('T')[0];
        const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        return { date: datePart, time: timePart, timestamp: d };
      } catch (e) {
        return { date: String(dateStr) || '--', time: '--:--', timestamp: new Date(0) };
      }
    };

    // 1. Sales -> Sales / Invoice Generated
    (sales || []).forEach(sale => {
      if (!sale) return;
      if (isCustomer && String(sale.customerId) !== customerId) return;
      const saleId = sale.id || sale._id;
      const { date, time, timestamp } = getFormattedDateTime(sale.createdAt || sale.date);
      
      activities.push({
        id: `sale-${saleId}`,
        timestamp,
        date: sale.date || date,
        time,
        type: 'Sale Created',
        module: 'Sales',
        user: getOperatorName(saleId, 'SALE') || 'Admin',
        relatedParty: sale.customerName,
        amount: sale.totalAmount,
        status: 'Completed',
        reference: saleId ? `INV-${String(saleId).slice(-6).toUpperCase()}` : 'INV-N/A',
        rawId: saleId
      });
      if (isCustomer) customerVisibleActivityIds.add(`sale-${saleId}`);
    });

    // 2. StockEntry -> Purchases / Lot Created
    (stockEntries || []).forEach(se => {
      if (!se) return;
      const entryId = se.id || se._id;
      const { date, time, timestamp } = getFormattedDateTime(se.createdAt || se.date);

      activities.push({
        id: `stock-${entryId}`,
        timestamp,
        date: se.date || date,
        time,
        type: 'Lot Created',
        module: 'Purchases',
        user: getOperatorName(entryId, 'STOCK') || 'Admin',
        relatedParty: se.supplierName,
        amount: se.totalAmount,
        status: 'Active',
        reference: entryId ? `LOT-${String(entryId).slice(-6).toUpperCase()}` : 'LOT-N/A',
        rawId: entryId
      });
    });

    // 3. Expense -> Expense Added
    (expenses || []).forEach(e => {
      if (!e) return;
      const expId = e.id || e._id;
      const { date, time, timestamp } = getFormattedDateTime(e.createdAt || e.date);

      activities.push({
        id: `expense-${expId}`,
        timestamp,
        date: e.date || date,
        time,
        type: 'Expense Added',
        module: 'Expenses',
        user: e.recordedBy || 'Admin',
        relatedParty: e.category,
        amount: e.amount,
        status: 'Paid',
        reference: expId ? `EXP-${String(expId).slice(-6).toUpperCase()}` : 'EXP-N/A',
        rawId: expId
      });
    });

    // 4. Payments -> Payment Received / Payment Paid (Customer / Supplier)
    (payments || []).forEach(p => {
      if (!p) return;
      if (isCustomer && (p.partyType !== 'Customer' || String(p.partyId) !== customerId)) return;
      const pId = p.id || p._id;
      const { date, time, timestamp } = getFormattedDateTime(p.createdAt || p.date);

      activities.push({
        id: `payment-${pId}`,
        timestamp,
        date: p.date || date,
        time,
        type: p.type === 'Received' ? 'Payment Received' : 'Payment Paid',
        module: 'Payments',
        user: getOperatorName(pId, 'PAYMENT') || 'Admin',
        relatedParty: p.partyName,
        amount: p.amount,
        status: 'Completed',
        reference: pId ? `PAY-${String(pId).slice(-6).toUpperCase()}` : 'PAY-N/A',
        rawId: pId
      });
      if (isCustomer) customerVisibleActivityIds.add(`payment-${pId}`);
    });

    // 5. Supplier -> Supplier Added
    (suppliers || []).forEach(s => {
      if (!s) return;
      const sId = s.id || s._id;
      const { date, time, timestamp } = getFormattedDateTime(s.createdAt);

      activities.push({
        id: `supplier-${sId}`,
        timestamp,
        date,
        time,
        type: 'Supplier Added',
        module: 'Suppliers',
        user: getOperatorName(sId, 'SUPPLIER') || 'Admin',
        relatedParty: s.name,
        amount: null,
        status: 'Active',
        reference: sId ? `SUP-${String(sId).slice(-6).toUpperCase()}` : 'SUP-N/A',
        rawId: sId
      });
    });

    // 6. Customer -> Customer Added
    (customers || []).forEach(c => {
      if (!c) return;
      const cId = c.id || c._id;
      const { date, time, timestamp } = getFormattedDateTime(c.createdAt);

      activities.push({
        id: `customer-${cId}`,
        timestamp,
        date,
        time,
        type: 'Customer Added',
        module: 'Customers',
        user: getOperatorName(cId, 'CUSTOMER') || 'Admin',
        relatedParty: c.name,
        amount: null,
        status: 'Active',
        reference: cId ? `CUST-${String(cId).slice(-6).toUpperCase()}` : 'CUST-N/A',
        rawId: cId
      });
    });

    // 7. Product -> Product Added
    (products || []).forEach(p => {
      if (!p) return;
      const pId = p.id || p._id;
      const { date, time, timestamp } = getFormattedDateTime(p.createdAt);

      activities.push({
        id: `product-${pId}`,
        timestamp,
        date,
        time,
        type: 'Product Added',
        module: 'Products',
        user: getOperatorName(pId, 'PRODUCT') || 'Admin',
        relatedParty: p.name,
        amount: p.purchaseRate || null,
        status: 'Active',
        reference: pId ? `PROD-${String(pId).slice(-6).toUpperCase()}` : 'PROD-N/A',
        rawId: pId
      });
    });

    // 8. Truck -> Truck Received
    (trucks || []).forEach(t => {
      if (!t) return;
      const tId = t.id || t._id;
      const { date, time, timestamp } = getFormattedDateTime(t.createdAt || t.arrivalDate);

      activities.push({
        id: `truck-${tId}`,
        timestamp,
        date: t.arrivalDate || date,
        time,
        type: 'Truck Received',
        module: 'Trucks',
        user: getOperatorName(tId, 'TRUCK') || 'Admin',
        relatedParty: getTruckSupplierNames(t).join(', ') || t.supplierName || t.driverName || 'N/A',
        amount: null,
        status: t.status,
        reference: t.truckNumber,
        rawId: tId
      });
    });

    // 9. AuditLogs -> Record Cancelled / Reversals
    (auditLogs || []).forEach(log => {
      if (!log) return;
      const action = String(log.action || '').toUpperCase();
      if (action.includes('DELETE') || action.includes('CANCEL') || action.includes('REVERT') || action.includes('REVERSE')) {
        const logId = log.id || log._id;
        const { date, time, timestamp } = getFormattedDateTime(log.timestamp);
        
        let moduleName = 'Other';
        if (action.includes('SALE')) moduleName = 'Sales';
        else if (action.includes('STOCK')) moduleName = 'Purchases';
        else if (action.includes('PAYMENT')) moduleName = 'Payments';
        else if (action.includes('EXPENSE')) moduleName = 'Expenses';
        else if (action.includes('CUSTOMER')) moduleName = 'Customers';
        else if (action.includes('SUPPLIER')) moduleName = 'Suppliers';
        else if (action.includes('PRODUCT')) moduleName = 'Products';
        else if (action.includes('TRUCK')) moduleName = 'Trucks';

        // Attempt to extract Rs. amount from description
        let amount = null;
        if (log.details) {
          const detailsStr = typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
          const match = detailsStr.match(/Rs\.\s*([\d,]+(?:\.\d+)?)/i);
          if (match) {
            amount = parseFloat(match[1].replace(/,/g, ''));
          }
        }

        // Make the action name human-friendly
        let typeName = 'Record Cancelled';
        if (action.includes('SALE')) typeName = 'Sale Cancelled';
        else if (action.includes('STOCK')) typeName = 'Lot Cancelled';
        else if (action.includes('PAYMENT')) typeName = 'Payment Cancelled';
        else if (action.includes('EXPENSE')) typeName = 'Expense Cancelled';

        activities.push({
          id: `deleted-${logId}`,
          timestamp,
          date,
          time,
          type: typeName,
          module: moduleName,
          user: log.userName || 'Admin',
          relatedParty: log.details || 'Record cancelled / deleted',
          amount,
          status: 'Cancelled',
          reference: logId ? `DEL-${String(logId).slice(-6).toUpperCase()}` : 'DEL-N/A',
          rawId: logId
        });
      }
    });

    // Sort by timestamp DESC (newest first)
    activities.sort((a, b) => {
      const timeB = (b.timestamp && b.timestamp instanceof Date && !isNaN(b.timestamp.getTime())) ? b.timestamp.getTime() : 0;
      const timeA = (a.timestamp && a.timestamp instanceof Date && !isNaN(a.timestamp.getTime())) ? a.timestamp.getTime() : 0;
      return timeB - timeA;
    });

    res.json(isCustomer
      ? activities.filter(activity => customerVisibleActivityIds.has(activity.id))
      : activities);
  } catch (err) {
    console.error('Recent activities error:', err);
    res.status(500).json({ error: 'Failed to fetch recent activities.' });
  }
}
