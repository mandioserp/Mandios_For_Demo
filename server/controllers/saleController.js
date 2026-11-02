import { Sale, Product, Customer, Supplier, Ledger, AuditLog, StockEntry, OwnTradingPurchase, OwnTradingSaleRequest, ReturnRecord } from '../models/index.js';
import { calculateCommission, getCommissionCalculationDetails } from '../utils/commissionService.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';
import { sanitizeCustomerSale } from '../utils/customerDataAccess.js';
import { withMongoTransaction } from '../config/db.js';

export async function getSales(req, res) {
  try {
    const tenantQuery = buildTenantQuery(req);
    let salesQuery = tenantQuery;
    if (req.user?.role === 'Customer') {
      const customer = await Customer.findOne(buildTenantQuery(req, { userId: req.user.id }));
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      salesQuery = buildTenantQuery(req, { customerId: customer.id || customer._id });
    } else if (req.user?.role === 'Supplier') {
      const supplier = await Supplier.findOne(buildTenantQuery(req, { userId: req.user.id }));
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      const stockEntries = await StockEntry.find(buildTenantQuery(req, { supplierId: supplier.id || supplier._id }));
      salesQuery = buildTenantQuery(req, {
        stockEntryId: { $in: stockEntries.map(entry => entry.id || entry._id) }
      });
    }
    const sales = await Sale.find(salesQuery);
    res.json(req.user?.role === 'Customer' ? sales.map(sanitizeCustomerSale) : sales);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales history.' });
  }
}

export async function createSaleBatchFromPayload({
  req,
  stockEntryId,
  saleRate,
  date,
  buyers,
  customCommission,
  customCommissionType,
  boliSessionId,
  session,
  idempotencyKey,
  tenantId = getTenantId(req) || 'tenant_default_001',
}) {
  if (!stockEntryId || !date || !buyers || !Array.isArray(buyers) || buyers.length === 0) {
    throw new Error('Please provide stockEntryId, date, and a list of buyers with quantities.');
  }

  const batchRateProvided = saleRate !== undefined && saleRate !== null && saleRate !== '';
  let batchRate = null;
  if (batchRateProvided) {
    batchRate = Number(saleRate);
    if (!Number.isFinite(batchRate) || batchRate <= 0) {
      throw new Error('Please set a valid sale rate.');
    }
  }

  const stockEntry = await StockEntry.findById(stockEntryId, { session });
  if (!stockEntry) {
    throw new Error('Supplier consignment/arrival not found.');
  }
  if (req && !assertTenantOwnership(req, stockEntry)) throw new Error('Supplier consignment/arrival not found.');

  const product = await Product.findById(stockEntry.productId, { session });
  if (!product) {
    throw new Error('Product not found.');
  }
  if (req && !assertTenantOwnership(req, product)) throw new Error('Product not found.');

  const supplier = await Supplier.findById(stockEntry.supplierId, { session });
  if (!supplier) {
    throw new Error('Supplier of this consignment not found.');
  }
  if (req && !assertTenantOwnership(req, supplier)) throw new Error('Supplier of this consignment not found.');

  const isOwnTrading = stockEntry.businessMode === 'Own Trading';
  let ownTradingPurchase = null;
  let ownSaleRequest = null;
  const ownCustomerBalances = new Map();
  if (isOwnTrading) {
    ownTradingPurchase = await OwnTradingPurchase.findById(stockEntry.ownTradingPurchaseId, { session });
    if (!ownTradingPurchase || ownTradingPurchase.status !== 'Posted') throw new Error('Own Trading purchase is not available for sale.');
    if (req && !assertTenantOwnership(req, ownTradingPurchase)) throw new Error('Own Trading purchase not found.');
    const requestKey = String(idempotencyKey || '').trim();
    if (!requestKey) throw new Error('An idempotency key is required for Own Trading sales.');
    const existingRequest = await OwnTradingSaleRequest.findOne({ ...buildTenantQuery(req), idempotencyKey: requestKey }, { session });
    if (existingRequest) {
      if (existingRequest.status !== 'Posted') throw new Error('This Own Trading sale request is still processing.');
      return {
        createdSales: await Sale.find({ ...buildTenantQuery(req), _id: { $in: existingRequest.saleIds } }, { session }),
        remainingConsignmentQuantity: Number(stockEntry.remainingQuantity ?? stockEntry.quantity),
        duplicate: true,
      };
    }
    ownSaleRequest = await OwnTradingSaleRequest.create({
      tenantId, idempotencyKey: requestKey,
      purchaseId: ownTradingPurchase.id || ownTradingPurchase._id,
      stockEntryId: stockEntry.id || stockEntry._id,
      status: 'Processing',
    }, { session });
  }

  let totalQtyRequested = 0;
  const distinctRates = new Set();
  let finalProductSaleRate = batchRate;

  for (const buyer of buyers) {
    const q = Number(buyer.quantity);
    if (!Number.isFinite(q) || q <= 0) {
      throw new Error('Quantity for each buyer must be a positive number.');
    }

    const buyerRateProvided = buyer.saleRate !== undefined && buyer.saleRate !== null && buyer.saleRate !== '';
    if (!batchRateProvided && !buyerRateProvided) {
      throw new Error('Please provide a sale rate for each buyer, or set a batch-wide sale rate.');
    }

    if (buyerRateProvided) {
      const br = Number(buyer.saleRate);
      if (!Number.isFinite(br) || br <= 0) {
        throw new Error('Please provide a valid sale rate for each buyer.');
      }
      distinctRates.add(br);
      finalProductSaleRate = br;
    } else {
      distinctRates.add(batchRate);
      finalProductSaleRate = batchRate;
    }

    const discount = Number(buyer.discount ?? 0);
    const rate = buyerRateProvided ? Number(buyer.saleRate) : batchRate;
    if (!Number.isFinite(discount) || discount < 0 || discount > q * rate) {
      throw new Error('Discount must be a non-negative amount no greater than the sale value.');
    }
    totalQtyRequested += q;
  }

  const currentRemaining = stockEntry.remainingQuantity !== undefined ? stockEntry.remainingQuantity : stockEntry.quantity;
  if (currentRemaining < totalQtyRequested) {
    throw new Error(`Insufficient consignment stock! Only ${currentRemaining} ${product.unit} remaining in this consignment. Requested: ${totalQtyRequested}`);
  }

  if (product.currentQuantity < totalQtyRequested) {
    throw new Error(`Insufficient physical stock in inventory! Only ${product.currentQuantity} ${product.unit} of ${product.name} left. Requested: ${totalQtyRequested}`);
  }

  const updatedProduct = await Product.findOneAndUpdate(
    {
      _id: product.id || product._id,
      tenantId,
      currentQuantity: { $gte: totalQtyRequested },
    },
    {
      $inc: { currentQuantity: -totalQtyRequested },
      $set: { saleRate: finalProductSaleRate },
    },
    { session }
  );
  if (!updatedProduct) {
    throw new Error(`Insufficient physical stock in inventory! Available stock changed before this sale could be recorded.`);
  }

  const createdSales = [];
  let totalGrossBatchAmount = 0;
  let totalSupplierCreditAmount = 0;
  let lastRateUsed = batchRate;

  for (const buyer of buyers) {
    const qty = Number(buyer.quantity);
    const discount = Number(buyer.discount) || 0;
    const buyerRateProvided = buyer.saleRate !== undefined && buyer.saleRate !== null && buyer.saleRate !== '';
    const rate = buyerRateProvided ? Number(buyer.saleRate) : batchRate;
    lastRateUsed = rate;
    const grossSaleVal = Math.round((qty * rate + Number.EPSILON) * 100) / 100;

    const commDetails = isOwnTrading ? {
      commissionAmount: 0,
      commissionType: 'None',
      formattedRate: '0',
      commissionRateValue: 0,
      commissionBasis: 'Own Trading',
    } : await getCommissionCalculationDetails({
      productId: product.id || product._id,
      supplierId: stockEntry.supplierId,
      customerId: buyer.customerId,
      quantity: qty,
      unit: product.unit,
      weight: product.averageWeight,
      saleRate: rate,
      customCommission,
      customCommissionType,
      tenantId,
    });

    const totalCommission = commDetails.commissionAmount;
    const saleAmount = Math.round((grossSaleVal + totalCommission - discount + Number.EPSILON) * 100) / 100;
    const netSaleVal = saleAmount;
    const supplierCreditAmount = grossSaleVal;

    totalGrossBatchAmount += grossSaleVal;
    totalSupplierCreditAmount += supplierCreditAmount;

    const saleData = {
      tenantId,
      productId: product.id || product._id,
      productName: product.name,
      stockEntryId: stockEntry.id || stockEntry._id,
      boliSessionId: boliSessionId || undefined,
      quantity: qty,
      saleRate: rate,
      discount,
      totalAmount: saleAmount,
      date,
      isWalkIn: !!buyer.isWalkIn,
      businessMode: isOwnTrading ? 'Own Trading' : 'Commission Business',
      ownTradingPurchaseId: isOwnTrading ? (ownTradingPurchase.id || ownTradingPurchase._id) : undefined,
      costOfGoodsSold: isOwnTrading ? Math.round(qty * Number(stockEntry.purchaseRate || 0) * 100) / 100 : 0,
      commissionAmount: totalCommission,
      commissionType: commDetails.commissionType,
      commissionRate: commDetails.formattedRate,
      commissionRateValue: commDetails.commissionRateValue,
      commissionBasis: commDetails.commissionBasis,
      grossSale: grossSaleVal,
      netSale: netSaleVal,
    };

    if (buyer.isWalkIn) {
      saleData.customerName = buyer.walkInName || 'Walk-In Customer';
      saleData.walkInName = buyer.walkInName || 'Walk-In Customer';
      saleData.walkInMobile = buyer.walkInMobile || '';
      saleData.walkInVehicle = buyer.walkInVehicle || '';
      saleData.remarks = buyer.remarks || '';
    } else {
      const customer = await Customer.findById(buyer.customerId, { session });
      if (!customer) {
        throw new Error(`Customer not found for ID: ${buyer.customerId}`);
      }
      if (req && !assertTenantOwnership(req, customer)) throw new Error('Customer not found.');
      saleData.customerId = customer.id || customer._id;
      saleData.customerName = customer.name;

      const newCustBalance = customer.currentBalance + saleAmount;
      await Customer.findByIdAndUpdate(customer.id || customer._id, {
        totalPurchases: customer.totalPurchases + saleAmount,
        currentBalance: newCustBalance,
        remainingBalance: newCustBalance,
      }, { session });

      await Ledger.create({
        tenantId,
        partyId: customer.id || customer._id,
        partyType: 'Customer',
        date,
        type: 'Debit',
        amount: saleAmount,
        balanceAfter: newCustBalance,
        description: `Purchased ${qty} ${product.unit} of ${product.name} @ Rs. ${rate}. Buyer Commission: Rs. ${totalCommission}, Discount: Rs. ${discount} (Arrival Ref: ${stockEntry.id || stockEntry._id})`,
      }, { session });

      if (isOwnTrading) {
        const balanceKey = `${stockEntry.id || stockEntry._id}:${customer.id || customer._id}`;
        const balance = ownCustomerBalances.get(balanceKey) || (ownTradingPurchase.customerBalances || []).find(row =>
          String(row.stockEntryId) === String(stockEntry.id || stockEntry._id) && String(row.customerId) === String(customer.id || customer._id)
        ) || {
          customerId: customer.id || customer._id,
          customerName: customer.name,
          stockEntryId: stockEntry.id || stockEntry._id,
          salesAmount: 0,
          recoveredAmount: 0,
          returnCredits: 0,
          outstandingReceivable: 0,
        };
        balance.salesAmount = Math.round((Number(balance.salesAmount || 0) + saleAmount) * 100) / 100;
        balance.outstandingReceivable = Math.round((Number(balance.outstandingReceivable || 0) + saleAmount) * 100) / 100;
        ownCustomerBalances.set(balanceKey, balance);
      }
    }

    const sale = await Sale.create(saleData, { session });
    createdSales.push(sale);

  }

  const totalBatchAmount = totalSupplierCreditAmount;
  const updatedRemaining = currentRemaining - totalQtyRequested;
  const updatedTotalAmount = (stockEntry.totalAmount || 0) + totalBatchAmount;
  const weightedBatchRate = totalQtyRequested > 0
    ? (totalGrossBatchAmount / totalQtyRequested)
    : (batchRate || lastRateUsed || 0);
  const updatedPurchaseRate = stockEntry.quantity > 0
    ? Math.round((updatedTotalAmount / stockEntry.quantity) * 100) / 100
    : weightedBatchRate;

  await StockEntry.findByIdAndUpdate(stockEntry.id || stockEntry._id, isOwnTrading ? {
    remainingQuantity: updatedRemaining,
  } : {
    remainingQuantity: updatedRemaining,
    totalAmount: updatedTotalAmount,
    purchaseRate: updatedPurchaseRate,
  }, { session });

  if (isOwnTrading && ownCustomerBalances.size > 0) {
    const updatedBalances = [...(ownTradingPurchase.customerBalances || [])];
    for (const balance of ownCustomerBalances.values()) {
      const idx = updatedBalances.findIndex(row => String(row.stockEntryId) === String(balance.stockEntryId) && String(row.customerId) === String(balance.customerId));
      if (idx >= 0) updatedBalances[idx] = balance;
      else updatedBalances.push(balance);
    }
    await OwnTradingPurchase.findByIdAndUpdate(ownTradingPurchase.id || ownTradingPurchase._id, { customerBalances: updatedBalances }, { session });
  }

  if (isOwnTrading && ownSaleRequest) {
    await OwnTradingSaleRequest.findByIdAndUpdate(ownSaleRequest.id || ownSaleRequest._id, {
      saleIds: createdSales.map(sale => String(sale.id || sale._id)), status: 'Posted',
    }, { session });
  }

  const rateDescription = distinctRates.size === 1
    ? `at rate Rs. ${[...distinctRates][0]}`
    : 'at buyer-specific rates';

  const actor = req?.user;
  await AuditLog.create({
    tenantId,
    userId: actor?.id || actor?._id || 'system',
    userName: actor?.name || 'System',
    userRole: actor?.role || 'Clerk',
    action: 'ADD_BATCH_SALE',
    details: `${isOwnTrading ? 'Own Trading' : 'Commission'} sale: ${totalQtyRequested} ${product.unit} of ${product.name} from lot #${stockEntry.lotNumber || String(stockEntry.id || stockEntry._id).substring(0, 8).toUpperCase()} (Supplier: ${supplier.name}) ${rateDescription} to ${buyers.length} buyers. Total Realization: Rs. ${totalBatchAmount}. Remaining: ${updatedRemaining} ${product.unit}.`,
    timestamp: new Date().toISOString(),
  }, { session });

  return {
    createdSales,
    remainingConsignmentQuantity: updatedRemaining,
    totalBatchAmount,
  };
}

export async function addSale(req, res) {
  try {
    const { stockEntryId, saleRate, date, buyers, customCommission, customCommissionType, boliSessionId, idempotencyKey } = req.body;
    const tenantId = getTenantId(req) || 'tenant_default_001';

    try {
      const payload = {
        req,
        stockEntryId,
        saleRate,
        date,
        buyers,
        customCommission,
        customCommissionType,
        boliSessionId,
        tenantId,
        idempotencyKey,
      };
      const stockEntry = await StockEntry.findById(stockEntryId);
      if (!stockEntry || !assertTenantOwnership(req, stockEntry)) return res.status(404).json({ error: 'Supplier consignment/arrival not found.' });
      const result = stockEntry.businessMode === 'Own Trading'
        ? await withMongoTransaction(session => createSaleBatchFromPayload({ ...payload, session }))
        : await createSaleBatchFromPayload(payload);

      return res.status(201).json({
        success: true,
        sales: result.createdSales,
        remainingConsignmentQuantity: result.remainingConsignmentQuantity,
        duplicate: result.duplicate === true,
      });
    } catch (err) {
      if (err?.code === 11000 && idempotencyKey) {
        const existing = await OwnTradingSaleRequest.findOne({ ...buildTenantQuery(req), idempotencyKey });
        if (existing?.status === 'Posted') {
          const sales = await Sale.find({ ...buildTenantQuery(req), _id: { $in: existing.saleIds } });
          const stock = await StockEntry.findById(existing.stockEntryId);
          return res.status(200).json({ success: true, duplicate: true, sales, remainingConsignmentQuantity: Number(stock?.remainingQuantity ?? 0) });
        }
      }
      return res.status(400).json({ error: err.message || 'Failed to record batch sale.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record batch sale.' });
  }
}

export async function updateSale(req, res) {
  // To keep simplicity and high consistency, we advise users to delete and recreate the batch sale if there are major mistakes.
  // We will provide a clean response.
  res.status(400).json({
    error: 'Direct editing of consignment sales is disabled to preserve ledger consistency. Please delete the sale and record a new one.'
  });
}

export async function deleteSale(req, res) {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ error: 'Sale record not found.' });
    }
    if (!assertTenantOwnership(req, sale)) return res.status(404).json({ error: 'Sale record not found.' });

    const tenantId = getTenantId(req) || sale.tenantId || 'tenant_default_001';
    const { productId, customerId, quantity, totalAmount, productName, customerName, stockEntryId, saleRate } = sale;
    const linkedStock = stockEntryId ? await StockEntry.findById(stockEntryId) : null;
    if (linkedStock && !assertTenantOwnership(req, linkedStock)) return res.status(404).json({ error: 'Sale record not found.' });
    const isOwnTrading = sale.businessMode === 'Own Trading' || linkedStock?.businessMode === 'Own Trading';
    if (isOwnTrading) {
      const linkedReturns = await ReturnRecord.find({ ...buildTenantQuery(req), saleId: id, isDeleted: { $ne: true } });
      if (linkedReturns.length) return res.status(409).json({ error: 'This Own Trading sale has return records and cannot be deleted.' });
      if (sale.ownTradingPurchaseId && customerId) {
        const purchase = await OwnTradingPurchase.findById(sale.ownTradingPurchaseId);
        const balance = (purchase?.customerBalances || []).find(row => String(row.stockEntryId) === String(stockEntryId) && String(row.customerId) === String(customerId));
        if (Number(balance?.recoveredAmount) > 0) {
          return res.status(409).json({ error: 'This Own Trading sale has customer recoveries. Reverse the linked payment before deleting the sale.' });
        }
      }
    }

    // 1. Revert product inventory (increase stock back)
    const product = await Product.findById(productId);
    if (product && !assertTenantOwnership(req, product)) return res.status(404).json({ error: 'Sale record not found.' });
    if (product) {
      await Product.findByIdAndUpdate(productId, {
        currentQuantity: product.currentQuantity + quantity,
      });
    }

    // 2. Revert customer balance
    const customer = await Customer.findById(customerId);
    if (customer && !assertTenantOwnership(req, customer)) return res.status(404).json({ error: 'Sale record not found.' });
    if (customer) {
      const revertedCustBalance = customer.currentBalance - totalAmount;
      await Customer.findByIdAndUpdate(customerId, {
        totalPurchases: Math.max(0, customer.totalPurchases - totalAmount),
        currentBalance: revertedCustBalance,
        remainingBalance: revertedCustBalance,
      });

      // Add Credit reversal entry in customer ledger
      await Ledger.create({
        tenantId,
        partyId: customerId,
        partyType: 'Customer',
        date: new Date().toISOString().split('T')[0],
        type: 'Credit',
        amount: totalAmount,
        balanceAfter: revertedCustBalance,
        description: `DELETED SALE REVERSAL: Cancelled purchase of ${quantity} units of ${productName}`,
      });
    }

    // 3. Revert Stock Entry (Consignment)
    if (stockEntryId) {
      const stockEntry = linkedStock;
      if (stockEntry) {
        const revertQty = quantity;
        const revertAmt = quantity * saleRate;

        const newRemaining = (stockEntry.remainingQuantity || 0) + revertQty;
        const newTotalAmount = Math.max(0, (stockEntry.totalAmount || 0) - revertAmt);
        const newPurchaseRate = stockEntry.quantity > 0 ? Math.round((newTotalAmount / stockEntry.quantity) * 100) / 100 : 0;

        await StockEntry.findByIdAndUpdate(stockEntryId, isOwnTrading ? { remainingQuantity: newRemaining } : {
          remainingQuantity: newRemaining,
          totalAmount: newTotalAmount,
          purchaseRate: newPurchaseRate,
        });

        if (isOwnTrading && sale.ownTradingPurchaseId && customerId) {
          const purchase = await OwnTradingPurchase.findById(sale.ownTradingPurchaseId);
          if (purchase && assertTenantOwnership(req, purchase)) {
            const balances = (purchase.customerBalances || []).map(balance => {
              if (String(balance.stockEntryId) !== String(stockEntryId) || String(balance.customerId) !== String(customerId)) return balance;
              return {
                ...balance,
                salesAmount: Math.max(0, Number(balance.salesAmount || 0) - Number(totalAmount || 0)),
                outstandingReceivable: Number(balance.outstandingReceivable || 0) - Number(totalAmount || 0),
              };
            });
            await OwnTradingPurchase.findByIdAndUpdate(purchase.id || purchase._id, { customerBalances: balances });
          }
        }

        // If the lot was already settled into payables previously, adjust the supplier balance and post reversal
        if (stockEntry.isSettled && stockEntry.supplierId) {
          const supplier = await Supplier.findById(stockEntry.supplierId);
          if (supplier) {
            if (!assertTenantOwnership(req, supplier)) return res.status(404).json({ error: 'Sale record not found.' });
            const revertedSuppBalance = (supplier.currentBalance || 0) + revertAmt;
            const revertedTotalSupplied = Math.max(0, (supplier.totalSupplied || 0) - revertAmt);
            await Supplier.findByIdAndUpdate(stockEntry.supplierId, {
              currentBalance: revertedSuppBalance,
              remainingBalance: revertedSuppBalance,
              totalSupplied: revertedTotalSupplied,
            });

            await Ledger.create({
              tenantId,
              partyId: stockEntry.supplierId,
              partyType: 'Supplier',
              date: new Date().toISOString().split('T')[0],
              type: 'Debit',
              amount: revertAmt,
              balanceAfter: revertedSuppBalance,
              description: `DELETED SALE REVERSAL: Cancelled batch sale of ${quantity} ${productName || 'units'} @ Rs. ${saleRate} from settled lot #${stockEntry.lotNumber || ''} (Buyer: ${customerName || 'Customer'})`,
            });
          }
        }
      }
    }

    await Sale.findByIdAndDelete(id);

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_SALE',
      details: `Deleted Sale Entry ${id}. Reverted ${quantity} units of ${productName} from customer ${customerName}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Sale record deleted and inventory/balances adjusted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete sale.' });
  }
}
