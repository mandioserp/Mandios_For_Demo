import { ReturnRecord, Sale, Customer, Supplier, Product, StockEntry, Ledger, AuditLog, Business, OwnTradingPurchase } from '../models/index.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';
import { sanitizeCustomerData } from '../utils/customerDataAccess.js';

// Helper to compute customer crate statistics
async function computeCustomerCrateStats(tenantQuery) {
  const [sales, returns, customers, stockEntries] = await Promise.all([
    Sale.find(tenantQuery),
    ReturnRecord.find(tenantQuery),
    Customer.find(tenantQuery),
    StockEntry.find(tenantQuery)
  ]);

  // Build a set of settled stockEntry IDs (Lots recorded to Payables & Supply Value)
  const settledStockIds = new Set(
    stockEntries
      .filter(s => s.isSettled)
      .map(s => String(s.id || s._id))
  );

  const customerMap = {};
  for (const c of customers) {
    if (c.isDeleted) continue;
    const cId = String(c.id || c._id);
    customerMap[cId] = {
      customerId: cId,
      customerName: c.name,
      phone: c.phone || '',
      referenceBy: c.referenceBy || '',
      cratesGiven: 0,
      cratesReturned: 0,
      goodCratesReturned: 0,
      damagedCrates: 0,
      cratesWithCustomer: 0,
      history: []
    };
  }

  // Crates Given from Sales (Exclude sales from settled lots)
  for (const s of sales) {
    if (s.isDeleted || !s.customerId) continue;
    
    // If the sale belongs to a consignment lot that has been recorded to Payables & Supply Value, exclude it
    if (s.stockEntryId && settledStockIds.has(String(s.stockEntryId))) {
      continue;
    }

    const cId = String(s.customerId);
    if (!customerMap[cId]) {
      customerMap[cId] = {
        customerId: cId,
        customerName: s.customerName || 'Customer',
        phone: '',
        referenceBy: '',
        cratesGiven: 0,
        cratesReturned: 0,
        goodCratesReturned: 0,
        damagedCrates: 0,
        cratesWithCustomer: 0,
        history: []
      };
    }
    const qty = Number(s.quantity) || 0;
    customerMap[cId].cratesGiven += qty;
    customerMap[cId].history.push({
      date: s.date,
      type: 'Given (Sale)',
      cratesGiven: qty,
      goodCratesReturned: 0,
      damagedCrates: 0,
      productName: s.productName || '',
      reference: `Sale #${s.id || s._id}`
    });
  }

  // Crates Returned from Approved/Waiting ReturnRecords
  for (const r of returns) {
    if (r.isDeleted || !r.customerId) continue;

    // If return was attached to a settled lot, exclude from current active crate balance calculation
    if (r.stockEntryId && settledStockIds.has(String(r.stockEntryId))) {
      continue;
    }

    // Only Approved returns officially deduct the balance from history, but let's record history
    const cId = String(r.customerId);
    if (!customerMap[cId]) {
      customerMap[cId] = {
        customerId: cId,
        customerName: r.customerName || 'Customer',
        phone: '',
        referenceBy: '',
        cratesGiven: 0,
        cratesReturned: 0,
        goodCratesReturned: 0,
        damagedCrates: 0,
        cratesWithCustomer: 0,
        history: []
      };
    }
    if (r.status === 'Approved') {
      const good = Number(r.goodCratesReturned) || 0;
      const damaged = Number(r.damagedCratesReturned) || 0;
      customerMap[cId].goodCratesReturned += good;
      customerMap[cId].damagedCrates += damaged;
      customerMap[cId].cratesReturned += (good + damaged);

      customerMap[cId].history.push({
        date: r.date,
        type: 'Return (Approved)',
        cratesGiven: 0,
        goodCratesReturned: good,
        damagedCrates: damaged,
        productName: r.productName || 'Crates Return',
        reference: `Return #${r.returnNumber}`
      });
    }
  }

  // Calculate balance for each customer
  const result = Object.values(customerMap).map(c => {
    c.cratesWithCustomer = Math.max(0, c.cratesGiven - c.cratesReturned);
    // Sort history by date descending
    c.history.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    // Calculate running balance in history (oldest to newest first, then reverse)
    const ascHist = [...c.history].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    let runningBal = 0;
    ascHist.forEach(item => {
      runningBal = runningBal + item.cratesGiven - (item.goodCratesReturned + item.damagedCrates);
      item.balance = runningBal;
    });
    c.history = ascHist.reverse();
    return c;
  });

  return result;
}

// 1. Get All Returns
export async function getReturns(req, res) {
  try {
    const tenantQuery = buildTenantQuery(req);
    let returns;
    if (req.user?.role === 'Customer') {
      const customer = await Customer.findOne(buildTenantQuery(req, { userId: req.user.id }));
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      returns = await ReturnRecord.find({ ...tenantQuery, customerId: String(customer.id || customer._id) });
    } else {
      returns = await ReturnRecord.find(tenantQuery);
    }
    // Sort by createdAt / date descending
    returns.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    res.json(req.user?.role === 'Customer' ? sanitizeCustomerData(returns) : returns);
  } catch (err) {
    console.error('getReturns error:', err);
    res.status(500).json({ error: 'Failed to fetch returns history.' });
  }
}

// 2. Get Single Return by ID
export async function getReturnById(req, res) {
  try {
    const { id } = req.params;
    const ret = await ReturnRecord.findById(id);
    if (!ret) {
      return res.status(404).json({ error: 'Return record not found.' });
    }
    if (!assertTenantOwnership(req, ret)) return res.status(404).json({ error: 'Return record not found.' });
    if (req.user?.role === 'Customer') {
      const customer = await Customer.findOne(buildTenantQuery(req, { userId: req.user.id }));
      if (!customer || String(ret.customerId) !== String(customer.id || customer._id)) {
        return res.status(404).json({ error: 'Return record not found.' });
      }
      return res.json(sanitizeCustomerData(ret));
    }
    res.json(ret);
  } catch (err) {
    console.error('getReturnById error:', err);
    res.status(500).json({ error: 'Failed to fetch return record.' });
  }
}

// 3. Create a Return (Draft or Waiting Approval)
export async function createReturn(req, res) {
  try {
    const tenantId = getTenantId(req) || 'tenant_default_001';
    const {
      date,
      customerId,
      saleId,
      produceReturnedQty = 0,
      produceCondition = 'Good',
      reason = '',
      notes = '',
      status = 'Waiting Approval' // 'Draft' or 'Waiting Approval'
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Please select a customer.' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    if (!assertTenantOwnership(req, customer)) return res.status(404).json({ error: 'Customer not found.' });

    if (!saleId) {
      return res.status(400).json({ error: 'Please select an original sale for produce return.' });
    }

    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ error: 'Original sale record not found.' });
    }
    if (!assertTenantOwnership(req, sale)) return res.status(404).json({ error: 'Original sale record not found.' });

    let product = null;
    let stockEntry = null;
    const qtySold = Number(sale.quantity) || 0;
    const saleRate = Number(sale.saleRate) || 0;
    let unit = 'Crate';

    // Check existing returns for this sale
    const pastReturns = await ReturnRecord.find({
      saleId: sale.id || sale._id,
      status: { $in: ['Approved', 'Waiting Approval'] },
      isDeleted: false
    });
    const qtyAlreadyReturned = pastReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);

    const maxCanReturn = Math.max(0, qtySold - qtyAlreadyReturned);
    const produceQtyNum = Number(produceReturnedQty) || 0;

    if (produceQtyNum <= 0) {
      return res.status(400).json({ error: 'Quantity now returned must be greater than zero.' });
    }

    if (produceQtyNum > maxCanReturn) {
      return res.status(400).json({
        error: `Quantity cannot be greater than the quantity sold. Maximum returnable is ${maxCanReturn}.`
      });
    }

    const grossReturnAmount = Math.round(produceQtyNum * saleRate * 100) / 100;
    
    // Calculate pro-rata commission reversal for returned produce/crates
    let commissionReversedAmount = 0;
    const saleCommAmount = Number(sale.commissionAmount) || 0;
    if (qtySold > 0 && saleCommAmount > 0) {
      const commPerUnit = saleCommAmount / qtySold;
      commissionReversedAmount = Math.round(produceQtyNum * commPerUnit * 100) / 100;
    }
    
    // Total amount to credit customer (Gross Value + Commission that was charged on these units)
    const returnAmount = Math.round((grossReturnAmount + commissionReversedAmount) * 100) / 100;

    if (sale.productId) {
      product = await Product.findById(sale.productId);
      if (product && !assertTenantOwnership(req, product)) return res.status(404).json({ error: 'Original sale record not found.' });
      if (product) {
        unit = product.unit || 'Crate';
      }
    }

    // Validation: Block produce returns if product, sale, or lot status is 'Submitted for Approval', 'Approved', or 'Accepted'
    const blockedStatuses = ['submitted for approval', 'approved', 'accepted', 'submitted_for_approval'];
    const productStatus = (product?.status || product?.approvalStatus || '').trim().toLowerCase();
    const saleStatus = (sale?.status || sale?.approvalStatus || '').trim().toLowerCase();
    
    if (blockedStatuses.includes(productStatus)) {
      return res.status(400).json({
        error: `Produce cannot be returned because product '${product?.name || 'Produce'}' status is '${product?.status || product?.approvalStatus}'. Products with status 'Submitted for Approval', 'Approved', or 'Accepted' are not allowed to be returned.`
      });
    }

    if (blockedStatuses.includes(saleStatus) && saleStatus !== 'approved' && saleStatus !== 'accepted') {
      return res.status(400).json({
        error: `Produce cannot be returned because sale status is '${sale?.status || sale?.approvalStatus}'.`
      });
    }

    if (sale.stockEntryId) {
      stockEntry = await StockEntry.findById(sale.stockEntryId);
      if (stockEntry && !assertTenantOwnership(req, stockEntry)) return res.status(404).json({ error: 'Original sale record not found.' });
      if (stockEntry) {
        const stockStatus = (stockEntry.status || stockEntry.approvalStatus || '').trim().toLowerCase();
        if (blockedStatuses.includes(stockStatus) && stockStatus !== 'approved' && stockStatus !== 'accepted') {
          return res.status(400).json({
            error: `Produce cannot be returned because consignment lot status is '${stockEntry.status || stockEntry.approvalStatus}'.`
          });
        }
        if (stockEntry.isSettled) {
          return res.status(400).json({
            error: `Cannot return produce from Lot #${stockEntry.lotNumber || String(stockEntry.id || stockEntry._id).substring(0,8).toUpperCase()}. This consignment lot has already been recorded to Payables & Supply Value.`
          });
        }
      }
    }

    // Generate Return Number (RET-XXXX)
    const totalCount = await ReturnRecord.countDocuments({ tenantId }) || 0;
    const returnNumber = `RET-${String(totalCount + 1001).padStart(4, '0')}`;

    const newReturn = await ReturnRecord.create({
      tenantId,
      returnNumber,
      returnType: 'Produce',
      date: date || new Date().toISOString().split('T')[0],
      status: status === 'Draft' ? 'Draft' : 'Waiting Approval',
      customerId: customer.id || customer._id,
      customerName: customer.name,
      saleId: sale.id || sale._id,
      stockEntryId: sale.stockEntryId || null,
      productId: sale.productId || null,
      productName: sale.productName || (product?.name) || '',
      unit,
      saleRate,
      quantitySold: qtySold,
      quantityAlreadyReturned: qtyAlreadyReturned,
      produceReturnedQty: produceQtyNum,
      produceCondition: ['Good', 'Damaged', 'Spoiled'].includes(produceCondition) ? produceCondition : 'Good',
      businessMode: sale.businessMode || 'Commission Business',
      ownTradingPurchaseId: sale.ownTradingPurchaseId || '',
      wastageCost: sale.businessMode === 'Own Trading' && produceCondition !== 'Good'
        ? Math.round((Number(sale.costOfGoodsSold || 0) / Math.max(1, qtySold)) * produceQtyNum * 100) / 100
        : 0,
      grossReturnAmount,
      commissionReversedAmount,
      commissionRate: sale?.commissionRate || '',
      returnAmount,
      cratesGiven: 0,
      cratesAlreadyReturned: 0,
      goodCratesReturned: 0,
      damagedCratesReturned: 0,
      totalCratesReturned: 0,
      reason,
      notes,
      recordedBy: req.user?.id || '',
      recordedByName: req.user?.name || req.user?.email || 'Clerk'
    });

    await AuditLog.create({
      tenantId,
      userId: req.user?.id || 'system',
      userName: req.user?.name || 'Operator',
      userRole: req.user?.role || 'Clerk',
      action: 'CREATE_RETURN',
      details: `Created ${status === 'Draft' ? 'Draft' : 'Pending'} Return #${returnNumber} for Customer: ${customer.name} (Amount: Rs. ${returnAmount})`,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: status === 'Draft' ? 'Draft return saved successfully.' : 'Return sent for approval.',
      returnRecord: newReturn
    });
  } catch (err) {
    console.error('createReturn error:', err);
    res.status(500).json({ error: 'Failed to record return.' });
  }
}

// 4. Approve Return (Calculates stock, customer balance, supplier settlement, audit)
export async function approveReturn(req, res) {
  try {
    const { id } = req.params;
    const returnRecord = await ReturnRecord.findById(id);

    if (!returnRecord) {
      return res.status(404).json({ error: 'Return record not found.' });
    }
    if (!assertTenantOwnership(req, returnRecord)) return res.status(404).json({ error: 'Return record not found.' });

    if (returnRecord.status === 'Approved') {
      return res.status(400).json({ error: 'Return has already been approved.' });
    }

    const tenantId = getTenantId(req) || returnRecord.tenantId || 'tenant_default_001';
    const qty = Number(returnRecord.produceReturnedQty) || 0;
    const retAmt = Number(returnRecord.returnAmount) || (qty * (returnRecord.saleRate || 0));

    // 1. UPDATE PRODUCE STOCK & CUSTOMER BALANCE & SUPPLIER SETTLEMENT
    if (qty > 0) {
      // 1a. Update Product Stock (always restock returned produce)
      const ownTradingReturn = returnRecord.businessMode === 'Own Trading';
      const restockReturnedProduce = !ownTradingReturn || (returnRecord.produceCondition || 'Good') === 'Good';
      if (returnRecord.productId && restockReturnedProduce) {
        const product = await Product.findById(returnRecord.productId);
        if (product) {
          if (!assertTenantOwnership(req, product)) return res.status(404).json({ error: 'Return record not found.' });
          await Product.findByIdAndUpdate(product.id || product._id, {
            currentQuantity: product.currentQuantity + qty
          });
        }
      }

      // 1b. Update Customer Balance (Credit customer - they owe us less)
      const customer = await Customer.findById(returnRecord.customerId);
      if (customer) {
        if (!assertTenantOwnership(req, customer)) return res.status(404).json({ error: 'Return record not found.' });
        const newCustBalance = customer.currentBalance - retAmt;
        await Customer.findByIdAndUpdate(customer.id || customer._id, {
          totalPurchases: Math.max(0, customer.totalPurchases - retAmt),
          currentBalance: newCustBalance,
          remainingBalance: newCustBalance
        });

        // Add Credit Ledger Entry for Customer (reversing gross produce value + commission applied on returned crates)
        const commNote = returnRecord.commissionReversedAmount > 0 ? ` (Includes reversed commission: Rs. ${returnRecord.commissionReversedAmount})` : '';
        await Ledger.create({
          tenantId,
          partyId: customer.id || customer._id,
          partyType: 'Customer',
          date: returnRecord.date || new Date().toISOString().split('T')[0],
          type: 'Credit',
          amount: retAmt,
          balanceAfter: newCustBalance,
          description: `PRODUCE RETURN (${returnRecord.returnNumber}): Returned ${qty} ${returnRecord.unit || 'Crates'} of ${returnRecord.productName || 'Produce'}. Gross: Rs. ${returnRecord.grossReturnAmount || (qty * (returnRecord.saleRate || 0))}${commNote}. Reason: ${returnRecord.reason || 'Customer Return'}`
        });
      }

      // 1c. Update Supplier Consignment / StockEntry & Supplier Ledger
      if (returnRecord.stockEntryId) {
        const stockEntry = await StockEntry.findById(returnRecord.stockEntryId);
        if (stockEntry) {
          if (!assertTenantOwnership(req, stockEntry)) return res.status(404).json({ error: 'Return record not found.' });
          const supplierGrossValue = Math.round((returnRecord.grossReturnAmount || (qty * (returnRecord.saleRate || 0))) * 100) / 100;

          // Increase remaining consignment quantity back in that lot so it can be resold
          const initialQty = Number(stockEntry.quantity) || 0;
          const currentRem = stockEntry.remainingQuantity !== undefined ? stockEntry.remainingQuantity : initialQty;
          const newRemaining = restockReturnedProduce ? Math.min(initialQty, currentRem + qty) : currentRem;

          // Update totalAmount on stockEntry (deduct returned produce gross value)
          const newTotalAmount = ownTradingReturn ? Number(stockEntry.totalAmount) || 0 : Math.max(0, Math.round(((stockEntry.totalAmount || 0) - supplierGrossValue) * 100) / 100);
          
          // Recalculate average purchase rate realized
          const netSoldQty = Math.max(0, initialQty - newRemaining);
          const newPurchaseRate = ownTradingReturn ? (Number(stockEntry.purchaseRate) || 0) : (netSoldQty > 0 ? Math.round((newTotalAmount / netSoldQty) * 100) / 100 : (stockEntry.purchaseRate || 0));

          await StockEntry.findByIdAndUpdate(stockEntry.id || stockEntry._id, {
            remainingQuantity: newRemaining,
            totalAmount: newTotalAmount,
            purchaseRate: newPurchaseRate,
            ...(ownTradingReturn && !restockReturnedProduce ? { wastedQuantity: (Number(stockEntry.wastedQuantity) || 0) + qty } : {}),
          });

          if (ownTradingReturn && returnRecord.ownTradingPurchaseId) {
            const purchase = await OwnTradingPurchase.findById(returnRecord.ownTradingPurchaseId);
            if (purchase && assertTenantOwnership(req, purchase)) {
              const customerBalances = (purchase.customerBalances || []).map(balance => {
                if (String(balance.stockEntryId) !== String(returnRecord.stockEntryId) || String(balance.customerId) !== String(returnRecord.customerId)) return balance;
                return {
                  ...balance,
                  returnCredits: Math.round((Number(balance.returnCredits || 0) + retAmt) * 100) / 100,
                  outstandingReceivable: Math.round((Number(balance.outstandingReceivable || 0) - retAmt) * 100) / 100,
                };
              });
              await OwnTradingPurchase.findByIdAndUpdate(purchase.id || purchase._id, { customerBalances });
            }
          }

          // Update Supplier Ledger & Balance (Only if this lot was already finalized and settled into payables)
          if (stockEntry.isSettled && supplierGrossValue > 0 && stockEntry.supplierId) {
            const supplier = await Supplier.findById(stockEntry.supplierId);
            if (supplier) {
              if (!assertTenantOwnership(req, supplier)) return res.status(404).json({ error: 'Return record not found.' });
              const newSupplierBalance = (supplier.currentBalance || 0) + supplierGrossValue;
              const newTotalSupplied = Math.max(0, (supplier.totalSupplied || 0) - supplierGrossValue);

              await Supplier.findByIdAndUpdate(supplier.id || supplier._id, {
                currentBalance: newSupplierBalance,
                remainingBalance: newSupplierBalance,
                totalSupplied: newTotalSupplied
              });

              // Create Debit Ledger entry for Supplier
              await Ledger.create({
                tenantId,
                partyId: supplier.id || supplier._id,
                partyType: 'Supplier',
                date: returnRecord.date || new Date().toISOString().split('T')[0],
                type: 'Debit',
                amount: supplierGrossValue,
                balanceAfter: newSupplierBalance,
                description: `PRODUCE RETURN DEDUCTION (${returnRecord.returnNumber}): Returned ${qty} ${returnRecord.unit || 'Crates'} of ${returnRecord.productName || 'Produce'} by customer ${returnRecord.customerName}. Settled Lot #${stockEntry.lotNumber || String(stockEntry.id || stockEntry._id).substring(0,8).toUpperCase()} payable adjusted. Available quantity restocked to ${newRemaining} crates.`
              });
            }
          }
        }
      }
    }

    // 2. MARK AS APPROVED
    const updated = await ReturnRecord.findByIdAndUpdate(id, {
      status: 'Approved',
      approvedBy: req.user?.id || 'admin',
      approvedByName: req.user?.name || req.user?.email || 'Admin',
      approvedAt: new Date()
    });

    // 3. AUDIT LOG
    await AuditLog.create({
      tenantId,
      userId: req.user?.id || 'admin',
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'Admin',
      action: 'APPROVE_RETURN',
      details: `Approved Return #${returnRecord.returnNumber} for Customer: ${returnRecord.customerName}. Restocked ${returnRecord.produceReturnedQty} units of produce, credit Rs. ${returnRecord.returnAmount}`,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Return approved. Stock and balances updated successfully.',
      returnRecord: updated
    });
  } catch (err) {
    console.error('approveReturn error:', err);
    res.status(500).json({ error: 'Failed to approve return.' });
  }
}

// 5. Reject Return
export async function rejectReturn(req, res) {
  try {
    const { id } = req.params;
    const { rejectionReason = '' } = req.body;

    const returnRecord = await ReturnRecord.findById(id);
    if (!returnRecord) {
      return res.status(404).json({ error: 'Return record not found.' });
    }
    if (!assertTenantOwnership(req, returnRecord)) return res.status(404).json({ error: 'Return record not found.' });

    if (returnRecord.status === 'Approved') {
      return res.status(400).json({ error: 'Cannot reject an already approved return.' });
    }

    const tenantId = getTenantId(req) || returnRecord.tenantId || 'tenant_default_001';

    const updated = await ReturnRecord.findByIdAndUpdate(id, {
      status: 'Rejected',
      rejectionReason: rejectionReason || 'Rejected by Admin',
      rejectedAt: new Date(),
      approvedBy: req.user?.id || '',
      approvedByName: req.user?.name || 'Admin'
    });

    await AuditLog.create({
      tenantId,
      userId: req.user?.id || 'admin',
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'Admin',
      action: 'REJECT_RETURN',
      details: `Rejected Return #${returnRecord.returnNumber}. Reason: ${rejectionReason || 'No reason specified'}`,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Return rejected.',
      returnRecord: updated
    });
  } catch (err) {
    console.error('rejectReturn error:', err);
    res.status(500).json({ error: 'Failed to reject return.' });
  }
}

// 6. Update Draft Return
export async function updateReturn(req, res) {
  try {
    const { id } = req.params;
    const existing = await ReturnRecord.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Return record not found.' });
    }
    if (!assertTenantOwnership(req, existing)) return res.status(404).json({ error: 'Return record not found.' });

    if (existing.status !== 'Draft') {
      return res.status(400).json({ error: 'Only Draft returns can be edited.' });
    }

    const {
      returnType,
      date,
      produceReturnedQty,
      produceCondition,
      goodCratesReturned,
      damagedCratesReturned,
      reason,
      notes,
      status
    } = req.body;

    let saleRate = existing.saleRate || 0;
    let produceQtyNum = produceReturnedQty !== undefined ? Number(produceReturnedQty) : existing.produceReturnedQty;
    let returnAmount = Math.round(produceQtyNum * saleRate * 100) / 100;

    let goodCratesNum = goodCratesReturned !== undefined ? Number(goodCratesReturned) : existing.goodCratesReturned;
    let damagedCratesNum = damagedCratesReturned !== undefined ? Number(damagedCratesReturned) : existing.damagedCratesReturned;
    let totalCratesToday = goodCratesNum + damagedCratesNum;

    const updated = await ReturnRecord.findByIdAndUpdate(id, {
      returnType: returnType || existing.returnType,
      date: date || existing.date,
      produceReturnedQty: produceQtyNum,
      produceCondition: produceCondition || existing.produceCondition,
      returnAmount,
      goodCratesReturned: goodCratesNum,
      damagedCratesReturned: damagedCratesNum,
      totalCratesReturned: totalCratesToday,
      reason: reason !== undefined ? reason : existing.reason,
      notes: notes !== undefined ? notes : existing.notes,
      status: status || existing.status
    });

    res.json({
      success: true,
      message: 'Draft return updated successfully.',
      returnRecord: updated
    });
  } catch (err) {
    console.error('updateReturn error:', err);
    res.status(500).json({ error: 'Failed to update return.' });
  }
}

// 7. Delete Return (Draft or Admin)
export async function deleteReturn(req, res) {
  try {
    const { id } = req.params;
    const existing = await ReturnRecord.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Return record not found.' });
    }
    if (!assertTenantOwnership(req, existing)) return res.status(404).json({ error: 'Return record not found.' });

    if (existing.status === 'Approved') {
      return res.status(400).json({ error: 'Approved returns cannot be deleted directly.' });
    }

    await ReturnRecord.findByIdAndDelete(id);

    const tenantId = getTenantId(req) || existing.tenantId || 'tenant_default_001';
    await AuditLog.create({
      tenantId,
      userId: req.user?.id || 'admin',
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'Admin',
      action: 'DELETE_RETURN',
      details: `Deleted Return #${existing.returnNumber}`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Return deleted successfully.' });
  } catch (err) {
    console.error('deleteReturn error:', err);
    res.status(500).json({ error: 'Failed to delete return.' });
  }
}

// 8. Get Customer Crates Summary and Detail
export async function getCustomerCrates(req, res) {
  try {
    const tenantQuery = buildTenantQuery(req);
    const cratesSummary = await computeCustomerCrateStats(tenantQuery);
    res.json(cratesSummary);
  } catch (err) {
    console.error('getCustomerCrates error:', err);
    res.status(500).json({ error: 'Failed to fetch customer crate balances.' });
  }
}

// 9. Get Customer's Recent Sales (for Easy Sale Selection)
export async function getCustomerRecentSales(req, res) {
  try {
    const { customerId } = req.params;
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required.' });
    }

    const tenantQuery = buildTenantQuery(req);
    if (req.user?.role === 'Customer') {
      const customer = await Customer.findOne(buildTenantQuery(req, { userId: req.user.id }));
      if (!customer || String(customer.id || customer._id) !== String(customerId)) {
        return res.status(404).json({ error: 'Customer not found.' });
      }
    }
    const [sales, returns, stockEntries, products] = await Promise.all([
      Sale.find({ ...tenantQuery, customerId }),
      ReturnRecord.find({ ...tenantQuery, customerId, status: { $in: ['Approved', 'Waiting Approval'] }, isDeleted: false }),
      StockEntry.find(tenantQuery),
      Product.find(tenantQuery)
    ]);

    // Build map for stock and products
    const stockMap = {};
    for (const s of stockEntries) {
      stockMap[String(s.id || s._id)] = s;
    }

    const productMap = {};
    for (const p of products) {
      productMap[String(p.id || p._id)] = p;
    }

    // Compute returned qty per sale
    const returnedMap = {};
    for (const r of returns) {
      if (r.saleId) {
        const sId = String(r.saleId);
        returnedMap[sId] = (returnedMap[sId] || 0) + (Number(r.produceReturnedQty) || 0);
      }
    }

    const blockedStatuses = ['submitted for approval', 'approved', 'accepted', 'submitted_for_approval'];

    // Decorate sales with return metrics
    const result = sales.map(s => {
      const sId = String(s.id || s._id);
      const stock = s.stockEntryId ? stockMap[String(s.stockEntryId)] : null;
      const product = s.productId ? productMap[String(s.productId)] : null;
      const isLotSettled = stock?.isSettled || false;
      
      const productStatus = (product?.status || product?.approvalStatus || '').trim();
      const isProductStatusBlocked = blockedStatuses.includes(productStatus.toLowerCase());

      const alreadyReturned = returnedMap[sId] || 0;
      const rawCanReturn = Math.max(0, (Number(s.quantity) || 0) - alreadyReturned);
      const canReturn = (isLotSettled || isProductStatusBlocked) ? 0 : rawCanReturn;

      return {
        id: sId,
        _id: sId,
        saleNumber: sId.substring(0, 8).toUpperCase(),
        date: s.date,
        productId: s.productId,
        productName: s.productName || product?.name || 'Produce Lot',
        productStatus: productStatus || '',
        isProductStatusBlocked,
        quantitySold: Number(s.quantity) || 0,
        saleRate: Number(s.saleRate) || 0,
        totalAmount: Number(s.totalAmount) || 0,
        cratesGiven: Number(s.quantity) || 0,
        commissionAmount: Number(s.commissionAmount) || 0,
        commissionRate: s.commissionRate || '',
        commissionPerUnit: (Number(s.quantity) > 0 && Number(s.commissionAmount) > 0) ? (Number(s.commissionAmount) / Number(s.quantity)) : 0,
        alreadyReturned,
        canReturn,
        stockEntryId: s.stockEntryId,
        isLotSettled,
        lotNumber: stock?.lotNumber || (s.stockEntryId ? String(s.stockEntryId).substring(0, 8).toUpperCase() : '')
      };
    });

    // Sort newest sale first
    result.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    res.json(req.user?.role === 'Customer' ? sanitizeCustomerData(result) : result);
  } catch (err) {
    console.error('getCustomerRecentSales error:', err);
    res.status(500).json({ error: 'Failed to fetch customer sales.' });
  }
}
