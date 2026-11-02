import { StockEntry, Sale, Product, Supplier, Customer, Ledger, Payment, Expense, Truck, User, ReturnRecord, OwnTradingPurchase } from '../models/index.js';
import { CommissionRule } from '../models/settings.js';
import { calculateCommission } from '../utils/commissionService.js';
import { buildTenantQuery } from '../utils/tenant.js';
import { sanitizeCustomerData } from '../utils/customerDataAccess.js';
import { filterTruckToSupplier, truckHasSupplier } from '../utils/truckCargo.js';
import { loadOwnTradingReport } from '../utils/ownTradingReportData.js';

export async function getReports(req, res) {
  try {
    let { 
      type, // 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
      startDate, 
      endDate, 
      productId, 
      supplierId, 
      customerId, 
      category, 
      truckNumber, 
      clerkId 
    } = req.query;

    const today = new Date();
    const formatLocalDate = (d) => {
      const dateObj = d instanceof Date ? d : new Date(d);
      if (isNaN(dateObj.getTime())) return '';
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let startStr = '';
    let endStr = formatLocalDate(today);

    // 1. Resolve Date Range Filters
    if (type === 'daily' || type === 'Today') {
      startStr = endStr;
    } else if (type === 'Yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      startStr = formatLocalDate(yesterday);
      endStr = startStr;
    } else if (type === 'weekly' || type === 'This Week') {
      // Current week from Monday to Sunday
      const day = today.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);
      const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday + 6);
      startStr = formatLocalDate(monday);
      endStr = formatLocalDate(sunday);
    } else if (type === 'monthly' || type === 'This Month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startStr = formatLocalDate(firstDay);
      endStr = formatLocalDate(lastDay);
    } else if (type === 'yearly' || type === 'This Year') {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      const lastDay = new Date(today.getFullYear(), 11, 31);
      startStr = formatLocalDate(firstDay);
      endStr = formatLocalDate(lastDay);
    } else if (type === 'custom') {
      startStr = startDate || '1970-01-01';
      endStr = endDate || endStr;
    } else {
      // Default to last 30 days
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      startStr = formatLocalDate(oneMonthAgo);
    }

    // Helper to check if a date is within selected range (inclusive)
    const inRange = (dateStr) => {
      if (!dateStr) return false;
      const dateStrClean = dateStr instanceof Date 
        ? dateStr.toISOString() 
        : (typeof dateStr.toISOString === 'function' 
            ? dateStr.toISOString() 
            : String(dateStr));
      const cleanDate = dateStrClean.split('T')[0];
      return cleanDate >= startStr && cleanDate <= endStr;
    };

    // 2. Load all raw datasets to run dynamic in-memory analytical aggregation
    let [
      allStock,
      allSales,
      allProducts,
      allSuppliers,
      allCustomers,
      allLedgers,
      allPayments,
      allExpenses,
      allTrucks,
      allUsers,
      allReturns
    ] = await Promise.all([
      StockEntry.find(buildTenantQuery(req)),
      Sale.find(buildTenantQuery(req)),
      Product.find(buildTenantQuery(req)),
      Supplier.find(buildTenantQuery(req)),
      Customer.find(buildTenantQuery(req)),
      Ledger.find(buildTenantQuery(req)),
      Payment.find(buildTenantQuery(req)),
      Expense.find(buildTenantQuery(req)),
      Truck.find(buildTenantQuery(req)),
      User.find(buildTenantQuery(req)),
      ReturnRecord.find(buildTenantQuery(req))
    ]);

    if (req.user?.role === 'Supplier') {
      const supplier = allSuppliers.find(item => String(item.userId) === String(req.user.id));
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      const supplierIdForUser = String(supplier.id || supplier._id);
      const ownStock = allStock.filter(item => String(item.supplierId) === supplierIdForUser);
      const ownStockIds = new Set(ownStock.map(item => String(item.id || item._id)));
      const ownProductIds = new Set(ownStock.map(item => String(item.productId)));
      allStock = ownStock;
      allSales = allSales.filter(item => ownStockIds.has(String(item.stockEntryId)));
      allProducts = allProducts.filter(item => ownProductIds.has(String(item.id || item._id)));
      allSuppliers = [supplier];
      allCustomers = [];
      allLedgers = allLedgers.filter(item => item.partyType === 'Supplier' && String(item.partyId) === supplierIdForUser);
      allPayments = allPayments.filter(item => item.partyType === 'Supplier' && String(item.partyId) === supplierIdForUser);
      allExpenses = [];
      allTrucks = allTrucks.map(item => filterTruckToSupplier(item, supplierIdForUser)).filter(Boolean);
      allUsers = [];
      allReturns = allReturns.filter(item => String(item.supplierId) === supplierIdForUser || ownStockIds.has(String(item.stockEntryId)));
      supplierId = supplierIdForUser;
      customerId = '';
    } else if (req.user?.role === 'Customer') {
      const customer = allCustomers.find(item => String(item.userId) === String(req.user.id));
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      const customerIdForUser = String(customer.id || customer._id);
      const ownSales = allSales.filter(item => String(item.customerId) === customerIdForUser);
      const ownProductIds = new Set(ownSales.map(item => String(item.productId)));
      allStock = [];
      allSales = ownSales;
      allProducts = allProducts.filter(item => ownProductIds.has(String(item.id || item._id)));
      allSuppliers = [];
      allCustomers = [customer];
      allLedgers = allLedgers.filter(item => item.partyType === 'Customer' && String(item.partyId) === customerIdForUser);
      allPayments = allPayments.filter(item => item.partyType === 'Customer' && String(item.partyId) === customerIdForUser);
      allExpenses = [];
      allTrucks = [];
      allUsers = [];
      allReturns = allReturns.filter(item => String(item.customerId) === customerIdForUser);
      supplierId = '';
      customerId = customerIdForUser;
    }

    // Make products, suppliers, customers, and stock dictionaries for super-fast lookups
    const productsMap = new Map(allProducts.map(p => [p.id || p._id, p]));
    const suppliersMap = new Map(allSuppliers.map(s => [s.id || s._id, s]));
    const customersMap = new Map(allCustomers.map(c => [c.id || c._id, c]));
    const stockMap = new Map(allStock.map(s => [s.id || s._id, s]));

    // Approved Produce Returns Map & Calculations
    const approvedProduceReturns = (allReturns || []).filter(r => 
      r.status === 'Approved' && 
      !r.isDeleted && 
      (r.returnType === 'Produce' || r.returnType === 'Both')
    );

    // Map returns by stockEntryId and saleId for precise deductions
    const returnsByStockEntryId = new Map();
    const returnsBySaleId = new Map();
    approvedProduceReturns.forEach(ret => {
      let stId = ret.stockEntryId ? String(ret.stockEntryId) : null;
      if (!stId && ret.saleId) {
        const foundSale = allSales.find(s => String(s.id || s._id) === String(ret.saleId));
        if (foundSale?.stockEntryId) stId = String(foundSale.stockEntryId);
      }
      if (stId) {
        if (!returnsByStockEntryId.has(stId)) returnsByStockEntryId.set(stId, []);
        returnsByStockEntryId.get(stId).push(ret);
      }
      if (ret.saleId) {
        const saleKey = String(ret.saleId);
        if (!returnsBySaleId.has(saleKey)) returnsBySaleId.set(saleKey, []);
        returnsBySaleId.get(saleKey).push(ret);
      }
    });

    // 3. Apply Multi-level Global Filters
    // 3.1 Stock Arrivals filtering
    const filteredStock = allStock.filter(entry => {
      if (!inRange(entry.date)) return false;
      if (productId && entry.productId !== productId) return false;
      if (supplierId && entry.supplierId !== supplierId) return false;
      
      const prod = productsMap.get(entry.productId);
      if (category && (!prod || prod.category !== category)) return false;
      return true;
    });

    // 3.2 Sales filtering
    const filteredSales = allSales.filter(sale => {
      if (!inRange(sale.date)) return false;
      if (productId && sale.productId !== productId) return false;
      if (customerId && sale.customerId !== customerId) return false;
      
      const prod = productsMap.get(sale.productId);
      if (category && (!prod || prod.category !== category)) return false;

      // Find consignment to get supplier
      if (supplierId) {
        const consignment = allStock.find(st => st.id === sale.stockEntryId || st._id === sale.stockEntryId);
        if (!consignment || consignment.supplierId !== supplierId) return false;
      }
      return true;
    });

    // 3.3 Payments filtering
    const filteredPayments = allPayments.filter(pay => {
      if (!inRange(pay.date)) return false;
      if (supplierId && pay.partyId !== supplierId) return false;
      if (customerId && pay.partyId !== customerId) return false;
      return true;
    });

    // 3.4 Expenses filtering
    const filteredExpenses = allExpenses.filter(exp => {
      return inRange(exp.date);
    });

    // 3.5 Trucks filtering
    const filteredTrucks = allTrucks.filter(t => {
      if (!inRange(t.arrivalDate)) return false;
      if (supplierId && !truckHasSupplier(t, supplierId)) return false;
      if (truckNumber && t.truckNumber.toLowerCase() !== truckNumber.toLowerCase()) return false;
      return true;
    }).map(t => supplierId ? filterTruckToSupplier(t, supplierId) : t).filter(Boolean);

    // Returns filtering
    const filteredReturns = approvedProduceReturns.filter(ret => {
      if (!inRange(ret.date)) return false;
      if (customerId && ret.customerId !== customerId) return false;
      if (productId && ret.productId !== productId) return false;
      if (supplierId) {
        let stId = ret.stockEntryId ? String(ret.stockEntryId) : null;
        if (!stId && ret.saleId) {
          const foundSale = allSales.find(s => String(s.id || s._id) === String(ret.saleId));
          if (foundSale?.stockEntryId) stId = String(foundSale.stockEntryId);
        }
        const consignment = stId ? allStock.find(st => String(st.id || st._id) === stId) : null;
        if (!consignment || consignment.supplierId !== supplierId) return false;
      }
      return true;
    });

    // 4. Calculations

    // 4.1 Financial Summary calculations
    let rawPurchasesTotal = 0;
    let rawPurchasesQty = 0;
    filteredStock.forEach(entry => {
      rawPurchasesTotal += entry.totalAmount || 0;
      rawPurchasesQty += entry.quantity || 0;
    });

    let rawSalesTotal = 0;
    let rawSalesQty = 0;
    let totalDiscounts = 0;
    let walkInRevenue = 0;
    filteredSales.forEach(sale => {
      rawSalesTotal += sale.totalAmount || 0;
      rawSalesQty += sale.quantity || 0;
      totalDiscounts += sale.discount || 0;
      if (sale.isWalkIn) {
        walkInRevenue += sale.totalAmount || 0;
      }
    });

    // Deduct approved returns from Gross Sales Revenue (stock value + commission of return stock), Sold Quantity, and Total Cost of Stock
    let totalReturnedGrossSalesValue = 0;
    let totalReturnedProduceQty = 0;
    let totalReturnedStockCost = 0;
    let totalReturnedSaleValue = 0;
    let totalReturnedBuyerCommission = 0;
    let walkInReturnsDeduction = 0;

    filteredReturns.forEach(ret => {
      const retQty = Number(ret.produceReturnedQty) || 0;
      const retGross = Number(ret.grossReturnAmount) || (retQty * (Number(ret.saleRate) || 0));

      const matchingSale = ret.saleId ? allSales.find(s => String(s.id || s._id) === String(ret.saleId)) : null;
      let retComm = Number(ret.commissionReversedAmount) || 0;
      if (!retComm && retQty > 0) {
        if (matchingSale && Number(matchingSale.quantity) > 0 && Number(matchingSale.commissionAmount) > 0) {
          retComm = retQty * (Number(matchingSale.commissionAmount) / Number(matchingSale.quantity));
        } else {
          const commRate = parseFloat(String(ret.commissionRate || 0).replace(/[^\d.]/g, '')) || 0;
          retComm = retGross * (commRate / 100);
        }
      }
      const totalReturnDeduction = Number(ret.returnAmount) || (retGross + retComm);

      totalReturnedGrossSalesValue += retGross;
      totalReturnedBuyerCommission += retComm;
      totalReturnedSaleValue += totalReturnDeduction;
      totalReturnedProduceQty += retQty;

      if (matchingSale?.isWalkIn || ret.isWalkIn) {
        walkInReturnsDeduction += totalReturnDeduction;
      }

      // Determine unit cost for the returned consignment / stock entry
      let stId = ret.stockEntryId ? String(ret.stockEntryId) : null;
      if (!stId && ret.saleId) {
        const foundSale = allSales.find(s => String(s.id || s._id) === String(ret.saleId));
        if (foundSale?.stockEntryId) stId = String(foundSale.stockEntryId);
      }
      const consignment = stId ? allStock.find(st => String(st.id || st._id) === stId) : null;
      let unitCost = 0;
      if (consignment) {
        if (Number(consignment.purchaseRate) > 0) {
          unitCost = Number(consignment.purchaseRate);
        } else if (Number(consignment.totalAmount) > 0 && Number(consignment.quantity) > 0) {
          unitCost = Number(consignment.totalAmount) / Number(consignment.quantity);
        } else {
          unitCost = Number(ret.saleRate) || 0;
        }
      } else {
        unitCost = Number(ret.saleRate) || 0;
      }
      totalReturnedStockCost += (retQty * unitCost);
    });

    const totalSales = Math.max(0, Math.round((rawSalesTotal - totalReturnedSaleValue) * 100) / 100);
    const totalSalesQty = Math.max(0, rawSalesQty - totalReturnedProduceQty);
    const totalPurchases = Math.max(0, Math.round((rawPurchasesTotal - totalReturnedStockCost) * 100) / 100);
    const totalPurchasesQty = Math.max(0, rawPurchasesQty - totalReturnedProduceQty);
    const netWalkInRevenue = Math.max(0, Math.round((walkInRevenue - walkInReturnsDeduction) * 100) / 100);

    // Compute dynamic commissions for filtered sales (Customer Commission - reversed on returns)
    let totalCustomerCommission = 0;
    for (const sale of filteredSales) {
      let commission = sale.commissionAmount;
      if (commission === undefined || commission === null) {
        commission = 0;
      }

      // Deduct reversed commission on returned items for this sale
      const sId = String(sale.id || sale._id);
      const saleReturns = returnsBySaleId.get(sId) || [];
      const reversedComm = saleReturns.reduce((sum, r) => {
        let rev = Number(r.commissionReversedAmount) || 0;
        if (!rev && Number(r.produceReturnedQty) > 0) {
          const qty = Number(sale.quantity) || 0;
          const comm = Number(sale.commissionAmount) || 0;
          if (qty > 0 && comm > 0) {
            rev = (Number(r.produceReturnedQty) * (comm / qty));
          } else {
            const commRate = parseFloat(String(r.commissionRate || 0).replace(/[^\d.]/g, '')) || 0;
            const gross = Number(r.grossReturnAmount) || (Number(r.produceReturnedQty) * Number(r.saleRate || 0));
            rev = gross * (commRate / 100);
          }
        }
        return sum + (rev || 0);
      }, 0);
      const netSaleComm = Math.max(0, (commission || 0) - reversedComm);

      totalCustomerCommission += netSaleComm;
    }
    totalCustomerCommission = Math.round(totalCustomerCommission * 100) / 100;

    // Compute dynamic commission deducted from suppliers across filtered stock / lots (net of returns)
    let totalSupplierCommission = 0;
    for (const entry of filteredStock) {
      const entryId = String(entry.id || entry._id);
      const lotSales = allSales.filter(s => String(s.stockEntryId) === entryId);
      const lotReturns = returnsByStockEntryId.get(entryId) || [];

      const rawLotGrossSales = lotSales.reduce((sum, s) => sum + (s.grossSale || (s.quantity * s.saleRate)), 0);
      const rawLotQtySold = lotSales.reduce((sum, s) => sum + s.quantity, 0);

      const returnedLotGross = lotReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
      const returnedLotQty = lotReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);

      const lotGrossSales = Math.max(0, rawLotGrossSales - returnedLotGross);
      const lotQtySold = Math.max(0, rawLotQtySold - returnedLotQty);

      const commVal = Number(entry.supplierCommissionValue) || 0;
      const commType = entry.supplierCommissionType || 'Percentage';

      let supplierCommissionDeduction = 0;
      if (commType === 'Percentage') {
        supplierCommissionDeduction = lotGrossSales * (commVal / 100);
      } else if (commType === 'Per Unit') {
        supplierCommissionDeduction = lotQtySold * commVal;
      } else if (commType === 'Fixed Amount') {
        supplierCommissionDeduction = lotGrossSales > 0 ? commVal : 0;
      }
      totalSupplierCommission += supplierCommissionDeduction;
    }
    totalSupplierCommission = Math.round(totalSupplierCommission * 100) / 100;

    // Total Brokerage Commission Earned = Customer Commission + Beopari Commission
    const totalCommissionEarned = Math.round((totalCustomerCommission + totalSupplierCommission) * 100) / 100;

    // Cash Received / Paid
    let cashReceived = 0;
    let cashPaid = 0;
    filteredPayments.forEach(pay => {
      if (pay.type === 'Received') cashReceived += pay.amount || 0;
      if (pay.type === 'Paid') cashPaid += pay.amount || 0;
    });

    // Expenses Sum (Shop/Mandi Operating Expenses)
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Compute total lot expense deductions from suppliers (freight, unloading, crates, market/sarkari fee, etc.)
    let totalSupplierExpenseDeductions = 0;
    filteredStock.forEach(entry => {
      if (entry.lotExpenses && typeof entry.lotExpenses === 'object') {
        Object.values(entry.lotExpenses).forEach(v => {
          const num = Number(v);
          if (!isNaN(num) && num > 0) {
            totalSupplierExpenseDeductions += num;
          }
        });
      }
      // Add Market / Sarkari Fee deduction
      const mktRate = Number(entry.marketFeeRate || entry.marketFeePercentage || 0);
      if (entry.marketFeeFixedAmount !== undefined) {
        totalSupplierExpenseDeductions += Number(entry.marketFeeFixedAmount) || 0;
      } else if (entry.marketFeeAmount) {
        totalSupplierExpenseDeductions += Number(entry.marketFeeAmount);
      } else if (mktRate > 0) {
        const lotSales = allSales.filter(s => s.stockEntryId === (entry.id || entry._id));
        const lotGrossSales = lotSales.reduce((sum, s) => sum + (s.grossSale || (s.quantity * s.saleRate)), 0);
        const baseGross = lotGrossSales > 0 ? lotGrossSales : (entry.totalAmount || 0);
        totalSupplierExpenseDeductions += Math.round((baseGross * (mktRate / 100)) * 100) / 100;
      }
    });

    const totalExpenseDeductions = Math.round(totalSupplierExpenseDeductions * 100) / 100;

    // Net Profit: (Customer Commission + Beopari Commission) - Expenses
    const netProfit = Math.round((totalCommissionEarned - totalExpenses) * 100) / 100;

    // Receivables and Payables (Current static snapshot as requested, or filtered)
    const totalReceivables = allCustomers.reduce((sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0), 0);
    const totalPayables = allSuppliers.reduce((sum, s) => sum + (s.currentBalance < 0 ? Math.abs(s.currentBalance) : 0), 0);

    // 4.2 Stock Summary calculations
    const uniqueSuppliersCount = new Set(filteredStock.map(entry => entry.supplierId)).size;
    const categoriesCount = new Set(allProducts.map(p => p.category)).size;

    // Calculate fruit items table: received / sold / remaining per product
    const productStats = {};
    allProducts.forEach(p => {
      productStats[p.id || p._id] = {
        id: p.id || p._id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        received: 0,
        sold: 0,
        purchaseSum: 0,
        saleSum: 0
      };
    });

    filteredStock.forEach(entry => {
      const stats = productStats[entry.productId];
      if (stats) {
        stats.received += entry.quantity || 0;
        stats.purchaseSum += entry.totalAmount || 0;
      }
    });

    filteredSales.forEach(sale => {
      const stats = productStats[sale.productId];
      if (stats) {
        stats.sold += sale.quantity || 0;
        stats.saleSum += sale.totalAmount || 0;
      }
    });

    // Deduct returns from product stats (sold quantity and sale revenue)
    filteredReturns.forEach(ret => {
      const stats = productStats[ret.productId];
      if (stats) {
        const retQty = Number(ret.produceReturnedQty) || 0;
        const retGross = Number(ret.grossReturnAmount) || (retQty * (Number(ret.saleRate) || 0));
        stats.sold = Math.max(0, stats.sold - retQty);
        stats.saleSum = Math.max(0, stats.saleSum - retGross);
      }
    });

    const fruitSummaryTable = Object.values(productStats)
      .map(p => {
        const remaining = Math.max(0, p.received - p.sold);
        const avgPurchaseRate = p.received > 0 ? Math.round((p.purchaseSum / p.received) * 100) / 100 : 0;
        const avgSaleRate = p.sold > 0 ? Math.round((p.saleSum / p.sold) * 100) / 100 : 0;
        const estimatedProfit = Math.round((p.saleSum - (p.sold * avgPurchaseRate)) * 100) / 100;
        return {
          ...p,
          remaining,
          avgPurchaseRate,
          avgSaleRate,
          estimatedProfit
        };
      })
      .filter(p => p.received > 0 || p.sold > 0);

    const totalCratesReceived = totalPurchasesQty;
    const totalCratesSold = totalSalesQty;
    const remainingStock = Math.max(0, totalCratesReceived - totalCratesSold);
    const unsoldLotsCount = allStock.filter(st => (st.remainingQuantity !== undefined ? st.remainingQuantity : st.quantity) > 0).length;

    // 4.3 Customer Summary calculations
    const customersPurchasedTodayCount = new Set(allSales.filter(s => s.date === endStr).map(s => s.customerId)).size;
    const newCustomersCount = allCustomers.filter(c => {
      if (!c.createdAt) return false;
      const createdAtStr = c.createdAt instanceof Date ? c.createdAt.toISOString() : (typeof c.createdAt === 'string' ? c.createdAt : (typeof c.createdAt.toISOString === 'function' ? c.createdAt.toISOString() : ''));
      const createdDate = createdAtStr ? createdAtStr.split('T')[0] : '';
      return createdDate >= startStr && createdDate <= endStr;
    }).length;
    const pendingPaymentCustomersCount = allCustomers.filter(c => c.currentBalance > 0).length;

    // Top 10 Buyers table
    const customerPurchasesGroup = {};
    filteredSales.forEach(sale => {
      if (!customerPurchasesGroup[sale.customerId]) {
        customerPurchasesGroup[sale.customerId] = {
          customerId: sale.customerId,
          name: sale.customerName || 'N/A',
          qty: 0,
          spent: 0
        };
      }
      customerPurchasesGroup[sale.customerId].qty += sale.quantity;
      customerPurchasesGroup[sale.customerId].spent += sale.totalAmount;
    });

    const topBuyersTable = Object.values(customerPurchasesGroup)
      .map(buyer => {
        const cust = customersMap.get(buyer.customerId);
        return {
          ...buyer,
          remainingBalance: cust ? cust.currentBalance : 0
        };
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10);

    // 4.4 Supplier Summary calculations
    const suppliersDeliveredTodayCount = new Set(allStock.filter(st => st.date === endStr).map(st => st.supplierId)).size;
    const suppliersAwaitingPaymentCount = allSuppliers.filter(s => s.currentBalance < 0).length;

    // Top Suppliers table (ONLY include lots settled via Record to Payables & Supply Value)
    const supplierConsignmentsGroup = {};
    filteredStock.forEach(entry => {
      if (!entry.isSettled) return; // Only count lot value after clicking Record to Payables & Supply Value
      if (!supplierConsignmentsGroup[entry.supplierId]) {
        supplierConsignmentsGroup[entry.supplierId] = {
          supplierId: entry.supplierId,
          name: entry.supplierName || 'N/A',
          qty: 0,
          value: 0
        };
      }
      supplierConsignmentsGroup[entry.supplierId].qty += entry.quantity;
      supplierConsignmentsGroup[entry.supplierId].value += entry.settledAmount || entry.totalAmount || 0;
    });

    const topSuppliersTable = Object.values(supplierConsignmentsGroup)
      .map(sup => {
        const supplierObj = suppliersMap.get(sup.supplierId);
        return {
          ...sup,
          remainingBalance: supplierObj ? Math.abs(supplierObj.currentBalance) : 0
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 4.5 Outstanding Balances
    const customerOutstandingTable = allCustomers
      .filter(c => c.currentBalance > 0)
      .map(c => ({
        id: c.id || c._id,
        name: c.name,
        phone: c.phone,
        outstandingAmount: c.currentBalance
      }))
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount);

    const supplierPayablesTable = allSuppliers
      .filter(s => s.currentBalance < 0)
      .map(s => ({
        id: s.id || s._id,
        name: s.name,
        phone: s.phone,
        payableAmount: Math.abs(s.currentBalance)
      }))
      .sort((a, b) => b.payableAmount - a.payableAmount);

    // 4.6 Lot Summary
    const lotsReceived = filteredStock.length;
    const lotsSold = filteredStock.filter(st => (st.remainingQuantity !== undefined ? st.remainingQuantity : st.quantity) === 0).length;
    const lotsPending = filteredStock.filter(st => (st.remainingQuantity !== undefined ? st.remainingQuantity : st.quantity) > 0).length;
    const avgSellingPrice = filteredSales.length > 0 
      ? Math.round((filteredSales.reduce((sum, s) => sum + s.saleRate, 0) / filteredSales.length) * 100) / 100
      : 0;

    let highestSellingLot = null;
    let lowestSellingLot = null;
    if (filteredSales.length > 0) {
      const sortedSalesByRate = [...filteredSales].sort((a, b) => b.saleRate - a.saleRate);
      highestSellingLot = sortedSalesByRate[0];
      lowestSellingLot = sortedSalesByRate[sortedSalesByRate.length - 1];
    }

    // 4.7 Expenses Summary grouped by Category
    const expensesByCategory = {};
    filteredExpenses.forEach(exp => {
      const cat = exp.category || 'Miscellaneous';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + exp.amount;
    });

    const expenseSummary = Object.entries(expensesByCategory).map(([categoryName, amount]) => {
      const percentage = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
      return {
        category: categoryName,
        amount,
        percentage
      };
    }).sort((a, b) => b.amount - a.amount);

    // 4.8 Trucks summary
    const trucksArrivedToday = filteredTrucks.filter(t => t.arrivalDate === endStr).length;
    const trucksWaiting = allTrucks.filter(t => t.status === 'Waiting').length;
    const trucksCompleted = allTrucks.filter(t => t.status === 'Completed').length;
    const trucksDispatched = allTrucks.filter(t => t.status === 'Dispatched').length;

    // Group truck arrivals by day for chart
    const truckMovementGroup = {};
    allTrucks.forEach(t => {
      const day = t.arrivalDate;
      truckMovementGroup[day] = (truckMovementGroup[day] || 0) + 1;
    });
    const truckMovementChart = Object.entries(truckMovementGroup)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10); // Show last 10 dates

    // 4.9 Recent Activities Timeline
    const activitiesList = [];

    // Map Stock (consignment/truck arrival)
    allStock.slice(-10).forEach(st => {
      activitiesList.push({
        id: `st-${st.id || st._id}`,
        type: 'arrival',
        title: 'Truck / Consignment Received',
        description: `Received ${st.quantity} units of ${st.productName} from supplier ${st.supplierName || 'N/A'}.`,
        date: st.date,
        timestamp: st.createdAt || st.date
      });
    });

    // Map Sales
    allSales.slice(-10).forEach(sale => {
      activitiesList.push({
        id: `sale-${sale.id || sale._id}`,
        type: 'sale',
        title: 'New Consignment Sale Ticket',
        description: `Sold ${sale.quantity} units of ${sale.productName} to ${sale.customerName || 'N/A'} @ Rs. ${sale.saleRate}.`,
        date: sale.date,
        timestamp: sale.createdAt || sale.date
      });
    });

    // Map Payments
    allPayments.slice(-10).forEach(pay => {
      const isReceived = pay.type === 'Received';
      activitiesList.push({
        id: `pay-${pay.id || pay._id}`,
        type: isReceived ? 'receipt' : 'payment',
        title: isReceived ? 'Payment Received' : 'Payment Disbursed',
        description: isReceived 
          ? `Collected Rs. ${pay.amount} from buyer ${pay.partyName || 'N/A'}.`
          : `Disbursed Rs. ${pay.amount} to supplier ${pay.partyName || 'N/A'}.`,
        date: pay.date,
        timestamp: pay.createdAt || pay.date
      });
    });

    // Map Expenses
    allExpenses.slice(-10).forEach(exp => {
      activitiesList.push({
        id: `exp-${exp.id || exp._id}`,
        type: 'expense',
        title: 'Operating Expense Recorded',
        description: `Paid Rs. ${exp.amount} for "${exp.category}" (${exp.description || 'N/A'}).`,
        date: exp.date,
        timestamp: exp.createdAt || exp.date
      });
    });

    // Map Supplier additions
    allSuppliers.slice(-5).forEach(sup => {
      const createdAtStr = sup.createdAt ? (sup.createdAt instanceof Date ? sup.createdAt.toISOString() : (typeof sup.createdAt === 'string' ? sup.createdAt : (typeof sup.createdAt.toISOString === 'function' ? sup.createdAt.toISOString() : ''))) : '';
      activitiesList.push({
        id: `sup-${sup.id || sup._id}`,
        type: 'supplier_add',
        title: 'New Supplier Onboarded',
        description: `Onboarded grower/supplier ${sup.name} with registered phone ${sup.phone}.`,
        date: createdAtStr ? createdAtStr.split('T')[0] : '',
        timestamp: sup.createdAt || new Date().toISOString()
      });
    });

    // Map Customer additions
    allCustomers.slice(-5).forEach(cust => {
      const createdAtStr = cust.createdAt ? (cust.createdAt instanceof Date ? cust.createdAt.toISOString() : (typeof cust.createdAt === 'string' ? cust.createdAt : (typeof cust.createdAt.toISOString === 'function' ? cust.createdAt.toISOString() : ''))) : '';
      activitiesList.push({
        id: `cust-${cust.id || cust._id}`,
        type: 'customer_add',
        title: 'New Customer Registered',
        description: `Registered customer/buyer ${cust.name} with phone ${cust.phone}.`,
        date: createdAtStr ? createdAtStr.split('T')[0] : '',
        timestamp: cust.createdAt || new Date().toISOString()
      });
    });

    // Sort all activities by timestamp descending
    const recentActivities = activitiesList
      .sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeB - timeA;
      })
      .slice(0, 15);

    // 4.10 Time Series Analytics grouping for Sales and Commissions Charts
    // Depending on date filter length, we chunk the interval nicely. Let's do a Daily breakdown by default.
    const timeSeriesGroup = {};
    filteredSales.forEach(sale => {
      const key = sale.date; // YYYY-MM-DD
      if (!timeSeriesGroup[key]) {
        timeSeriesGroup[key] = {
          date: key,
          sales: 0,
          customerCommission: 0,
          supplierCommission: 0,
          commission: 0
        };
      }
      timeSeriesGroup[key].sales += (sale.totalAmount || 0);
    });

    // Calculate customer commission and Beopari Commission on the same day key
    for (const sale of filteredSales) {
      const key = sale.date;
      let customerComm = sale.commissionAmount;
      if (customerComm === undefined || customerComm === null) {
        customerComm = 0;
      }

      // Calculate Beopari Commission for this sale
      let supplierComm = 0;
      const stockEntry = stockMap.get(sale.stockEntryId);
      if (stockEntry) {
        const commVal = Number(stockEntry.supplierCommissionValue) || 0;
        const commType = stockEntry.supplierCommissionType || 'Percentage';
        const saleGross = sale.grossSale || (sale.quantity * sale.saleRate) || sale.totalAmount || 0;
        if (commType === 'Percentage') {
          supplierComm = saleGross * (commVal / 100);
        } else if (commType === 'Per Unit') {
          supplierComm = (sale.quantity || 0) * commVal;
        } else if (commType === 'Fixed Amount') {
          const totalStockQty = stockEntry.quantity || 1;
          supplierComm = totalStockQty > 0 ? (commVal * (sale.quantity || 0) / totalStockQty) : 0;
        }
      }

      if (timeSeriesGroup[key]) {
        timeSeriesGroup[key].customerCommission += (customerComm || 0);
        timeSeriesGroup[key].supplierCommission += (supplierComm || 0);
        timeSeriesGroup[key].commission += ((customerComm || 0) + (supplierComm || 0));
      }
    }

    // Deduct returns from time series
    filteredReturns.forEach(ret => {
      const key = ret.date;
      if (timeSeriesGroup[key]) {
        const retQty = Number(ret.produceReturnedQty) || 0;
        const retGross = Number(ret.grossReturnAmount) || (retQty * (Number(ret.saleRate) || 0));
        let retComm = Number(ret.commissionReversedAmount) || 0;
        if (!retComm && retQty > 0) {
          const matchingSale = ret.saleId ? allSales.find(s => String(s.id || s._id) === String(ret.saleId)) : null;
          if (matchingSale && Number(matchingSale.quantity) > 0 && Number(matchingSale.commissionAmount) > 0) {
            retComm = retQty * (Number(matchingSale.commissionAmount) / Number(matchingSale.quantity));
          } else {
            const commRate = parseFloat(String(ret.commissionRate || 0).replace(/[^\d.]/g, '')) || 0;
            retComm = retGross * (commRate / 100);
          }
        }
        const totalRetDeduction = Number(ret.returnAmount) || (retGross + retComm);
        timeSeriesGroup[key].sales = Math.max(0, timeSeriesGroup[key].sales - totalRetDeduction);
        timeSeriesGroup[key].customerCommission = Math.max(0, timeSeriesGroup[key].customerCommission - retComm);
        timeSeriesGroup[key].commission = Math.max(0, timeSeriesGroup[key].commission - retComm);
      }
    });

    const salesAndCommissionTimeSeries = Object.values(timeSeriesGroup)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        ...item,
        sales: Math.round(item.sales * 100) / 100,
        customerCommission: Math.round(item.customerCommission * 100) / 100,
        supplierCommission: Math.round(item.supplierCommission * 100) / 100,
        commission: Math.round(item.commission * 100) / 100
      }));

    // 4.11 Ledger filtering for individual Customer and Supplier statement
    const customerLedger = allLedgers.filter(l => {
      if (l.partyType !== 'Customer') return false;
      if (customerId && l.partyId !== customerId) return false;
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const supplierLedger = allLedgers.filter(l => {
      if (l.partyType !== 'Supplier') return false;
      if (supplierId && l.partyId !== supplierId) return false;
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Response object holding all aggregated dynamic widgets
    const reportResponse = {
      metadata: {
        type,
        startDate: startStr,
        endDate: endStr,
      },
      customerLedger,
      supplierLedger,
      financialSummary: {
        totalSales,
        totalPurchases,
        totalCustomerCommission,
        totalSupplierCommission,
        totalCommissionEarned,
        cashReceived,
        cashPaid,
        totalExpenses,
        totalSupplierExpenseDeductions,
        totalExpenseDeductions,
        netProfit,
        totalReceivables,
        totalPayables,
        walkInRevenue: netWalkInRevenue
      },
      stockSummary: {
        totalTrucksArrived: allTrucks.filter(t => inRange(t.arrivalDate)).length,
        uniqueSuppliersCount,
        categoriesCount,
        totalCratesReceived,
        totalCratesSold,
        remainingStock,
        unsoldLotsCount,
        fruitSummaryTable
      },
      customerSummary: {
        totalActiveCustomers: allCustomers.length,
        customersPurchasedTodayCount,
        newCustomersCount,
        pendingPaymentCustomersCount,
        topBuyersTable
      },
      supplierSummary: {
        totalActiveSuppliers: allSuppliers.length,
        suppliersDeliveredTodayCount,
        suppliersAwaitingPaymentCount,
        topSuppliersTable
      },
      outstandingBalances: {
        customerOutstandingTable,
        supplierPayablesTable
      },
      lotSummary: {
        lotsReceived,
        lotsSold,
        lotsPending,
        avgSellingPrice,
        highestSellingLot,
        lowestSellingLot
      },
      expenseSummary,
      truckSummary: {
        trucksArrivedToday,
        trucksWaiting,
        trucksCompleted,
        trucksDispatched,
        truckMovementChart
      },
      recentActivities,
      analytics: {
        salesAndCommissionTimeSeries
      },
      products: allProducts,
      purchases: filteredStock,
      sales: filteredSales,
      payments: filteredPayments,
    };
    res.json(req.user?.role === 'Customer' ? sanitizeCustomerData(reportResponse) : reportResponse);

  } catch (err) {
    console.error('Error generating detailed reports:', err);
    res.status(500).json({ error: 'Failed to generate financial and analytical dashboard reports.' });
  }
}

// Handler for Dedicated 16 Reports Endpoint
export async function getReportData(req, res) {
  try {
    let {
      reportId,
      startDate,
      endDate,
      asOfDate,
      partyId,
      partyCategory,
      partyType,
      productId,
      supplierId,
      customerId,
      lotId,
      transactionType,
      paymentMode,
      expenseCategory,
      riskThreshold,
      entityType,
      purchaseReference,
      sourceMandi,
      paymentStatus
    } = req.query;

    const user = req.user || {};
    const role = user.role || 'Clerk';

    // Role Permission Definitions
    const ALLOWED_ROLES = {
      'day-book': ['Admin', 'Clerk', 'super_admin'],
      'party-ledger': ['Admin', 'Clerk', 'Supplier', 'Customer', 'super_admin'],
      'lot-sales': ['Admin', 'Clerk', 'super_admin'],
      'commission': ['Admin', 'super_admin'],
      'outstanding': ['Admin', 'Clerk', 'super_admin'],
      'cash-book': ['Admin', 'Clerk', 'super_admin'],
      'bardana': ['Admin', 'Clerk', 'super_admin'],
      'advance': ['Admin', 'super_admin'],
      'absent-party': ['Admin', 'Clerk', 'super_admin'],
      'payables': ['Admin', 'super_admin'],
      'supplier-deductions': ['Admin', 'Clerk', 'Supplier', 'super_admin'],
      'supplier-expense-deductions': ['Admin', 'Clerk', 'Supplier', 'super_admin'],
      'market-fee': ['Admin', 'super_admin'],
      'expense': ['Admin', 'super_admin'],
      'price-trend': ['Admin', 'Clerk', 'super_admin'],
      'top-entities': ['Admin', 'Clerk', 'super_admin'],
      'monthly-profit': ['Admin', 'super_admin'],
      'inventory': ['Admin', 'Clerk', 'super_admin'],
      'own-trading': ['Admin', 'Clerk', 'super_admin']
    };

    const reportAllowed = ALLOWED_ROLES[reportId] || [];
    const isAllowed = role === 'super_admin' || role === 'Super Admin' || reportAllowed.some(r => r.toLowerCase() === role.toLowerCase());

    if (!isAllowed) {
      return res.status(403).json({ error: `Access Denied: Role '${role}' does not have permission to view this report.` });
    }

    if (reportId === 'own-trading') {
      try { return res.json(await loadOwnTradingReport(req, { OwnTradingPurchase, StockEntry, Sale, ReturnRecord, Payment })); }
      catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to load Own Trading report.' }); }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const startStr = startDate || todayStr;
    const endStr = endDate || todayStr;
    const targetAsOfDate = asOfDate || todayStr;

    // Fetch tenant-isolated database records
    let [
      allStock,
      allSales,
      allProducts,
      allSuppliers,
      allCustomers,
      allLedgers,
      allPayments,
      allExpenses,
      allTrucks,
      allUsers,
      allCommissionRules,
      allReturns
    ] = await Promise.all([
      StockEntry.find(buildTenantQuery(req)),
      Sale.find(buildTenantQuery(req)),
      Product.find(buildTenantQuery(req)),
      Supplier.find(buildTenantQuery(req)),
      Customer.find(buildTenantQuery(req)),
      Ledger.find(buildTenantQuery(req)),
      Payment.find(buildTenantQuery(req)),
      Expense.find(buildTenantQuery(req)),
      Truck.find(buildTenantQuery(req)),
      User.find(buildTenantQuery(req)),
      CommissionRule.find(buildTenantQuery(req)),
      ReturnRecord.find({ ...buildTenantQuery(req), status: 'Approved', isDeleted: false })
    ]);

    const allCrateTransactions = [];

    const productsMap = new Map(allProducts.map(p => [p.id || p._id, p]));
    const suppliersMap = new Map(allSuppliers.map(s => [s.id || s._id, s]));
    const customersMap = new Map(allCustomers.map(c => [c.id || c._id, c]));
    const stockMap = new Map(allStock.map(st => [st.id || st._id, st]));

    // Map returns by saleId and stockEntryId
    const returnsBySaleId = new Map();
    const returnsByStockId = new Map();
    (allReturns || []).forEach(r => {
      if (r.saleId) {
        const sKey = String(r.saleId);
        if (!returnsBySaleId.has(sKey)) returnsBySaleId.set(sKey, []);
        returnsBySaleId.get(sKey).push(r);
      }
      if (r.stockEntryId) {
        const stKey = String(r.stockEntryId);
        if (!returnsByStockId.has(stKey)) returnsByStockId.set(stKey, []);
        returnsByStockId.get(stKey).push(r);
      }
    });

    // Security locking for Party Ledger if requested by Supplier or Customer
    let activePartyId = partyId;
    if (role === 'Supplier') {
      const mySup = allSuppliers.find(s => String(s.userId) === String(user.id));
      if (!mySup) return res.status(404).json({ error: 'Supplier not found.' });
      activePartyId = String(mySup.id || mySup._id);
      const ownStock = allStock.filter(item => String(item.supplierId) === activePartyId);
      const ownStockIds = new Set(ownStock.map(item => String(item.id || item._id)));
      const ownProductIds = new Set(ownStock.map(item => String(item.productId)));
      allStock = ownStock;
      allSales = allSales.filter(item => ownStockIds.has(String(item.stockEntryId)));
      allProducts = allProducts.filter(item => ownProductIds.has(String(item.id || item._id)));
      allSuppliers = [mySup];
      allCustomers = [];
      allLedgers = allLedgers.filter(item => item.partyType === 'Supplier' && String(item.partyId) === activePartyId);
      allPayments = allPayments.filter(item => item.partyType === 'Supplier' && String(item.partyId) === activePartyId);
      allExpenses = [];
      allTrucks = allTrucks.map(item => filterTruckToSupplier(item, activePartyId)).filter(Boolean);
      allUsers = [];
      allCommissionRules = allCommissionRules.filter(item => item.scope === 'Global Default' || String(item.supplierId) === activePartyId || ownProductIds.has(String(item.productId)));
      allReturns = allReturns.filter(item => String(item.supplierId) === activePartyId || ownStockIds.has(String(item.stockEntryId)));
      supplierId = activePartyId;
      customerId = '';
      partyId = activePartyId;
    } else if (role === 'Customer') {
      const myCust = allCustomers.find(c => String(c.userId) === String(user.id));
      if (!myCust) return res.status(404).json({ error: 'Customer not found.' });
      activePartyId = String(myCust.id || myCust._id);
      const ownSales = allSales.filter(item => String(item.customerId) === activePartyId);
      const ownProductIds = new Set(ownSales.map(item => String(item.productId)));
      allStock = [];
      allSales = ownSales;
      allProducts = allProducts.filter(item => ownProductIds.has(String(item.id || item._id)));
      allSuppliers = [];
      allCustomers = [myCust];
      allLedgers = allLedgers.filter(item => item.partyType === 'Customer' && String(item.partyId) === activePartyId);
      allPayments = allPayments.filter(item => item.partyType === 'Customer' && String(item.partyId) === activePartyId);
      allExpenses = [];
      allTrucks = [];
      allUsers = [];
      allCommissionRules = [];
      allReturns = allReturns.filter(item => String(item.customerId) === activePartyId);
      supplierId = '';
      customerId = activePartyId;
      partyId = activePartyId;
    }

    let reportRows = [];
    let summaryData = null;
    let totalsData = {};
    let chartData = null;

    // --- REPORT SWITCH LOGIC ---
    switch (reportId) {

      // 1. DAY BOOK (Roznamcha / Daily Transaction Journal)
      case 'day-book': {
        // 1. Compute Historical Opening Balance as of startStr (Pre-start cash inflows - outflows)
        const priorCashInflows = allPayments
          .filter(p => p.date < startStr && p.type === 'Received')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
          allSales
            .filter(s => s.date < startStr && s.isWalkIn)
            .reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

        const priorCashOutflows = allPayments
          .filter(p => p.date < startStr && p.type === 'Paid')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
          allExpenses
            .filter(e => e.date < startStr)
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const openingBalance = Math.round((priorCashInflows - priorCashOutflows) * 100) / 100;

        const rawItems = [];

        // Inflow 1: Customer Recoveries & Received Payments
        allPayments.forEach(p => {
          if (p.date >= startStr && p.date <= endStr && p.type === 'Received') {
            const amt = Number(p.amount) || 0;
            rawItems.push({
              id: p.id || p._id,
              time: `${p.date} ${p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
              date: p.date,
              partyName: p.partyName || 'Party Receipt',
              partyType: p.partyType || 'Customer',
              type: 'Receipt',
              category: 'Customer Receipt',
              direction: 'INFLOW',
              isCash: true,
              paymentMethod: p.paymentMethod || 'Cash',
              item: p.description || 'Customer Settlement / Recovery',
              quantity: 0,
              rate: 0,
              amount: amt,
              debit: 0,
              credit: amt,
              rawDate: new Date(p.createdAt || p.date)
            });
          }
        });

        // Inflow 2: Walk-In Direct Cash Sales
        allSales.forEach(s => {
          if (s.date >= startStr && s.date <= endStr && s.isWalkIn) {
            const amt = Number(s.totalAmount) || 0;
            const qty = Number(s.quantity) || 0;
            const rate = Number(s.saleRate) || 0;
            rawItems.push({
              id: s.id || s._id,
              time: `${s.date} ${s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
              date: s.date,
              partyName: s.walkInName ? `${s.walkInName} (Walk-In)` : 'Walk-In Cash Buyer',
              partyType: 'Walk-In',
              type: 'Cash Sale',
              category: 'Cash Sale',
              direction: 'INFLOW',
              isCash: true,
              paymentMethod: 'Cash',
              item: `${s.productName || 'Produce'} (Lot #${s.stockEntryId ? String(s.stockEntryId).slice(-4).toUpperCase() : 'N/A'})`,
              quantity: qty,
              rate: rate,
              amount: amt,
              debit: 0,
              credit: amt,
              commission: Number(s.commissionAmount) || 0,
              rawDate: new Date(s.createdAt || s.date)
            });
          }
        });

        // Outflow 1: Supplier Payments & Payouts
        allPayments.forEach(p => {
          if (p.date >= startStr && p.date <= endStr && p.type === 'Paid') {
            const amt = Number(p.amount) || 0;
            rawItems.push({
              id: p.id || p._id,
              time: `${p.date} ${p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
              date: p.date,
              partyName: p.partyName || 'Supplier Payout',
              partyType: p.partyType || 'Supplier',
              type: 'Payment',
              category: 'Supplier Payment',
              direction: 'OUTFLOW',
              isCash: true,
              paymentMethod: p.paymentMethod || 'Cash',
              item: p.description || 'Consignment / Farmer Settlement Payout',
              quantity: 0,
              rate: 0,
              amount: amt,
              debit: amt,
              credit: 0,
              rawDate: new Date(p.createdAt || p.date)
            });
          }
        });

        // Outflow 2: Shop & Operational Expenses
        allExpenses.forEach(e => {
          if (e.date >= startStr && e.date <= endStr) {
            const amt = Number(e.amount) || 0;
            rawItems.push({
              id: e.id || e._id,
              time: `${e.date} ${e.createdAt ? new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
              date: e.date,
              partyName: e.recordedBy ? `Staff: ${e.recordedBy}` : 'Shop Kharcha',
              partyType: 'Expense',
              type: 'Expense',
              category: 'Shop Expense',
              direction: 'OUTFLOW',
              isCash: true,
              paymentMethod: 'Cash',
              item: `${e.category || 'General'}: ${e.description || 'Daily Expense'}`,
              quantity: 0,
              rate: 0,
              amount: amt,
              debit: amt,
              credit: 0,
              rawDate: new Date(e.createdAt || e.date)
            });
          }
        });

        // Trade 1: Registered Customer Credit Sales (Account Receivable)
        allSales.forEach(s => {
          if (s.date >= startStr && s.date <= endStr && !s.isWalkIn) {
            const amt = Number(s.totalAmount) || 0;
            const qty = Number(s.quantity) || 0;
            const rate = Number(s.saleRate) || 0;
            rawItems.push({
              id: s.id || s._id,
              time: `${s.date} ${s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
              date: s.date,
              partyName: s.customerName || 'Registered Customer',
              partyType: 'Customer',
              type: 'Credit Sale',
              category: 'Credit Invoice',
              direction: 'CREDIT_TRADE',
              isCash: false,
              paymentMethod: 'Credit',
              item: `${s.productName || 'Produce'} (Qty: ${qty} @ Rs. ${rate})`,
              quantity: qty,
              rate: rate,
              amount: amt,
              debit: 0,
              credit: amt,
              commission: Number(s.commissionAmount) || 0,
              rawDate: new Date(s.createdAt || s.date)
            });
          }
        });

        // Trade 2: Consignment Stock Lot Arrivals (Physical Inventory / Payables)
        allStock.forEach(st => {
          if (st.date >= startStr && st.date <= endStr) {
            const amt = Number(st.totalAmount) || 0;
            const qty = Number(st.quantity) || 0;
            const rate = Number(st.purchaseRate) || 0;
            rawItems.push({
              id: st.id || st._id,
              time: `${st.date} ${st.createdAt ? new Date(st.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
              date: st.date,
              partyName: st.supplierName || 'Farmer / Consignor',
              partyType: 'Supplier',
              type: 'Purchase',
              category: 'Consignment Arrival',
              direction: 'STOCK_IN',
              isCash: false,
              paymentMethod: 'Consignment',
              item: `${st.productName || 'Produce Lot'} (${qty} crates arrived)`,
              quantity: qty,
              rate: rate,
              amount: amt,
              debit: amt,
              credit: 0,
              rawDate: new Date(st.createdAt || st.date)
            });
          }
        });

        // Trade 3: Produce Returns (Returned produce item, quantity, condition & return value)
        (allReturns || []).forEach(r => {
          if (r.date >= startStr && r.date <= endStr && (Number(r.produceReturnedQty) > 0 || r.returnType === 'Produce' || r.returnType === 'Both')) {
            const retQty = Number(r.produceReturnedQty) || 0;
            const retRate = Number(r.saleRate) || 0;
            const grossAmt = Number(r.grossReturnAmount) || (retQty * retRate);
            const commRev = Number(r.commissionReversedAmount) || 0;
            const totalRetAmt = Number(r.returnAmount) || (grossAmt + commRev);
            const prodName = r.productName || 'Produce';
            const unitName = r.unit || 'Crates';
            const conditionStr = r.produceCondition ? ` [${r.produceCondition}]` : '';
            const retNum = r.returnNumber || 'RET';
            const reasonStr = r.reason ? ` - ${r.reason}` : '';
            const lotInfo = r.stockEntryId ? ` (Lot #${String(r.stockEntryId).slice(-4).toUpperCase()})` : '';

            rawItems.push({
              id: r.id || r._id,
              time: `${r.date} ${r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
              date: r.date,
              partyName: r.customerName || 'Customer Return',
              partyType: 'Customer',
              type: 'Produce Return',
              category: 'Produce Return',
              direction: 'RETURN',
              isCash: false,
              paymentMethod: 'Credit Adjustment',
              item: `RETURN: ${prodName} - Returned ${retQty} ${unitName}${lotInfo} @ Rs. ${retRate.toLocaleString()}${reasonStr} (${retNum}${conditionStr})`,
              quantity: retQty,
              rate: retRate,
              amount: totalRetAmt,
              debit: totalRetAmt,
              credit: 0,
              commission: commRev,
              productName: prodName,
              unit: unitName,
              returnNumber: retNum,
              produceCondition: r.produceCondition || 'Good',
              rawDate: new Date(r.createdAt || r.date)
            });
          }
        });

        // Chronological sort
        rawItems.sort((a, b) => a.rawDate - b.rawDate);

        // Calculate Period Statistics before filtering
        const periodCashInflows = rawItems
          .filter(r => r.isCash && r.direction === 'INFLOW')
          .reduce((sum, r) => sum + r.amount, 0);

        const periodCashOutflows = rawItems
          .filter(r => r.isCash && r.direction === 'OUTFLOW')
          .reduce((sum, r) => sum + r.amount, 0);

        const closingBalance = Math.round((openingBalance + periodCashInflows - periodCashOutflows) * 100) / 100;
        const netCashFlow = Math.round((periodCashInflows - periodCashOutflows) * 100) / 100;

        const periodSales = allSales.filter(s => s.date >= startStr && s.date <= endStr);
        const rawSalesVol = periodSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
        const rawSalesAmt = periodSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
        const rawBuyerComm = periodSales.reduce((sum, s) => sum + (Number(s.commissionAmount) || 0), 0);

        const periodReturns = (allReturns || []).filter(r => r.date >= startStr && r.date <= endStr);
        const returnedSalesVol = periodReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);
        const returnedSalesAmt = periodReturns.reduce((sum, r) => {
          const retQty = Number(r.produceReturnedQty) || 0;
          const retGross = Number(r.grossReturnAmount) || (retQty * Number(r.saleRate || 0));
          let retComm = Number(r.commissionReversedAmount) || 0;
          if (!retComm && retQty > 0) {
            const matchingSale = r.saleId ? allSales.find(s => String(s.id || s._id) === String(r.saleId)) : null;
            if (matchingSale && Number(matchingSale.quantity) > 0 && Number(matchingSale.commissionAmount) > 0) {
              retComm = retQty * (Number(matchingSale.commissionAmount) / Number(matchingSale.quantity));
            } else {
              const commRate = parseFloat(String(r.commissionRate || 0).replace(/[^\d.]/g, '')) || 0;
              retComm = retGross * (commRate / 100);
            }
          }
          return sum + (Number(r.returnAmount) || (retGross + retComm));
        }, 0);
        const returnedBuyerComm = periodReturns.reduce((sum, r) => {
          let rev = Number(r.commissionReversedAmount) || 0;
          if (!rev && Number(r.produceReturnedQty) > 0) {
            const matchingSale = r.saleId ? allSales.find(s => String(s.id || s._id) === String(r.saleId)) : null;
            if (matchingSale && Number(matchingSale.quantity) > 0 && Number(matchingSale.commissionAmount) > 0) {
              rev = Number(r.produceReturnedQty) * (Number(matchingSale.commissionAmount) / Number(matchingSale.quantity));
            }
          }
          return sum + (rev || 0);
        }, 0);

        const totalSalesVolume = Math.max(0, rawSalesVol - returnedSalesVol);
        const totalSalesAmount = Math.max(0, rawSalesAmt - returnedSalesAmt);
        const totalBuyerCommission = Math.max(0, rawBuyerComm - returnedBuyerComm);

        const periodStock = allStock.filter(st => st.date >= startStr && st.date <= endStr);
        const totalArrivalVolume = periodStock.reduce((sum, st) => sum + (Number(st.quantity) || 0), 0);
        const totalSupplierCommission = periodStock.reduce((sum, st) => {
          const commVal = Number(st.supplierCommissionValue) || 0;
          if (st.supplierCommissionType === 'Percentage') {
            return sum + ((Number(st.totalAmount) || 0) * commVal) / 100;
          }
          return sum + commVal;
        }, 0);

        const totalCommissionEarned = Math.round((totalBuyerCommission + totalSupplierCommission) * 100) / 100;
        const totalShopExpenses = Math.round(
          allExpenses
            .filter(e => e.date >= startStr && e.date <= endStr)
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0) * 100
        ) / 100;

        // Apply interactive filters
        let filtered = rawItems;

        const effectivePartyType = entityType || req.query.partyType;
        if (effectivePartyType && effectivePartyType !== 'All') {
          filtered = filtered.filter(item => {
            if (effectivePartyType === 'Customer') return item.partyType === 'Customer';
            if (effectivePartyType === 'Supplier') return item.partyType === 'Supplier';
            if (effectivePartyType === 'Expense') return item.partyType === 'Expense';
            if (effectivePartyType === 'Walk-In') return item.partyType === 'Walk-In';
            return item.partyType === effectivePartyType;
          });
        }

        if (transactionType && transactionType !== 'All') {
          if (transactionType.includes('Rokar') || transactionType.includes('Cash Flow Only')) {
            filtered = filtered.filter(item => item.isCash);
          } else if (transactionType.includes('Cash Sale') || transactionType.includes('نقد فروخت')) {
            filtered = filtered.filter(item => item.type === 'Cash Sale');
          } else if (transactionType.includes('Credit Sale') || transactionType.includes('Credit Invoices') || transactionType.includes('ادھار بل')) {
            filtered = filtered.filter(item => item.type === 'Credit Sale');
          } else if (transactionType.includes('Produce Return') || transactionType.includes('واپسی مال') || transactionType.includes('Returns')) {
            filtered = filtered.filter(item => item.type === 'Produce Return' || item.category === 'Produce Return');
          } else if (transactionType.includes('Customer Receipts') || transactionType.includes('وصولیاں')) {
            filtered = filtered.filter(item => item.type === 'Receipt');
          } else if (transactionType.includes('Supplier Payments') || transactionType.includes('ادائیگیاں')) {
            filtered = filtered.filter(item => item.type === 'Payment');
          } else if (transactionType.includes('Shop Expenses') || transactionType.includes('اخراجات')) {
            filtered = filtered.filter(item => item.type === 'Expense');
          } else if (transactionType.includes('Consignment Arrivals') || transactionType.includes('آمد')) {
            filtered = filtered.filter(item => item.type === 'Purchase');
          } else {
            filtered = filtered.filter(item => item.type === transactionType || item.category === transactionType);
          }
        }

        if (paymentMode && paymentMode !== 'All') {
          filtered = filtered.filter(item => {
            const mode = (item.paymentMethod || '').toLowerCase();
            const target = paymentMode.toLowerCase();
            if (target.includes('cash')) return mode.includes('cash');
            if (target.includes('bank')) return mode.includes('bank');
            if (target.includes('online') || target.includes('easypaisa') || target.includes('jazzcash')) {
              return mode.includes('online') || mode.includes('easypaisa') || mode.includes('jazzcash') || mode.includes('wallet');
            }
            if (target.includes('cheque')) return mode.includes('cheque');
            if (target.includes('credit') || target.includes('udhar') || target.includes('adjustment')) {
              return mode.includes('credit') || mode.includes('adjustment');
            }
            return mode === target;
          });
        }

        let runningBal = openingBalance;
        let totalDebitAmt = 0;
        let totalCreditAmt = 0;
        let totalQuantityFiltered = 0;

        reportRows = filtered.map(item => {
          if (item.direction === 'INFLOW') {
            runningBal += item.amount;
            totalCreditAmt += item.amount;
          } else if (item.direction === 'OUTFLOW') {
            runningBal -= item.amount;
            totalDebitAmt += item.amount;
          } else if (item.direction === 'STOCK_IN') {
            totalDebitAmt += item.amount;
          } else if (item.direction === 'CREDIT_TRADE') {
            totalCreditAmt += item.amount;
          } else if (item.direction === 'RETURN') {
            totalDebitAmt += item.amount;
          }
          totalQuantityFiltered += item.quantity;

          return {
            ...item,
            runningBalance: Math.round(runningBal * 100) / 100
          };
        });

        // Generate Daily Trend / Chart Data
        const dateMap = {};
        const dCurrent = new Date(startStr);
        const dEnd = new Date(endStr);
        while (dCurrent <= dEnd) {
          const dStr = dCurrent.toISOString().split('T')[0];
          dateMap[dStr] = { name: dStr, Inflows: 0, Outflows: 0, SalesTurnover: 0 };
          dCurrent.setDate(dCurrent.getDate() + 1);
        }

        rawItems.forEach(item => {
          if (dateMap[item.date]) {
            if (item.direction === 'INFLOW') {
              dateMap[item.date].Inflows += item.amount;
            } else if (item.direction === 'OUTFLOW') {
              dateMap[item.date].Outflows += item.amount;
            }
            if (item.type === 'Cash Sale' || item.type === 'Credit Sale') {
              dateMap[item.date].SalesTurnover += item.amount;
            }
          }
        });

        chartData = Object.values(dateMap);

        summaryData = {
          openingBalance,
          totalInflows: Math.round(periodCashInflows * 100) / 100,
          totalOutflows: Math.round(periodCashOutflows * 100) / 100,
          closingBalance,
          netCashFlow,
          totalSalesVolume,
          totalArrivalVolume,
          totalSalesAmount: Math.round(totalSalesAmount * 100) / 100,
          totalCommissionEarned,
          totalShopExpenses,
          totalReturnedVolume: returnedSalesVol,
          totalReturnedAmount: Math.round(returnedSalesAmt * 100) / 100,
          totalReturnedCount: periodReturns.length
        };

        totalsData = {
          quantity: totalQuantityFiltered,
          debit: Math.round(totalDebitAmt * 100) / 100,
          credit: Math.round(totalCreditAmt * 100) / 100,
          amount: Math.round((totalCreditAmt + totalDebitAmt) * 100) / 100,
          runningBalance: Math.round(runningBal * 100) / 100
        };
        break;
      }

      // 2. PARTY LEDGER
      case 'party-ledger': {
        const pId = activePartyId || (allCustomers[0]?.id || allCustomers[0]?._id);
        const partyLedgers = allLedgers.filter(l => l.partyId === pId && l.date >= startStr && l.date <= endStr);
        partyLedgers.sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalDeb = 0;
        let totalCred = 0;
        let currentBal = 0;

        reportRows = partyLedgers.map(l => {
          const deb = l.type === 'Debit' ? l.amount : 0;
          const cred = l.type === 'Credit' ? l.amount : 0;
          totalDeb += deb;
          totalCred += cred;
          currentBal = l.balanceAfter;

          return {
            date: l.date,
            description: l.description || (deb > 0 ? 'Sales Charge / Debit' : 'Payment / Credit Settlement'),
            debit: deb,
            credit: cred,
            balance: l.balanceAfter
          };
        });

        const partyObj = customersMap.get(pId) || suppliersMap.get(pId) || {};
        const opBal = (partyObj.currentBalance || 0) - totalDeb + totalCred;

        summaryData = {
          openingBalance: opBal,
          totalDebit: totalDeb,
          totalCredit: totalCred,
          closingBalance: currentBal || partyObj.currentBalance || 0
        };
        totalsData = { debit: totalDeb, credit: totalCred, balance: currentBal };
        break;
      }

      // 3. LOT SALES REPORT
      case 'lot-sales': {
        const filtered = allSales.filter(s => {
          if (s.date < startStr || s.date > endStr) return false;
          if (productId && s.productId !== productId) return false;
          if (customerId && s.customerId !== customerId) return false;
          if (lotId && s.stockEntryId !== lotId) return false;
          if (supplierId) {
            const lot = allStock.find(st => (st.id || st._id) === s.stockEntryId);
            if (!lot || lot.supplierId !== supplierId) return false;
          }
          return true;
        });

        let totQty = 0;
        let totAmt = 0;

        reportRows = filtered.map((s, idx) => {
          const lot = allStock.find(st => (st.id || st._id) === s.stockEntryId);
          const sReturns = returnsBySaleId.get(String(s.id || s._id)) || [];
          const retQty = sReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);
          const retGross = sReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
          const retTotalDeduction = sReturns.reduce((sum, r) => {
            const g = Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0));
            const c = Number(r.commissionReversedAmount) || 0;
            return sum + (Number(r.returnAmount) || (g + c));
          }, 0);
          const netQty = Math.max(0, (s.quantity || 0) - retQty);
          const netAmt = Math.max(0, (s.totalAmount || (s.quantity * (s.saleRate || 0)) || 0) - retTotalDeduction);
          
          totQty += netQty;
          totAmt += netAmt;

          return {
            lotNo: lot ? (lot.supplierName ? `${lot.supplierName.substring(0, 3).toUpperCase()}-${(lot.id || lot._id).slice(-4)}` : (lot.id || lot._id).slice(-6)) : `LOT-${idx + 101}`,
            item: s.productName || 'Produce',
            supplier: lot ? lot.supplierName : 'Unknown Supplier',
            buyer: s.customerName || (s.isWalkIn ? `Walk-In: ${s.walkInName}` : 'General Buyer'),
            quantity: netQty,
            returnedQuantity: retQty,
            rate: s.saleRate || 0,
            amount: netAmt,
            date: s.date
          };
        });

        totalsData = { quantity: totQty, amount: totAmt };
        break;
      }

      // 4. COMMISSION REPORT (Aarhat)
      case 'commission': {
        const rawCat = (partyCategory || partyType || 'All Parties').trim().toLowerCase();
        const isAllParties = rawCat.includes('all parties') || rawCat === 'all' || !partyCategory;
        const isSuppliers = rawCat.includes('supplier');
        const isCustomers = rawCat.includes('customer');

        let rows = [];
        let totalCustomerComm = 0;
        let totalSupplierComm = 0;
        let totalQty = 0;
        let totalTradeVal = 0;
        const dateMap = new Map();

        // 1. Process Customer Sales Commission (if All Parties or All Customers)
        if (isAllParties || isCustomers) {
          const matchingSales = allSales.filter(s => {
            if (s.date < startStr || s.date > endStr) return false;
            if (activePartyId && s.customerId !== activePartyId && s.walkInName !== activePartyId) return false;
            if (productId && s.productId !== productId) return false;
            return true;
          });

          matchingSales.forEach(s => {
            const rawQty = Number(s.quantity) || 0;
            const sReturns = returnsBySaleId.get(String(s.id || s._id)) || [];
            const retQty = sReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);
            const retGross = sReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
            const reversedComm = sReturns.reduce((sum, r) => {
              let rev = Number(r.commissionReversedAmount) || 0;
              if (!rev && Number(r.produceReturnedQty) > 0) {
                const comm = Number(s.commissionAmount) || 0;
                if (rawQty > 0 && comm > 0) rev = (Number(r.produceReturnedQty) * (comm / rawQty));
              }
              return sum + (rev || 0);
            }, 0);

            const netQty = Math.max(0, rawQty - retQty);
            const rawGrossVal = s.grossSale || (rawQty * (Number(s.saleRate) || 0)) || (s.totalAmount || 0);
            const netGrossVal = Math.max(0, rawGrossVal - retGross);
            const rawComm = (s.commissionAmount !== undefined && s.commissionAmount !== null)
              ? Number(s.commissionAmount)
              : 0;
            const comm = Math.max(0, Math.round((rawComm - reversedComm) * 100) / 100);

            totalCustomerComm += comm;
            totalQty += netQty;
            totalTradeVal += netGrossVal;

            const dKey = s.date;
            dateMap.set(dKey, (dateMap.get(dKey) || 0) + comm);

            const prod = productsMap.get(s.productId);
            const unitName = prod?.unit || 'Crate';
            const lot = allStock.find(st => (st.id || st._id) === s.stockEntryId);
            const lotNo = lot ? (lot.lotNumber ? `#${lot.lotNumber}` : (lot.supplierName ? `${lot.supplierName.substring(0, 3).toUpperCase()}-${(lot.id || lot._id).slice(-4)}` : (lot.id || lot._id).slice(-6))) : (s.stockEntryId ? `#${String(s.stockEntryId).slice(-4).toUpperCase()}` : '-');

            // Determine commission rate display according to how it was applied
            let formattedRate = s.commissionRate;
            if (!formattedRate) {
              if (s.commissionType === 'Fixed Amount' || s.commissionType === 'Per Unit') {
                const val = s.commissionRateValue !== undefined && s.commissionRateValue !== null
                  ? s.commissionRateValue
                  : (netQty > 0 ? Math.round((comm / netQty) * 100) / 100 : comm);
                formattedRate = `Rs. ${val} / ${unitName}`;
              } else if (s.commissionType === 'Percentage') {
                const val = s.commissionRateValue !== undefined && s.commissionRateValue !== null
                  ? s.commissionRateValue
                  : (netGrossVal > 0 ? Math.round((comm / netGrossVal) * 1000) / 10 : 0);
                formattedRate = `${val}%`;
              } else if (comm === 0) {
                formattedRate = '0%';
              } else if (netGrossVal > 0 && comm > 0) {
                const pctRatio = Math.round(((comm / netGrossVal) * 100) * 10) / 10;
                formattedRate = `${pctRatio}%`;
              } else {
                formattedRate = '0%';
              }
            }

            rows.push({
              date: s.date,
              partyName: s.customerName || (s.isWalkIn ? `Walk-In: ${s.walkInName}` : 'General Buyer'),
              partyType: s.isWalkIn ? 'Walk-In' : 'Customer',
              productName: s.productName || prod?.name || 'Produce',
              lotNo: lotNo,
              quantity: netQty,
              saleAmount: netGrossVal,
              commissionRate: formattedRate,
              commissionAmount: comm,
              rawDate: new Date(s.createdAt || s.date)
            });
          });
        }

        // 2. Process Supplier Consignment Lots Commission (if All Parties or All Suppliers)
        if (isAllParties || isSuppliers) {
          const matchingStock = allStock.filter(st => {
            if (st.date < startStr || st.date > endStr) return false;
            if (activePartyId && st.supplierId !== activePartyId) return false;
            if (productId && st.productId !== productId) return false;
            return true;
          });

          matchingStock.forEach(st => {
            const stId = String(st.id || st._id);
            const lotSales = allSales.filter(s => String(s.stockEntryId) === stId);
            const lotReturns = returnsByStockId.get(stId) || [];

            const rawLotGrossSales = lotSales.reduce((sum, s) => sum + (s.grossSale || (s.quantity * (s.saleRate || 0)) || s.totalAmount || 0), 0);
            const rawLotQtySold = lotSales.reduce((sum, s) => sum + (s.quantity || 0), 0);

            const returnedLotGross = lotReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
            const returnedLotQty = lotReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);

            const lotGrossSales = Math.max(0, rawLotGrossSales - returnedLotGross);
            const lotQtySold = Math.max(0, rawLotQtySold - returnedLotQty);

            const lotTradeVal = lotGrossSales > 0 ? lotGrossSales : (Number(st.totalAmount) || (Number(st.quantity || 0) * Number(st.purchaseRate || 0)));
            const lotQty = lotQtySold > 0 ? lotQtySold : Math.max(0, (Number(st.quantity) || 0) - returnedLotQty);

            const commVal = Number(st.supplierCommissionValue) || 0;
            const commType = st.supplierCommissionType || 'Percentage';

            let comm = 0;
            let formattedRate = '0%';

            if (commVal > 0) {
              if (commType === 'Percentage') {
                comm = lotTradeVal * (commVal / 100);
                formattedRate = `${commVal}%`;
              } else if (commType === 'Per Unit') {
                const prod = productsMap.get(st.productId);
                const unitName = prod?.unit || 'Crate';
                comm = lotQty * commVal;
                formattedRate = `Rs. ${commVal} / ${unitName}`;
              } else if (commType === 'Fixed Amount') {
                comm = commVal;
                formattedRate = `Rs. ${commVal} (Fixed)`;
              }
            } else {
              comm = 0;
              formattedRate = '0%';
            }

            comm = Math.round(comm * 100) / 100;

            // Include Beopari Commission row
            if (comm > 0 || lotTradeVal > 0 || isSuppliers) {
              totalSupplierComm += comm;
              if (isSuppliers) {
                totalQty += lotQty;
                totalTradeVal += lotTradeVal;
              }

              const dKey = st.date;
              dateMap.set(dKey, (dateMap.get(dKey) || 0) + comm);

              rows.push({
                date: st.date,
                partyName: st.supplierName || 'General Supplier',
                partyType: 'Supplier',
                productName: st.productName || 'Produce Lot',
                lotNo: st.lotNumber ? `#${st.lotNumber}` : (st.supplierName ? `${st.supplierName.substring(0, 3).toUpperCase()}-${stId.slice(-4)}` : stId.slice(-4)),
                quantity: lotQty,
                saleAmount: lotTradeVal,
                commissionRate: formattedRate,
                commissionAmount: comm,
                rawDate: new Date(st.createdAt || st.date)
              });
            }
          });
        }

        // Chronological sort descending
        rows.sort((a, b) => b.rawDate - a.rawDate);
        reportRows = rows;

        chartData = Array.from(dateMap.entries()).map(([date, comm]) => ({
          name: date,
          Commission: Math.round(comm)
        })).sort((a, b) => new Date(a.name) - new Date(b.name));

        const grandCommission = Math.round((totalCustomerComm + totalSupplierComm) * 100) / 100;

        summaryData = {
          totalTradeValue: Math.round(totalTradeVal * 100) / 100,
          totalCustomerCommission: Math.round(totalCustomerComm * 100) / 100,
          totalSupplierCommission: Math.round(totalSupplierComm * 100) / 100,
          totalCommissionEarned: grandCommission
        };

        totalsData = {
          quantity: totalQty,
          saleAmount: Math.round(totalTradeVal * 100) / 100,
          commissionAmount: grandCommission
        };
        break;
      }

      // 5. OUTSTANDING / UDHAAR REPORT
      case 'outstanding': {
        const today = new Date(targetAsOfDate);
        let grandTotal = 0;
        let t0_7 = 0, t8_15 = 0, t16_30 = 0, t30Plus = 0;

        reportRows = allCustomers.map(cust => {
          const cId = cust.id || cust._id;
          const custSales = allSales.filter(s => s.customerId === cId && (!s.date || s.date <= targetAsOfDate));
          const custPayments = allPayments.filter(p => p.partyId === cId && p.type === 'Received' && (!p.date || p.date <= targetAsOfDate));

          // Calculate each sale's net total after returns
          const salesWithNet = custSales.map(s => {
            const sId = String(s.id || s._id);
            const sReturns = (returnsBySaleId.get(sId) || []).filter(r => !r.date || r.date <= targetAsOfDate);
            const retDeduction = sReturns.reduce((sum, r) => {
              const g = Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0));
              const c = Number(r.commissionReversedAmount) || 0;
              return sum + (Number(r.returnAmount) || (g + c));
            }, 0);
            const rawAmount = Number(s.totalAmount) || (Number(s.quantity || 0) * Number(s.saleRate || 0)) || 0;
            const netAmount = Math.max(0, rawAmount - retDeduction);
            return {
              ...s,
              date: s.date,
              netAmount
            };
          });

          const totNetPur = salesWithNet.reduce((sum, s) => sum + s.netAmount, 0);
          const totPd = custPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const currentBal = Math.max(0, Math.round((totNetPur - totPd) * 100) / 100);

          let b0_7 = 0, b8_15 = 0, b16_30 = 0, b30P = 0;

          if (currentBal > 0) {
            // Sort sales newest to oldest to allocate current outstanding balance to aging buckets
            const sortedSales = [...salesWithNet].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            let remainingToAllocate = currentBal;

            for (const s of sortedSales) {
              if (remainingToAllocate <= 0) break;
              const alloc = Math.min(remainingToAllocate, s.netAmount);
              if (alloc > 0) {
                const diffDays = Math.max(0, Math.floor((today - new Date(s.date)) / (1000 * 60 * 60 * 24)));
                if (diffDays <= 7) b0_7 += alloc;
                else if (diffDays <= 15) b8_15 += alloc;
                else if (diffDays <= 30) b16_30 += alloc;
                else b30P += alloc;
                remainingToAllocate -= alloc;
              }
            }
            if (remainingToAllocate > 0) {
              b30P += remainingToAllocate;
            }
          }

          grandTotal += currentBal;
          t0_7 += b0_7; t8_15 += b8_15; t16_30 += b16_30; t30Plus += b30P;

          return {
            buyerName: cust.name,
            totalOutstanding: currentBal,
            bucket0to7: Math.round(b0_7 * 100) / 100,
            bucket8to15: Math.round(b8_15 * 100) / 100,
            bucket16to30: Math.round(b16_30 * 100) / 100,
            bucket30Plus: Math.round(b30P * 100) / 100
          };
        }).filter(row => row.totalOutstanding > 0);

        totalsData = {
          totalOutstanding: Math.round(grandTotal * 100) / 100,
          bucket0to7: Math.round(t0_7 * 100) / 100,
          bucket8to15: Math.round(t8_15 * 100) / 100,
          bucket16to30: Math.round(t16_30 * 100) / 100,
          bucket30Plus: Math.round(t30Plus * 100) / 100
        };
        break;
      }

      // 6. CASH / BANK BOOK
      case 'cash-book': {
        const modeFilter = (paymentMode || 'All').trim().toLowerCase();
        const typeFilter = (transactionType || 'All').trim().toLowerCase();

        // Helper to check if item matches selected paymentMode ('All', 'Cash', 'Bank')
        const matchesMode = (itemMode) => {
          if (modeFilter === 'all') return true;
          const m = (itemMode || 'Cash').toLowerCase();
          if (modeFilter === 'cash') return m === 'cash' || m === 'cash till';
          if (modeFilter === 'bank') return m !== 'cash' && m !== 'cash till';
          return m === modeFilter;
        };

        // 1. Calculate Opening Balance prior to startStr
        let opInflows = 0;
        let opOutflows = 0;

        // Prior payments
        allPayments.forEach(p => {
          if (p.date < startStr && matchesMode(p.paymentMethod)) {
            const amt = Number(p.amount) || 0;
            if (p.type === 'Received') opInflows += amt;
            else if (p.type === 'Paid') opOutflows += amt;
          }
        });

        // Prior Walk-in cash sales (always Cash inflows)
        if (matchesMode('Cash')) {
          allSales.forEach(s => {
            if (s.date < startStr && s.isWalkIn) {
              opInflows += (Number(s.totalAmount) || (Number(s.grossSale) || 0));
            }
          });
        }

        // Prior shop expenses (usually Cash outflows)
        allExpenses.forEach(e => {
          if (e.date < startStr && matchesMode(e.paymentMode || 'Cash')) {
            opOutflows += (Number(e.amount) || 0);
          }
        });

        const opBal = Math.round((opInflows - opOutflows) * 100) / 100;

        // 2. Gather All Cash & Bank Movements in Date Range
        const rawItems = [];
        let totalWalkInInflow = 0;
        let totalCustInflow = 0;
        let totalSuppOutflow = 0;
        let totalExpenseOutflow = 0;

        // A. Walk-in Customer Cash Sales
        if (matchesMode('Cash')) {
          allSales.forEach(s => {
            if (s.date >= startStr && s.date <= endStr && s.isWalkIn) {
              const amt = Number(s.totalAmount) || (Number(s.grossSale) || 0);
              const qty = Number(s.quantity) || 0;
              const rate = Number(s.saleRate) || 0;
              const prod = productsMap.get(s.productId);
              const prodName = s.productName || prod?.name || 'Produce';
              const buyerName = s.walkInName ? `${s.walkInName} (Walk-In)` : 'Walk-In Customer';

              totalWalkInInflow += amt;

              rawItems.push({
                time: `${s.date} ${s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
                date: s.date,
                partyName: buyerName,
                description: `Walk-in Cash Sale: ${prodName} (${qty} ${prod?.unit || 'Crates'} @ Rs. ${rate})`,
                category: 'Walk-in Cash Sale',
                type: 'Cash Sale',
                mode: 'Cash',
                amountIn: amt,
                amountOut: 0,
                rawDate: new Date(s.createdAt || s.date)
              });
            }
          });
        }

        // B. Customer Receipts & Supplier Payouts
        allPayments.forEach(p => {
          if (p.date >= startStr && p.date <= endStr && matchesMode(p.paymentMethod)) {
            const amt = Number(p.amount) || 0;
            const isReceived = p.type === 'Received';
            const m = p.paymentMethod || 'Cash';

            if (isReceived) {
              totalCustInflow += amt;
              rawItems.push({
                time: `${p.date} ${p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
                date: p.date,
                partyName: p.partyName || 'Customer Recovery',
                description: p.description || `Customer Recovery / Receipt from ${p.partyName || 'Customer'}`,
                category: 'Customer Receipt',
                type: 'Receipt',
                mode: m,
                amountIn: amt,
                amountOut: 0,
                rawDate: new Date(p.createdAt || p.date)
              });
            } else {
              totalSuppOutflow += amt;
              rawItems.push({
                time: `${p.date} ${p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
                date: p.date,
                partyName: p.partyName || 'Supplier Payout',
                description: p.description || `Consignment Settlement Payout to ${p.partyName || 'Supplier'}`,
                category: 'Supplier Payment',
                type: 'Payment',
                mode: m,
                amountIn: 0,
                amountOut: amt,
                rawDate: new Date(p.createdAt || p.date)
              });
            }
          }
        });

        // C. Shop Operating Expenses
        allExpenses.forEach(e => {
          const expMode = e.paymentMode || 'Cash';
          if (e.date >= startStr && e.date <= endStr && matchesMode(expMode)) {
            const amt = Number(e.amount) || 0;
            totalExpenseOutflow += amt;

            rawItems.push({
              time: `${e.date} ${e.createdAt ? new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
              date: e.date,
              partyName: e.recordedBy ? `Staff: ${e.recordedBy}` : 'Shop Expense',
              description: `${e.category || 'General'}: ${e.description || 'Shop Kharcha'}`,
              category: 'Shop Expense',
              type: 'Expense',
              mode: expMode,
              amountIn: 0,
              amountOut: amt,
              rawDate: new Date(e.createdAt || e.date)
            });
          }
        });

        // 3. Filter by Transaction Type if selected
        let filteredItems = rawItems;
        if (typeFilter && typeFilter !== 'all') {
          if (typeFilter.includes('inflow') || typeFilter.includes('receipt')) {
            filteredItems = rawItems.filter(i => i.amountIn > 0);
          } else if (typeFilter.includes('outflow') || typeFilter.includes('payout')) {
            filteredItems = rawItems.filter(i => i.amountOut > 0);
          } else if (typeFilter.includes('walk-in') || typeFilter.includes('walk in')) {
            filteredItems = rawItems.filter(i => i.category === 'Walk-in Cash Sale');
          } else if (typeFilter.includes('customer')) {
            filteredItems = rawItems.filter(i => i.category === 'Customer Receipt');
          } else if (typeFilter.includes('supplier')) {
            filteredItems = rawItems.filter(i => i.category === 'Supplier Payment');
          } else if (typeFilter.includes('expense')) {
            filteredItems = rawItems.filter(i => i.category === 'Shop Expense');
          }
        }

        // 4. Sort chronologically ascending to maintain correct running balance
        filteredItems.sort((a, b) => a.rawDate - b.rawDate);

        let runningBal = opBal;
        let totIn = 0;
        let totOut = 0;

        reportRows = filteredItems.map(item => {
          totIn += item.amountIn;
          totOut += item.amountOut;
          runningBal = runningBal + item.amountIn - item.amountOut;

          return {
            time: item.time,
            partyName: item.partyName,
            description: item.description,
            category: item.category,
            mode: item.mode,
            amountIn: item.amountIn,
            amountOut: item.amountOut,
            balance: Math.round(runningBal * 100) / 100
          };
        });

        summaryData = {
          openingBalance: opBal,
          totalIn: Math.round(totIn * 100) / 100,
          walkInCash: Math.round(totalWalkInInflow * 100) / 100,
          totalOut: Math.round(totOut * 100) / 100,
          closingBalance: Math.round(runningBal * 100) / 100
        };

        totalsData = {
          amountIn: Math.round(totIn * 100) / 100,
          amountOut: Math.round(totOut * 100) / 100,
          balance: Math.round(runningBal * 100) / 100
        };
        break;
      }

      // 7. BARDANA / CRATE REPORT (2-Way Balance Ledger)
      case 'bardana': {
        const rawCategory = (partyCategory || partyType || 'All Entities (2-Way View)').trim().toLowerCase();
        const isAll = rawCategory.includes('all') || !partyCategory;
        const isSupplierOnly = rawCategory.includes('supplier');
        const isCustomerOnly = rawCategory.includes('customer');

        const statusFilter = (riskThreshold || 'All').trim().toLowerCase(); // 'All Transactions', 'Pending Return Only', 'Settled Only'

        const rows = [];
        let grandSupInward = 0;
        let grandSupReturned = 0;
        let grandCustOutward = 0;
        let grandCustReturned = 0;

        // 1. Process Supplier Inward Ledger (Growers / Consignors)
        if (isAll || isSupplierOnly) {
          allSuppliers.forEach(sup => {
            const sId = String(sup.id || sup._id || '');
            const supName = (sup.name || '').trim().toLowerCase();
            if (activePartyId && activePartyId !== sId && activePartyId !== sup.name) return;

            // Inward crates from stock consignment arrivals
            const supStock = allStock.filter(st => {
              const matchesId = st.supplierId && String(st.supplierId) === sId;
              const matchesName = supName && st.supplierName && String(st.supplierName).trim().toLowerCase() === supName;
              return (matchesId || matchesName) && (!endStr || st.date <= endStr);
            });
            const stockInwardQty = supStock.reduce((sum, st) => sum + (Number(st.quantity) || 0), 0);

            // Trucks associated with this supplier
            const supTrucks = allTrucks.filter(t => {
              return truckHasSupplier(t, sId, supName) && (!endStr || (t.arrivalDate || t.dispatchDate || '') <= endStr);
            });

            // Dispatched trucks loaded with empty crates back to the grower
            const dispatchedTrucks = supTrucks.filter(t => 
              (t.status === 'Dispatched' || t.status === 'Completed' || Boolean(t.dispatchDate)) && Number(t.quantityLoaded) > 0
            );
            const truckDispatchedQty = dispatchedTrucks.reduce((sum, t) => sum + (Number(t.quantityLoaded) || 0), 0);

            // Settled consignments where crate balances have been finalized / accounted
            const settledLots = supStock.filter(st => st.isSettled);
            const settledLotsQty = settledLots.reduce((sum, st) => sum + (Number(st.quantity) || 0), 0);

            const totalInward = stockInwardQty;
            const totalDispatchedOrSettled = Math.min(totalInward, settledLotsQty + truckDispatchedQty);
            const netOwedToSupplier = Math.max(0, totalInward - totalDispatchedOrSettled);

            // Find last activity date
            let lastDate = '-';
            const allSupDates = [
              ...supStock.map(st => st.date),
              ...supTrucks.map(t => t.dispatchDate || t.arrivalDate)
            ].filter(Boolean).sort();
            if (allSupDates.length > 0) {
              lastDate = allSupDates[allSupDates.length - 1];
            }

            if (totalInward > 0 || totalDispatchedOrSettled > 0 || netOwedToSupplier !== 0) {
              grandSupInward += totalInward;
              grandSupReturned += totalDispatchedOrSettled;

              const isSettled = netOwedToSupplier <= 0;
              const matchesStatus = statusFilter.includes('all') ||
                (statusFilter.includes('pending') && !isSettled) ||
                (statusFilter.includes('settled') && isSettled);

              if (matchesStatus) {
                rows.push({
                  partyId: sId,
                  partyName: sup.name || 'Supplier',
                  partyType: 'Supplier (Inward)',
                  rawPartyType: 'Supplier',
                  phone: sup.phone || '',
                  baseQuantity: totalInward,
                  settledQuantity: totalDispatchedOrSettled,
                  netBalance: netOwedToSupplier,
                  status: isSettled ? 'Settled' : `Owed: ${netOwedToSupplier.toLocaleString()} Crates`,
                  lastActivityDate: lastDate,
                  actionPartyId: sId,
                  actionPartyType: 'Supplier'
                });
              }
            }
          });
        }

        // 2. Process Customer Outward Ledger (Buyers)
        if (isAll || isCustomerOnly) {
          // Gather registered customers & unique walk-in buyers
          const customerEntities = new Map();
          allCustomers.forEach(c => {
            customerEntities.set(String(c.id || c._id), { id: String(c.id || c._id), name: c.name, phone: c.phone || '', isWalkIn: false });
          });

          // Check for walk-in sales
          allSales.forEach(s => {
            if (s.isWalkIn && s.walkInName && !customerEntities.has(s.walkInName)) {
              customerEntities.set(s.walkInName, { id: s.walkInName, name: `${s.walkInName} (Walk-In)`, phone: s.walkInPhone || '', isWalkIn: true });
            }
          });

          customerEntities.forEach(cust => {
            const cId = String(cust.id);
            const custName = (cust.name || '').trim().toLowerCase();
            if (activePartyId && activePartyId !== cId && activePartyId !== cust.name) return;

            // Issued crates from sales
            const custSales = allSales.filter(s => {
              if (s.isDeleted) return false;
              if (endStr && s.date > endStr) return false;
              if (cust.isWalkIn) return s.walkInName === cId || (s.walkInName && s.walkInName.toLowerCase() === custName);
              const matchesId = s.customerId && String(s.customerId) === cId;
              const matchesName = custName && s.customerName && String(s.customerName).trim().toLowerCase() === custName;
              return matchesId || matchesName;
            });
            const salesIssuedQty = custSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

            // Approved returns (empty crates returned & produce returns)
            const allCustomerReturns = (allReturns || []).filter(r => {
              if (r.isDeleted || r.status !== 'Approved') return false;
              if (endStr && r.date && r.date > endStr) return false;
              if (cust.isWalkIn) return r.customerName === cust.name;
              const matchesId = r.customerId && String(r.customerId) === cId;
              const matchesName = custName && r.customerName && String(r.customerName).trim().toLowerCase() === custName;
              return matchesId || matchesName;
            });

            const returnRecordCrates = allCustomerReturns.reduce((sum, r) => {
              const good = Number(r.goodCratesReturned) || 0;
              const damaged = Number(r.damagedCratesReturned) || 0;
              const totalRet = Number(r.totalCratesReturned) || 0;
              const prodRet = Number(r.produceReturnedQty) || 0;
              return sum + (totalRet || (good + damaged) || prodRet);
            }, 0);

            const totalIssued = salesIssuedQty;
            const totalReturned = Math.min(totalIssued, returnRecordCrates);
            const netPendingFromBuyer = Math.max(0, totalIssued - totalReturned);

            // Find last activity date
            let lastDate = '-';
            const allCustDates = [
              ...custSales.map(s => s.date),
              ...allCustomerReturns.map(r => r.date)
            ].filter(Boolean).sort();
            if (allCustDates.length > 0) {
              lastDate = allCustDates[allCustDates.length - 1];
            }

            if (totalIssued > 0 || totalReturned > 0 || netPendingFromBuyer !== 0) {
              grandCustOutward += totalIssued;
              grandCustReturned += totalReturned;

              const isSettled = netPendingFromBuyer <= 0;
              const matchesStatus = statusFilter.includes('all') ||
                (statusFilter.includes('pending') && !isSettled) ||
                (statusFilter.includes('settled') && isSettled);

              if (matchesStatus) {
                rows.push({
                  partyId: cId,
                  partyName: cust.name || 'Customer',
                  partyType: 'Customer (Outward)',
                  rawPartyType: 'Customer',
                  phone: cust.phone || '',
                  baseQuantity: totalIssued,
                  settledQuantity: totalReturned,
                  netBalance: netPendingFromBuyer,
                  status: isSettled ? 'Settled' : `Pending: ${netPendingFromBuyer.toLocaleString()} Crates`,
                  lastActivityDate: lastDate,
                  actionPartyId: cId,
                  actionPartyType: 'Customer'
                });
              }
            }
          });
        }

        // Sort rows by largest pending balance descending
        rows.sort((a, b) => b.netBalance - a.netBalance);
        reportRows = rows;

        const netSupOwed = Math.max(0, grandSupInward - grandSupReturned);
        const netCustPending = Math.max(0, grandCustOutward - grandCustReturned);

        summaryData = {
          supplierInward: grandSupInward,
          supplierReturned: grandSupReturned,
          netSupplierOwed: netSupOwed,
          customerOutward: grandCustOutward,
          customerReturned: grandCustReturned,
          netCustomerPending: netCustPending
        };

        totalsData = {
          baseQuantity: grandSupInward + grandCustOutward,
          settledQuantity: grandSupReturned + grandCustReturned,
          netBalance: netCustPending - netSupOwed
        };
        break;
      }

      // Commented code of Peshgi / Advance Report
      /*
      // 8. ADVANCE REPORT (Peshgi Management: Supplier & Buyer 2-Way Ledger)
      case 'advance': {
        const rawCat = (partyCategory || partyType || '').trim().toLowerCase();
        const isAll = !rawCat || rawCat.includes('all') || rawCat.includes('2-way');
        const isSupplierOnly = rawCat.includes('supplier') || rawCat.includes('زمیندار');
        const isCustomerOnly = rawCat.includes('customer') || rawCat.includes('buyer') || rawCat.includes('خریدار');
        const statusFilter = (riskThreshold || 'all').trim().toLowerCase();

        let rows = [];
        let grandSupGiven = 0, grandSupDeductions = 0, grandSupRemaining = 0;
        let grandCustReceived = 0, grandCustAdjusted = 0, grandCustRemaining = 0;

        // 1. Process Supplier Peshgi (زمیندار پیشگی - Crop Harvest Season Advances)
        if (isAll || isSupplierOnly) {
          allSuppliers.forEach(sup => {
            const sId = sup.id || sup._id;
            if (activePartyId && activePartyId !== sId && activePartyId !== sup.name) return;

            // Payments of type 'Paid' made to supplier (disbursements)
            const supPayments = allPayments.filter(p => !p.isDeleted && p.partyId === sId && p.partyType === 'Supplier' && p.type === 'Paid' && p.date <= endStr);
            const explicitAdvPaid = supPayments.filter(p => {
              const desc = (p.description || '').toLowerCase();
              return desc.includes('advance') || desc.includes('peshgi') || desc.includes('پیشگی') || p.paymentMethod === 'Advance';
            }).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            // Lot-wise auto-deductions across supplier stock consignments
            const supStock = allStock.filter(st => !st.isDeleted && st.supplierId === sId && st.date <= endStr);
            let lotAdvDeductions = 0;
            let lotDeductionCount = 0;

            supStock.forEach(st => {
              const exp = st.lotExpenses || {};
              const advAmt = Number(exp.advance || exp.peshgi || exp.Advance || exp['Advance Deduction'] || exp['Peshgi Deduction'] || 0);
              if (advAmt > 0) {
                lotAdvDeductions += advAmt;
                lotDeductionCount++;
              }
            });

            // Direct repayments/cash returns from supplier
            const supDirectRepayments = allPayments.filter(p => !p.isDeleted && p.partyId === sId && p.partyType === 'Supplier' && p.type === 'Received' && p.date <= endStr && (
              (p.description || '').toLowerCase().includes('advance') || 
              (p.description || '').toLowerCase().includes('peshgi') || 
              (p.description || '').includes('پیشگی') ||
              p.paymentMethod === 'Advance'
            )).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            // Itemized lot deductions list
            const deductionsList = [];
            supStock.forEach(st => {
              const exp = st.lotExpenses || {};
              const advAmt = Number(exp.advance || exp.peshgi || exp.Advance || exp['Advance Deduction'] || exp['Peshgi Deduction'] || 0);
              if (advAmt > 0) {
                deductionsList.push({
                  type: 'Lot Consignment Deduction',
                  date: st.date,
                  lotNumber: st.lotNumber,
                  productName: st.productName || st.product?.name || 'Produce',
                  amount: advAmt,
                  truckNumber: st.truckNumber || st.vehicleNumber || '-',
                  isSettled: st.isSettled || false
                });
              }
            });

            // Direct return receipts from supplier
            allPayments.filter(p => !p.isDeleted && p.partyId === sId && p.partyType === 'Supplier' && p.type === 'Received' && p.date <= endStr && (
              (p.description || '').toLowerCase().includes('advance') || 
              (p.description || '').toLowerCase().includes('peshgi') || 
              (p.description || '').includes('پیشگی') ||
              p.paymentMethod === 'Advance'
            )).forEach(p => {
              deductionsList.push({
                type: 'Direct Cash / Bank Repayment',
                date: p.date,
                lotNumber: p.receiptNumber || p.voucherNumber || '-',
                productName: p.paymentMethod || 'Cash',
                amount: Number(p.amount) || 0,
                truckNumber: p.description || 'Peshgi Repayment',
                isSettled: true
              });
            });

            const disbursementsList = supPayments.map(p => ({
              date: p.date,
              voucherNumber: p.voucherNumber || p.paymentNumber || '-',
              amount: Number(p.amount) || 0,
              paymentMethod: p.paymentMethod || 'Cash',
              description: p.description || 'Advance Disbursed (پیشگی ادائیگی)'
            }));

            const totalAutoDeductionsAndRepayments = lotAdvDeductions + supDirectRepayments;

            // Compute total advance disbursed
            let totalGiven = explicitAdvPaid;
            if (totalGiven === 0) {
              if (sup.currentBalance < 0) {
                totalGiven = Math.abs(sup.currentBalance);
              } else if (totalAutoDeductionsAndRepayments > 0) {
                totalGiven = totalAutoDeductionsAndRepayments;
              }
            } else if (totalGiven < totalAutoDeductionsAndRepayments) {
              totalGiven = totalAutoDeductionsAndRepayments;
            }

            const remainingAdvance = Math.max(0, totalGiven - totalAutoDeductionsAndRepayments);
            const recoveryPercent = totalGiven > 0 ? Math.min(100, Math.round((totalAutoDeductionsAndRepayments / totalGiven) * 100)) : (totalAutoDeductionsAndRepayments > 0 ? 100 : 0);

            // Find earliest and latest activity date
            const allDates = [...supPayments.map(p => p.date), ...supStock.map(s => s.date)].filter(Boolean).sort();
            const firstDate = allDates[0] || supStock[0]?.date || startStr;

            if (totalGiven > 0 || totalAutoDeductionsAndRepayments > 0) {
              grandSupGiven += totalGiven;
              grandSupDeductions += totalAutoDeductionsAndRepayments;
              grandSupRemaining += remainingAdvance;

              const isSettled = remainingAdvance === 0;
              const matchesStatus = statusFilter.includes('all') ||
                (statusFilter.includes('pending') && !isSettled) ||
                (statusFilter.includes('settled') && isSettled);

              if (matchesStatus) {
                rows.push({
                  partyId: sId,
                  partyName: sup.name || 'Farmer / Consignor',
                  partyType: 'Supplier (زمیندار پیشگی)',
                  rawPartyType: 'Supplier',
                  phone: sup.phone || '',
                  issueDate: firstDate,
                  totalAdvance: totalGiven,
                  adjustedAmount: totalAutoDeductionsAndRepayments,
                  remainingAdvance: remainingAdvance,
                  recoveryRate: `${recoveryPercent}%`,
                  recoveryPercent: recoveryPercent,
                  deductionsCount: lotDeductionCount > 0 ? `${lotDeductionCount} Lots Deducted` : (supDirectRepayments > 0 ? 'Direct Return' : 'No Deductions Yet'),
                  status: isSettled ? 'Settled' : `Active (Bal: Rs. ${remainingAdvance.toLocaleString()})`,
                  deductionsHistory: deductionsList,
                  disbursementsHistory: disbursementsList
                });
              }
            }
          });
        }

        // 2. Process Customer Advances (خریدار پیشگی - Buyer Advance Deposits / Security)
        if (isAll || isCustomerOnly) {
          allCustomers.forEach(cust => {
            const cId = cust.id || cust._id;
            if (activePartyId && activePartyId !== cId && activePartyId !== cust.name) return;

            // Payments received from customer marked as advance / deposit
            const custPayments = allPayments.filter(p => !p.isDeleted && p.partyId === cId && p.partyType === 'Customer' && p.type === 'Received' && p.date <= endStr);
            const explicitAdvReceived = custPayments.filter(p => {
              const desc = (p.description || '').toLowerCase();
              return desc.includes('advance') || desc.includes('deposit') || desc.includes('security') || desc.includes('peshgi') || desc.includes('پیشگی') || p.paymentMethod === 'Advance';
            }).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            // Compute total advance received
            let totalReceived = explicitAdvReceived;
            if (totalReceived === 0 && cust.currentBalance < 0) {
              totalReceived = Math.abs(cust.currentBalance);
            }

            if (totalReceived > 0) {
              // Deductions / Adjustments against auction sales or refunds
              const custSales = allSales.filter(s => !s.isDeleted && s.customerId === cId && s.date <= endStr);
              const salesVal = custSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

              const custRefunds = allPayments.filter(p => !p.isDeleted && p.partyId === cId && p.partyType === 'Customer' && p.type === 'Paid' && p.date <= endStr).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

              const totalAdjusted = Math.min(totalReceived, salesVal + custRefunds);
              const remainingAdvance = Math.max(0, totalReceived - totalAdjusted);
              const recoveryPercent = totalReceived > 0 ? Math.min(100, Math.round((totalAdjusted / totalReceived) * 100)) : 0;

              grandCustReceived += totalReceived;
              grandCustAdjusted += totalAdjusted;
              grandCustRemaining += remainingAdvance;

              const isSettled = remainingAdvance === 0;
              const matchesStatus = statusFilter.includes('all') ||
                (statusFilter.includes('pending') && !isSettled) ||
                (statusFilter.includes('settled') && isSettled);

              const firstDate = custPayments[0]?.date || custSales[0]?.date || startStr;

              const deductionsList = custSales.slice(0, 10).map(s => ({
                type: 'Auction Invoice Settlement',
                date: s.date,
                lotNumber: s.invoiceNumber || s.billNumber || '-',
                productName: s.productName || 'Auction Goods',
                amount: Number(s.totalAmount) || 0,
                truckNumber: s.quantity ? `${s.quantity} units` : '-',
                isSettled: true
              }));

              const disbursementsList = custPayments.map(p => ({
                date: p.date,
                voucherNumber: p.receiptNumber || p.voucherNumber || '-',
                amount: Number(p.amount) || 0,
                paymentMethod: p.paymentMethod || 'Cash',
                description: p.description || 'Advance / Security Deposit Received (خریدار پیشگی)'
              }));

              if (matchesStatus) {
                rows.push({
                  partyId: cId,
                  partyName: cust.name || 'Buyer / Commission Party',
                  partyType: 'Customer (خریدار پیشگی)',
                  rawPartyType: 'Customer',
                  phone: cust.phone || '',
                  issueDate: firstDate,
                  totalAdvance: totalReceived,
                  adjustedAmount: totalAdjusted,
                  remainingAdvance: remainingAdvance,
                  recoveryRate: `${recoveryPercent}%`,
                  recoveryPercent: recoveryPercent,
                  deductionsCount: custSales.length > 0 ? `${custSales.length} Invoices Adjusted` : (custRefunds > 0 ? 'Refunded' : 'Unadjusted Deposit'),
                  status: isSettled ? 'Settled' : `Active (Bal: Rs. ${remainingAdvance.toLocaleString()})`,
                  deductionsHistory: deductionsList,
                  disbursementsHistory: disbursementsList
                });
              }
            }
          });
        }

        // Sort by largest remaining advance balance descending
        rows.sort((a, b) => b.remainingAdvance - a.remainingAdvance);
        reportRows = rows;

        summaryData = {
          supplierAdvanceGiven: grandSupGiven,
          supplierDeductions: grandSupDeductions,
          netSupplierAdvance: grandSupRemaining,
          customerAdvanceReceived: grandCustReceived,
          customerAdvanceAdjusted: grandCustAdjusted,
          netCustomerAdvance: grandCustRemaining
        };

        totalsData = {
          totalAdvance: grandSupGiven + grandCustReceived,
          adjustedAmount: grandSupDeductions + grandCustAdjusted,
          remainingAdvance: grandSupRemaining + grandCustRemaining
        };
        break;
      }
      */

      // 9. ABSENT PARTY REPORT
      case 'absent-party': {
        const today = new Date(targetAsOfDate);

        reportRows = allSuppliers.map(sup => {
          const supStock = allStock.filter(st => st.supplierId === (sup.id || sup._id));
          if (supStock.length === 0) return null;

          supStock.sort((a, b) => new Date(a.date) - new Date(b.date));
          const lastDateStr = supStock[supStock.length - 1].date;
          const diffDays = Math.max(0, Math.floor((today - new Date(lastDateStr)) / (1000 * 60 * 60 * 24)));

          return {
            supplierName: sup.name,
            phone: sup.phone,
            primaryCommodity: supStock[0]?.productName || 'Produce',
            lastArrivalDate: lastDateStr,
            daysInactive: `${diffDays} Days`
          };
        }).filter(Boolean).filter(r => parseInt(r.daysInactive) >= 1);

        totalsData = {};
        break;
      }

      // 10. PAYABLES REPORT
      case 'payables': {
        const today = new Date(targetAsOfDate);
        let totPay = 0;
        let t0_7 = 0, t8_15 = 0, t16_30 = 0, t30Plus = 0;

        reportRows = allSuppliers.map(sup => {
          const supStock = allStock.filter(st => st.supplierId === (sup.id || sup._id) && st.date <= targetAsOfDate);
          const supPayments = allPayments.filter(p => p.partyId === (sup.id || sup._id) && p.type === 'Paid' && p.date <= targetAsOfDate);

          const totGrossPayable = supStock.reduce((sum, st) => sum + (st.netPayable || st.totalAmount || 0), 0);
          const totPaid = supPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          const netPayable = Math.max(0, totGrossPayable - totPaid);

          let b0_7 = 0, b8_15 = 0, b16_30 = 0, b30P = 0;

          if (netPayable > 0) {
            supStock.forEach(st => {
              const stAmt = st.netPayable || st.totalAmount || 0;
              const diffDays = Math.max(0, Math.floor((today - new Date(st.date)) / (1000 * 60 * 60 * 24)));
              if (diffDays <= 7) b0_7 += stAmt;
              else if (diffDays <= 15) b8_15 += stAmt;
              else if (diffDays <= 30) b16_30 += stAmt;
              else b30P += stAmt;
            });

            if (totGrossPayable > 0 && netPayable < totGrossPayable) {
              const ratio = netPayable / totGrossPayable;
              b0_7 = Math.round(b0_7 * ratio);
              b8_15 = Math.round(b8_15 * ratio);
              b16_30 = Math.round(b16_30 * ratio);
              b30P = netPayable - (b0_7 + b8_15 + b16_30);
            }
          }

          totPay += netPayable; t0_7 += b0_7; t8_15 += b8_15; t16_30 += b16_30; t30Plus += b30P;

          return {
            supplierName: sup.name,
            totalPayable: netPayable,
            bucket0to7: b0_7,
            bucket8to15: b8_15,
            bucket16to30: b16_30,
            bucket30Plus: b30P
          };
        }).filter(r => r.totalPayable > 0);

        totalsData = { totalPayable: totPay, bucket0to7: t0_7, bucket8to15: t8_15, bucket16to30: t16_30, bucket30Plus: t30Plus };
        break;
      }

      // 10b. SUPPLIER EXPENSE DEDUCTIONS REPORT (Freight, Labor/Hamali, Crates, Commission & Lot Deductions)
      case 'supplier-deductions':
      case 'supplier-expense-deductions': {
        let filteredStock = allStock.filter(st => st.date >= startStr && st.date <= endStr);
        if (supplierId) {
          filteredStock = filteredStock.filter(st => st.supplierId === supplierId);
        }
        if (productId) {
          filteredStock = filteredStock.filter(st => st.productId === productId);
        }

        let totGross = 0;
        let totCommDeduct = 0;
        let totLotExpDeduct = 0;
        let totDeductions = 0;
        let totNetPayable = 0;
        let totArrivedQty = 0;
        let totSoldQty = 0;
        let totRemainingQty = 0;

        const expenseCategoryBreakdown = new Map();

        reportRows = filteredStock.map(st => {
          const stId = String(st.id || st._id);
          const lotSales = allSales.filter(s => String(s.stockEntryId) === stId && !s.isDeleted);
          const lotReturns = returnsByStockId.get(stId) || [];

          const rawSalesRealization = lotSales.reduce((sum, s) => sum + (Number(s.grossSale) || (Number(s.quantity) * Number(s.saleRate || 0)) || Number(s.totalAmount) || 0), 0);
          const rawQtySold = lotSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

          const returnedLotGross = lotReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
          const returnedLotQty = lotReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);

          const arrivedQty = Number(st.quantity) || 0;
          const netSoldQty = Math.max(0, rawQtySold - returnedLotQty);
          const remainingQty = st.remainingQuantity !== undefined ? Number(st.remainingQuantity) : Math.max(0, arrivedQty - netSoldQty);

          const salesRealization = Math.max(0, rawSalesRealization - returnedLotGross);
          const rawStockTotal = Number(st.totalAmount) || (arrivedQty * Number(st.purchaseRate || 0));
          const netStockTotal = Math.max(0, rawStockTotal - returnedLotGross);
          const grossAmount = salesRealization > 0 ? salesRealization : netStockTotal;

          // Beopari Commission Deduction based on updated net gross sale value
          const commType = st.supplierCommissionType || 'Percentage';
          const commVal = Number(st.supplierCommissionValue) || 0;
          let commAmt = 0;
          if (commVal > 0) {
            if (commType === 'Percentage') {
              commAmt = grossAmount * (commVal / 100);
            } else if (commType === 'Per Unit') {
              commAmt = (netSoldQty > 0 ? netSoldQty : arrivedQty) * commVal;
            } else if (commType === 'Fixed Amount') {
              commAmt = commVal;
            }
          }
          commAmt = Math.round(commAmt * 100) / 100;

          // Lot Expense Deductions (Strictly from supplier lots, excluding Mandi shop operating expenses)
          let lotExpAmt = 0;
          if (st.lotExpenses && typeof st.lotExpenses === 'object') {
            Object.entries(st.lotExpenses).forEach(([catName, val]) => {
              const num = Number(val);
              if (!isNaN(num) && num > 0) {
                lotExpAmt += num;
                expenseCategoryBreakdown.set(catName, (expenseCategoryBreakdown.get(catName) || 0) + num);
              }
            });
          }

          // Market / Sarkari Fee Deduction based on updated net gross sale value
          const mktRate = Number(st.marketFeeRate || st.marketFeePercentage || 0);
          let mktFeeAmt = 0;
          if (st.marketFeeFixedAmount !== undefined) {
            mktFeeAmt = Number(st.marketFeeFixedAmount) || 0;
          } else if (mktRate > 0) {
            mktFeeAmt = Math.round((grossAmount * (mktRate / 100)) * 100) / 100;
          } else if (st.marketFeeAmount) {
            mktFeeAmt = Number(st.marketFeeAmount);
          }
          if (mktFeeAmt > 0) {
            lotExpAmt += mktFeeAmt;
            expenseCategoryBreakdown.set('Market/Sarkari Fee', (expenseCategoryBreakdown.get('Market/Sarkari Fee') || 0) + mktFeeAmt);
          }
          lotExpAmt = Math.round(lotExpAmt * 100) / 100;

          let lotTotalDeductions = Math.round((commAmt + lotExpAmt) * 100) / 100;
          if (st.totalDeductions && Number(st.totalDeductions) > lotTotalDeductions) {
            lotTotalDeductions = Number(st.totalDeductions);
          }

          const netPay = Math.round(Math.max(0, grossAmount - lotTotalDeductions) * 100) / 100;

          totGross += grossAmount;
          totCommDeduct += commAmt;
          totLotExpDeduct += lotExpAmt;
          totDeductions += lotTotalDeductions;
          totNetPayable += netPay;
          totArrivedQty += arrivedQty;
          totSoldQty += netSoldQty;
          totRemainingQty += remainingQty;

          const prod = productsMap.get(st.productId);
          const unitStr = st.unit || prod?.unit || 'Crates';

          let statusStr = 'Active';
          if (st.isSettled) {
            statusStr = 'Settled';
          } else if (remainingQty <= 0 && netSoldQty > 0) {
            statusStr = 'Sold Out';
          } else if (netSoldQty > 0) {
            statusStr = 'Partial';
          }

          return {
            date: st.date,
            lotNo: st.lotNumber ? `#${st.lotNumber}` : (st.id || st._id)?.slice(-6)?.toUpperCase(),
            supplierName: st.supplierName || 'Unknown Supplier',
            productName: st.productName || 'Produce Lot',
            quantity: arrivedQty,
            arrivedQuantity: arrivedQty,
            soldQuantity: netSoldQty,
            remainingQuantity: remainingQty,
            unit: unitStr,
            grossAmount: Math.round(grossAmount * 100) / 100,
            commissionDeduction: commAmt,
            marketFeeRate: mktRate,
            marketFeeDeduction: mktFeeAmt,
            lotExpenseDeduction: lotExpAmt,
            totalDeductions: lotTotalDeductions,
            netPayable: netPay,
            status: statusStr
          };
        });

        // Summary Cards
        summaryData = {
          totalConsignmentCrates: totArrivedQty,
          totalGrossValue: Math.round(totGross * 100) / 100,
          totalCommissionDeductions: Math.round(totCommDeduct * 100) / 100,
          totalLotExpenses: Math.round(totLotExpDeduct * 100) / 100,
          totalDeductions: Math.round(totDeductions * 100) / 100,
          netPayableToSuppliers: Math.round(totNetPayable * 100) / 100,
          totalCrates: totArrivedQty,
          totalSoldCrates: totSoldQty,
          totalRemainingCrates: totRemainingQty
        };

        // Chart Data (Visual breakdown of deduction categories)
        const chartList = [];
        if (totCommDeduct > 0) {
          chartList.push({ name: 'Commission', Deductions: totCommDeduct });
        }
        expenseCategoryBreakdown.forEach((amt, name) => {
          chartList.push({ name, Deductions: amt });
        });
        if (chartList.length === 0) {
          chartList.push({ name: 'No Deductions', Deductions: 0 });
        }
        chartData = chartList;

        totalsData = {
          quantity: totArrivedQty,
          soldQuantity: totSoldQty,
          grossAmount: Math.round(totGross * 100) / 100,
          commissionDeduction: Math.round(totCommDeduct * 100) / 100,
          lotExpenseDeduction: Math.round(totLotExpDeduct * 100) / 100,
          totalDeductions: Math.round(totDeductions * 100) / 100,
          netPayable: Math.round(totNetPayable * 100) / 100
        };
        break;
      }

      // 11. MARKET FEE / COMMITTEE LEVY REPORT (مارکیٹ کمیٹی فیس / لیوی رپورٹ)
      case 'market-fee': {
        // Filter stock consignments within date range
        let filteredStock = allStock.filter(st => st.date >= startStr && st.date <= endStr);

        if (supplierId) {
          filteredStock = filteredStock.filter(st => st.supplierId === supplierId);
        }
        if (productId) {
          filteredStock = filteredStock.filter(st => st.productId === productId);
        }

        const statusFilter = (riskThreshold || 'All Lots').toLowerCase();
        if (statusFilter.includes('settled')) {
          filteredStock = filteredStock.filter(st => st.isSettled);
        } else if (statusFilter.includes('active') || statusFilter.includes('unsettled')) {
          filteredStock = filteredStock.filter(st => !st.isSettled);
        }

        let grandAssessedTurnover = 0;
        let grandMarketFeeDue = 0;
        let grandSoldVolume = 0;
        let assessedLotsCount = 0;

        const rows = [];

        filteredStock.forEach((st, idx) => {
          const sId = String(st.id || st._id);
          const lotSales = allSales.filter(s => String(s.stockEntryId) === sId);
          const lotReturns = returnsByStockId.get(sId) || [];

          const rawSalesRealization = lotSales.reduce((sum, s) => sum + (Number(s.grossSale) || (Number(s.quantity) * Number(s.saleRate || 0)) || Number(s.totalAmount) || 0), 0);
          const returnedLotGross = lotReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
          const returnedLotQty = lotReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);

          const salesRealization = Math.max(0, rawSalesRealization - returnedLotGross);
          const rawStockTotal = Number(st.totalAmount) || (Number(st.quantity || 0) * Number(st.purchaseRate || 0));
          const netStockTotal = Math.max(0, rawStockTotal - returnedLotGross);
          const grossTurnover = salesRealization > 0 ? salesRealization : netStockTotal;

          const rawLotSoldQty = lotSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
          const netLotSoldQty = Math.max(0, rawLotSoldQty - returnedLotQty);
          const netStockQty = Math.max(0, (Number(st.quantity) || 0) - returnedLotQty);
          const volume = netLotSoldQty > 0 ? netLotSoldQty : netStockQty;

          // Real-time lookup of Market / Sarkari Fee rate configured on the Lot Inspection Sheet
          let rateVal = 0;
          if (st.marketFeeFixedAmount !== undefined && st.marketFeeFixedAmount !== null) {
            rateVal = Number(st.marketFeeFixedAmount) || 0;
          } else if (st.marketFeeRate !== undefined && st.marketFeeRate !== null) {
            rateVal = Number(st.marketFeeRate) || 0;
          } else if (st.marketFeePercentage !== undefined && st.marketFeePercentage !== null) {
            rateVal = Number(st.marketFeePercentage) || 0;
          }

          let feeAmt = 0;
          if (st.marketFeeFixedAmount !== undefined && st.marketFeeFixedAmount !== null) {
            feeAmt = rateVal;
          } else if (rateVal > 0) {
            feeAmt = Math.round((grossTurnover * (rateVal / 100)) * 100) / 100;
          } else if (st.marketFeeAmount !== undefined && st.marketFeeAmount !== null && Number(st.marketFeeAmount) > 0) {
            feeAmt = Number(st.marketFeeAmount);
          }

          grandAssessedTurnover += grossTurnover;
          grandMarketFeeDue += feeAmt;
          grandSoldVolume += volume;
          assessedLotsCount++;

          const prod = productsMap.get(st.productId);
          const lotNo = st.lotNumber ? `#${st.lotNumber}` : (st.supplierName ? `${st.supplierName.substring(0, 3).toUpperCase()}-${sId.slice(-4)}` : `LOT-${idx + 101}`);

          rows.push({
            id: sId,
            date: st.date,
            lotNo,
            supplierName: st.supplierName || 'Unknown Supplier',
            commodity: st.productName || prod?.name || 'Produce',
            quantity: volume,
            grossTurnover: Math.round(grossTurnover * 100) / 100,
            feeAmount: Math.round(feeAmt * 100) / 100,
            status: st.isSettled ? 'Settled (Deducted)' : (st.remainingQuantity === 0 ? 'Sold Out' : 'Active Trading')
          });
        });

        // Also capture any standalone sales not attached to stock entries (e.g. direct sales) if no lots exist
        if (rows.length === 0 && (!supplierId && !productId)) {
          const directSales = allSales.filter(s => s.date >= startStr && s.date <= endStr && !s.stockEntryId);
          directSales.forEach((s, idx) => {
            const sId = String(s.id || s._id);
            const sReturns = returnsBySaleId.get(sId) || [];
            const retGross = sReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
            const retQty = sReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);

            const gross = Math.max(0, (Number(s.totalAmount) || 0) - retGross);
            const qty = Math.max(0, (Number(s.quantity) || 0) - retQty);
            const fee = 0;
            grandAssessedTurnover += gross;
            grandMarketFeeDue += fee;
            grandSoldVolume += qty;
            assessedLotsCount++;

            rows.push({
              id: sId,
              date: s.date,
              lotNo: `INV-${sId.slice(-5).toUpperCase()}`,
              supplierName: s.customerName || (s.isWalkIn ? s.walkInName : 'Direct Trade'),
              commodity: s.productName || 'Produce',
              quantity: qty,
              grossTurnover: Math.round(gross * 100) / 100,
              feeAmount: fee,
              status: 'Direct Sale'
            });
          });
        }

        // Sort descending by date
        rows.sort((a, b) => new Date(b.date) - new Date(a.date));
        reportRows = rows;

        summaryData = {
          assessedTurnover: Math.round(grandAssessedTurnover * 100) / 100,
          totalMarketFeeDue: Math.round(grandMarketFeeDue * 100) / 100,
          lotsAssessed: assessedLotsCount,
          averageFeePerLot: `Rs. ${assessedLotsCount > 0 ? (grandMarketFeeDue / assessedLotsCount).toFixed(2) : '0.00'}`
        };

        totalsData = {
          quantity: grandSoldVolume,
          grossTurnover: Math.round(grandAssessedTurnover * 100) / 100,
          feeAmount: Math.round(grandMarketFeeDue * 100) / 100
        };
        break;
      }

      // 12. EXPENSE REPORT
      case 'expense': {
        const filtered = allExpenses.filter(e => e.date >= startStr && e.date <= endStr);
        let totExp = 0;
        const catMap = new Map();

        reportRows = filtered.map(e => {
          totExp += e.amount || 0;
          catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount);

          return {
            date: e.date,
            category: e.category || 'General',
            payee: e.recordedBy || 'Mandi Shop',
            description: e.description || 'Operating Expense',
            amount: e.amount || 0
          };
        });

        chartData = Array.from(catMap.entries()).map(([cat, amt]) => ({
          name: cat,
          Expense: amt
        }));

        totalsData = { amount: totExp };
        break;
      }

      // 13. PRICE TREND (قیمتوں کا اتار چڑھاؤ / رجحان رپورٹ)
      case 'price-trend': {
        const targetProduct = productId ? (productsMap.get(productId) || allProducts.find(p => (p.id || p._id) === productId || p.name?.toLowerCase() === productId?.toLowerCase())) : null;
        const targetProdName = targetProduct?.name?.toLowerCase();

        let filteredSales = allSales.filter(s => s.date >= startStr && s.date <= endStr);
        if (productId) {
          filteredSales = filteredSales.filter(s => {
            if (s.productId === productId) return true;
            if (targetProduct && (s.productId === targetProduct.id || s.productId === targetProduct._id)) return true;
            if (targetProdName && s.productName && s.productName.toLowerCase() === targetProdName) return true;
            if (s.stockEntryId) {
              const st = stockMap.get(s.stockEntryId);
              if (st && (st.productId === productId || (targetProduct && (st.productId === targetProduct.id || st.productId === targetProduct._id)) || (targetProdName && st.productName?.toLowerCase() === targetProdName))) {
                return true;
              }
            }
            return false;
          });
        }

        const map = new Map();
        let grandTotalVal = 0;
        let grandTotalQty = 0;
        let lowestRate = Infinity;
        let highestRate = -Infinity;

        filteredSales.forEach(s => {
          const prod = productsMap.get(s.productId) || (s.stockEntryId ? productsMap.get(stockMap.get(s.stockEntryId)?.productId) : null);
          const commName = s.productName || prod?.name || 'Produce';
          const key = `${s.date}_${commName}`;
          const qty = Number(s.quantity) || 0;
          const rate = Number(s.saleRate) || (qty > 0 ? Math.round(((s.totalAmount || 0) / qty) * 100) / 100 : 0);
          const val = Number(s.totalAmount) || (qty * rate);

          if (rate > 0) {
            lowestRate = Math.min(lowestRate, rate);
            highestRate = Math.max(highestRate, rate);
          }
          grandTotalVal += val;
          grandTotalQty += qty;

          if (!map.has(key)) {
            map.set(key, {
              date: s.date,
              commodity: commName,
              minRate: rate,
              maxRate: rate,
              totalVal: val,
              totalQty: qty
            });
          } else {
            const obj = map.get(key);
            if (rate > 0) {
              obj.minRate = obj.minRate > 0 ? Math.min(obj.minRate, rate) : rate;
              obj.maxRate = Math.max(obj.maxRate, rate);
            }
            obj.totalVal += val;
            obj.totalQty += qty;
          }
        });

        reportRows = Array.from(map.values()).map(item => ({
          date: item.date,
          commodity: item.commodity,
          minRate: item.minRate === Infinity ? 0 : Math.round(item.minRate * 100) / 100,
          maxRate: item.maxRate === -Infinity ? 0 : Math.round(item.maxRate * 100) / 100,
          avgRate: item.totalQty > 0 ? Math.round((item.totalVal / item.totalQty) * 100) / 100 : 0,
          totalQty: item.totalQty
        })).sort((a, b) => new Date(b.date) - new Date(a.date));

        // Chronological chart data
        const chartRows = [...reportRows].sort((a, b) => new Date(a.date) - new Date(b.date));
        chartData = chartRows.map(r => ({
          name: r.date,
          AvgRate: r.avgRate,
          MinRate: r.minRate,
          MaxRate: r.maxRate,
          Commodity: r.commodity,
          Volume: r.totalQty
        }));

        totalsData = {
          totalQty: grandTotalQty
        };
        break;
      }

      // 14. TOP ENTITIES
      case 'top-entities': {
        const isBuyerToggle = entityType !== 'Top Suppliers';
        const filteredSales = allSales.filter(s => s.date >= startStr && s.date <= endStr);
        const entityMap = new Map();

        if (isBuyerToggle) {
          filteredSales.forEach(s => {
            const bId = s.customerId || s.walkInName || 'Walk-In';
            const bName = s.customerName || (s.isWalkIn ? `Walk-In: ${s.walkInName}` : 'General Buyer');
            if (!entityMap.has(bId)) {
              entityMap.set(bId, { partyName: bName, role: 'Buyer', totalVolume: 0, totalValue: 0, commissionGenerated: 0 });
            }
            const obj = entityMap.get(bId);

            const rawQty = Number(s.quantity) || 0;
            const sReturns = returnsBySaleId.get(String(s.id || s._id)) || [];
            const retQty = sReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);
            const retGross = sReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
            const reversedComm = sReturns.reduce((sum, r) => {
              let rev = Number(r.commissionReversedAmount) || 0;
              if (!rev && Number(r.produceReturnedQty) > 0 && rawQty > 0 && Number(s.commissionAmount) > 0) {
                rev = Number(r.produceReturnedQty) * (Number(s.commissionAmount) / rawQty);
              }
              return sum + rev;
            }, 0);

            const netQty = Math.max(0, rawQty - retQty);
            const netVal = Math.max(0, (Number(s.totalAmount) || 0) - (retGross + reversedComm));
            const rawComm = Number(s.commissionAmount) || 0;
            const netComm = Math.max(0, rawComm - reversedComm);

            obj.totalVolume += netQty;
            obj.totalValue += netVal;
            obj.commissionGenerated += netComm;
          });
        } else {
          const filteredStock = allStock.filter(st => st.date >= startStr && st.date <= endStr);
          filteredStock.forEach(st => {
            const sId = st.supplierId || st.supplierName || 'Unknown Supplier';
            const sName = st.supplierName || 'Supplier';
            if (!entityMap.has(sId)) {
              entityMap.set(sId, { partyName: sName, role: 'Supplier', totalVolume: 0, totalValue: 0, commissionGenerated: 0 });
            }
            const obj = entityMap.get(sId);

            const stId = String(st.id || st._id);
            const lotReturns = returnsByStockId.get(stId) || [];

            const rawStockQty = Number(st.quantity) || 0;
            const returnedLotQty = lotReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);
            const returnedLotGross = lotReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);

            const rawStockVal = Number(st.totalAmount) || (rawStockQty * Number(st.purchaseRate || 0));
            const netStockVal = Math.max(0, rawStockVal - returnedLotGross);
            const netStockQty = Math.max(0, rawStockQty - returnedLotQty);

            obj.totalVolume += netStockQty;
            obj.totalValue += netStockVal;

            const commVal = Number(st.supplierCommissionValue) || 0;
            const commType = st.supplierCommissionType || 'Percentage';
            let lotComm = 0;
            if (commVal > 0) {
              if (commType === 'Percentage') lotComm = netStockVal * (commVal / 100);
              else if (commType === 'Per Unit') lotComm = netStockQty * commVal;
              else if (commType === 'Fixed Amount') lotComm = commVal;
            }
            obj.commissionGenerated += Math.round(lotComm * 100) / 100;
          });
        }

        const sorted = Array.from(entityMap.values())
          .sort((a, b) => b.totalValue - a.totalValue)
          .slice(0, 10);

        reportRows = sorted.map((r, i) => ({
          ...r,
          rank: i + 1,
          totalValue: Math.round(r.totalValue * 100) / 100,
          commissionGenerated: Math.round(r.commissionGenerated * 100) / 100
        }));

        chartData = reportRows.map(r => ({
          name: r.partyName.split(' ')[0],
          TradeValue: r.totalValue
        }));

        totalsData = {
          totalVolume: reportRows.reduce((s, r) => s + r.totalVolume, 0),
          totalValue: Math.round(reportRows.reduce((s, r) => s + r.totalValue, 0) * 100) / 100,
          commissionGenerated: Math.round(reportRows.reduce((s, r) => s + r.commissionGenerated, 0) * 100) / 100
        };
        break;
      }

      // 15. MONTHLY PROFIT SUMMARY (ماہانہ منافع و بچت گوشوارہ)
      case 'monthly-profit': {
        const monthMap = new Map();

        // Track stock entry IDs that have sales accounted for
        const soldStockEntryMap = new Map(); // stockEntryId -> sum of sale gross values

        // 1. Process Real Sales Commissions (Customer + Supplier) within selected date range
        const matchingSales = allSales.filter(s => {
          const sDate = s.date || (s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '');
          if (!sDate) return false;
          if (startStr && sDate < startStr) return false;
          if (endStr && sDate > endStr) return false;
          return true;
        });

        matchingSales.forEach(s => {
          const sDate = s.date || (s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '');
          const mKey = sDate.substring(0, 7);
          if (!monthMap.has(mKey)) {
            monthMap.set(mKey, { custComm: 0, suppComm: 0, misc: 0, exp: 0, tradeValue: 0, volume: 0 });
          }
          const qty = Number(s.quantity) || 0;
          const grossVal = s.grossSale || (qty * (Number(s.saleRate) || 0)) || (Number(s.totalAmount) || 0);

          // A. Customer Commission (خریدار کمیشن) - only if actually entered
          const custComm = s.commissionAmount !== undefined && s.commissionAmount !== null
            ? Number(s.commissionAmount)
            : 0;

          // B. Beopari Commission on this sale (زمیندار کمیشن) - only if entered on lot inspection
          let suppComm = 0;
          const stockEntry = s.stockEntryId ? stockMap.get(s.stockEntryId) : null;
          if (stockEntry) {
            const commVal = Number(stockEntry.supplierCommissionValue) || 0;
            const commType = stockEntry.supplierCommissionType || 'Percentage';
            if (commVal > 0) {
              if (commType === 'Percentage') {
                suppComm = grossVal * (commVal / 100);
              } else if (commType === 'Per Unit') {
                suppComm = qty * commVal;
              } else if (commType === 'Fixed Amount') {
                const totalStockQty = Number(stockEntry.quantity) || 1;
                suppComm = totalStockQty > 0 ? (commVal * (qty / totalStockQty)) : 0;
              }
            }
            // Record that this stock entry has sales
            soldStockEntryMap.set(s.stockEntryId, (soldStockEntryMap.get(s.stockEntryId) || 0) + grossVal);
          }

          suppComm = Math.round(suppComm * 100) / 100;

          const obj = monthMap.get(mKey);
          obj.custComm += custComm;
          obj.suppComm += suppComm;
          obj.tradeValue += (Number(s.totalAmount) || grossVal);
          obj.volume += qty;
        });

        // 1b. Deduct Returns in the Period from monthly profit
        const matchingReturns = (allReturns || []).filter(r => {
          const rDate = r.date || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '');
          if (!rDate) return false;
          if (startStr && rDate < startStr) return false;
          if (endStr && rDate > endStr) return false;
          return true;
        });

        matchingReturns.forEach(r => {
          const rDate = r.date || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '');
          const mKey = rDate.substring(0, 7);
          if (monthMap.has(mKey)) {
            const obj = monthMap.get(mKey);
            const rQty = Number(r.produceReturnedQty) || 0;
            const rGross = Number(r.grossReturnAmount) || (rQty * Number(r.saleRate || 0));
            let rCustComm = Number(r.commissionReversedAmount) || 0;
            if (!rCustComm && rQty > 0) {
              const matchingSale = r.saleId ? allSales.find(s => String(s.id || s._id) === String(r.saleId)) : null;
              if (matchingSale && Number(matchingSale.quantity) > 0 && Number(matchingSale.commissionAmount) > 0) {
                rCustComm = rQty * (Number(matchingSale.commissionAmount) / Number(matchingSale.quantity));
              }
            }
            const rTotalDeduction = Number(r.returnAmount) || (rGross + rCustComm);

            let rSuppComm = 0;
            const stId = r.stockEntryId;
            const stockEntry = stId ? stockMap.get(stId) : null;
            if (stockEntry) {
              const commVal = Number(stockEntry.supplierCommissionValue) || 0;
              const commType = stockEntry.supplierCommissionType || 'Percentage';
              if (commVal > 0) {
                if (commType === 'Percentage') {
                  rSuppComm = rGross * (commVal / 100);
                } else if (commType === 'Per Unit') {
                  rSuppComm = rQty * commVal;
                }
              }
            }

            obj.custComm = Math.max(0, obj.custComm - rCustComm);
            obj.suppComm = Math.max(0, obj.suppComm - rSuppComm);
            obj.tradeValue = Math.max(0, obj.tradeValue - rTotalDeduction);
            obj.volume = Math.max(0, obj.volume - rQty);
          }
        });

        // 2. Process Supplier Consignments with direct settlements or unsolds in the period
        const matchingStock = allStock.filter(st => {
          const stDate = st.date || (st.createdAt ? new Date(st.createdAt).toISOString().split('T')[0] : '');
          if (!stDate) return false;
          if (startStr && stDate < startStr) return false;
          if (endStr && stDate > endStr) return false;
          return true;
        });

        matchingStock.forEach(st => {
          const stId = st.id || st._id;
          // If this stock entry had zero sales in the sales table, compute Beopari Commission from consignment arrival/settlement
          if (!soldStockEntryMap.has(stId)) {
            const stDate = st.date || (st.createdAt ? new Date(st.createdAt).toISOString().split('T')[0] : '');
            const mKey = stDate.substring(0, 7);
            if (!monthMap.has(mKey)) {
              monthMap.set(mKey, { custComm: 0, suppComm: 0, misc: 0, exp: 0, tradeValue: 0, volume: 0 });
            }

            const lotTradeVal = Number(st.totalAmount) || (Number(st.quantity || 0) * Number(st.purchaseRate || 0));
            const lotQty = Number(st.quantity) || 0;
            const commVal = Number(st.supplierCommissionValue) || 0;
            const commType = st.supplierCommissionType || 'Percentage';

            let sComm = 0;
            if (commVal > 0) {
              if (commType === 'Percentage') {
                sComm = lotTradeVal * (commVal / 100);
              } else if (commType === 'Per Unit') {
                sComm = lotQty * commVal;
              } else if (commType === 'Fixed Amount') {
                sComm = commVal;
              }
            }

            sComm = Math.round(sComm * 100) / 100;
            if (sComm > 0) {
              const obj = monthMap.get(mKey);
              obj.suppComm += sComm;
              obj.tradeValue += lotTradeVal;
              obj.volume += lotQty;
            }
          }
        });

        // 3. Process Operating Expenses within selected date range
        const matchingExpenses = allExpenses.filter(e => {
          const eDate = e.date || (e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '');
          if (!eDate) return false;
          if (startStr && eDate < startStr) return false;
          if (endStr && eDate > endStr) return false;
          return true;
        });

        matchingExpenses.forEach(e => {
          const eDate = e.date || (e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '');
          const mKey = eDate.substring(0, 7);
          if (!monthMap.has(mKey)) {
            monthMap.set(mKey, { custComm: 0, suppComm: 0, misc: 0, exp: 0, tradeValue: 0, volume: 0 });
          }
          monthMap.get(mKey).exp += (Number(e.amount) || 0);
        });

        // 4. Process Non-Trade / Misc Receipts in Payments within selected date range
        const matchingPayments = allPayments.filter(p => {
          const pDate = p.date || (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '');
          if (!pDate) return false;
          if (startStr && pDate < startStr) return false;
          if (endStr && pDate > endStr) return false;
          return true;
        });

        matchingPayments.forEach(p => {
          if (p.type === 'Received' && (!p.partyId || p.category === 'Income' || p.category === 'Misc Income' || p.partyType === 'Other')) {
            const pDate = p.date || (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '');
            const mKey = pDate.substring(0, 7);
            if (!monthMap.has(mKey)) {
              monthMap.set(mKey, { custComm: 0, suppComm: 0, misc: 0, exp: 0, tradeValue: 0, volume: 0 });
            }
            monthMap.get(mKey).misc += (Number(p.amount) || 0);
          }
        });

        // If date range spans across months, ensure all months in range exist in monthMap
        const startMonthKey = startStr ? startStr.substring(0, 7) : '';
        const endMonthKey = endStr ? endStr.substring(0, 7) : '';
        if (startMonthKey && endMonthKey && startMonthKey <= endMonthKey) {
          const [sYr, sMo] = startMonthKey.split('-').map(Number);
          const [eYr, eMo] = endMonthKey.split('-').map(Number);
          if (sYr && sMo && eYr && eMo) {
            let curYr = sYr;
            let curMo = sMo;
            while (curYr < eYr || (curYr === eYr && curMo <= eMo)) {
              const mKey = `${curYr}-${String(curMo).padStart(2, '0')}`;
              if (!monthMap.has(mKey)) {
                monthMap.set(mKey, { custComm: 0, suppComm: 0, misc: 0, exp: 0, tradeValue: 0, volume: 0 });
              }
              curMo++;
              if (curMo > 12) {
                curMo = 1;
                curYr++;
              }
            }
          }
        }

        const monthKeys = Array.from(monthMap.keys()).sort();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        reportRows = monthKeys.map(mKey => {
          const [yr, mo] = mKey.split('-');
          const mLabel = `${monthNames[parseInt(mo, 10) - 1] || mo} ${yr}`;
          const data = monthMap.get(mKey);

          const custComm = Math.round((data.custComm || 0) * 100) / 100;
          const suppComm = Math.round((data.suppComm || 0) * 100) / 100;
          const totalComm = Math.round((custComm + suppComm) * 100) / 100;
          const misc = Math.round((data.misc || 0) * 100) / 100;
          const exp = Math.round((data.exp || 0) * 100) / 100;
          const totalRev = Math.round((totalComm + misc) * 100) / 100;
          const profit = Math.round((totalRev - exp) * 100) / 100;
          const margin = totalRev > 0 ? Math.round((profit / totalRev) * 1000) / 10 : (exp > 0 ? -100 : 0);

          return {
            monthYear: mLabel,
            customerCommission: custComm,
            supplierCommission: suppComm,
            grossCommission: totalComm,
            miscIncome: misc,
            totalExpenses: exp,
            netProfit: profit,
            profitMargin: `${margin}%`,
            rawMonth: mKey
          };
        });

        // Chart data chronological order with Customer, Supplier, Gross, Expenses and NetProfit
        chartData = reportRows.map(r => ({
          name: r.monthYear,
          CustomerComm: r.customerCommission,
          SupplierComm: r.supplierCommission,
          GrossCommission: r.grossCommission,
          Commission: r.grossCommission,
          Expenses: r.totalExpenses,
          NetProfit: r.netProfit
        }));

        const grandCustComm = Math.round(reportRows.reduce((s, r) => s + r.customerCommission, 0) * 100) / 100;
        const grandSuppComm = Math.round(reportRows.reduce((s, r) => s + r.supplierCommission, 0) * 100) / 100;
        const grandComm = Math.round(reportRows.reduce((s, r) => s + r.grossCommission, 0) * 100) / 100;
        const grandMisc = Math.round(reportRows.reduce((s, r) => s + r.miscIncome, 0) * 100) / 100;
        const grandExp = Math.round(reportRows.reduce((s, r) => s + r.totalExpenses, 0) * 100) / 100;
        const grandRev = Math.round((grandComm + grandMisc) * 100) / 100;
        const grandNetProfit = Math.round((grandRev - grandExp) * 100) / 100;
        const grandMargin = grandRev > 0 ? Math.round((grandNetProfit / grandRev) * 1000) / 10 : (grandExp > 0 ? -100 : 0);

        summaryData = {
          totalCustomerCommission: grandCustComm,
          totalSupplierCommission: grandSuppComm,
          totalGrossCommission: grandComm,
          totalMiscIncome: grandMisc,
          totalExpenses: grandExp,
          netProfit: grandNetProfit,
          profitMargin: `${grandMargin}%`
        };

        totalsData = {
          customerCommission: grandCustComm,
          supplierCommission: grandSuppComm,
          grossCommission: grandComm,
          miscIncome: grandMisc,
          totalExpenses: grandExp,
          netProfit: grandNetProfit,
          profitMargin: `${grandMargin}%`
        };
        break;
      }

      // 16. INVENTORY / UNSOLD STOCK REPORT
      case 'inventory': {
        const today = new Date(targetAsOfDate);

        reportRows = allStock.map((st, idx) => {
          const lotSales = allSales.filter(s => s.stockEntryId === (st.id || st._id));
          const soldQty = lotSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
          const unsold = st.remainingQuantity !== undefined ? st.remainingQuantity : Math.max(0, st.quantity - soldQty);

          if (unsold <= 0) return null;

          const arrDate = new Date(st.date);
          const daysInShop = Math.max(0, Math.floor((today - arrDate) / (1000 * 60 * 60 * 24)));
          let risk = 'Normal';
          if (daysInShop >= 4) risk = 'High Risk';
          else if (daysInShop >= 2) risk = 'Caution';

          return {
            lotNo: st.supplierName ? `${st.supplierName.substring(0, 3).toUpperCase()}-${(st.id || st._id).slice(-4)}` : `LOT-${(st.id || st._id).slice(-4)}`,
            commodity: st.productName || 'Produce Lot',
            supplierName: st.supplierName || 'Farmer',
            arrivalDate: st.date,
            daysInShop: `${daysInShop} Days`,
            arrivedQty: st.quantity,
            unsoldQty: unsold,
            riskLevel: risk
          };
        }).filter(Boolean);

        if (riskThreshold === '2+ Days (Caution)') {
          reportRows = reportRows.filter(r => parseInt(r.daysInShop) >= 2);
        } else if (riskThreshold === '4+ Days (High Risk)') {
          reportRows = reportRows.filter(r => parseInt(r.daysInShop) >= 4);
        }

        totalsData = {
          arrivedQty: reportRows.reduce((s, r) => s + r.arrivedQty, 0),
          unsoldQty: reportRows.reduce((s, r) => s + r.unsoldQty, 0)
        };
        break;
      }

      default:
        return res.status(404).json({ error: `Unknown report type: ${reportId}` });
    }

    const reportResponse = {
      reportId,
      rows: reportRows,
      summary: summaryData,
      totals: totalsData,
      chartData: chartData
    };
    res.json(req.user?.role === 'Customer' ? sanitizeCustomerData(reportResponse) : reportResponse);

  } catch (err) {
    console.error(`Error in getReportData for reportId ${req.query.reportId}:`, err);
    res.status(500).json({ error: 'Failed to process report aggregation request.' });
  }
}

