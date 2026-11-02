import { OwnTradingPurchase, StockEntry, Product, Supplier, Sale, ReturnRecord, Ledger, Payment, AuditLog } from '../models/index.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';
import { withMongoTransaction } from '../config/db.js';
import { normalizeOwnTradingPurchase } from '../utils/ownTrading.js';
import { prepareOwnTradingEdit } from '../utils/ownTradingEdit.js';

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export async function updateOwnTradingPurchase(req, res) {
  try {
    const updated = await withMongoTransaction(async session => {
      const query = buildTenantQuery(req, { _id: req.params.id });
      const purchase = await OwnTradingPurchase.findOne(query, { session });
      if (!purchase) { const error = new Error('Own Trading purchase not found.'); error.status = 404; throw error; }
      const lotIds = purchase.items.map(item => item.lotId);
      const [lots, sales, returns] = await Promise.all([
        StockEntry.find(buildTenantQuery(req, { ownTradingPurchaseId: req.params.id }), { session }),
        Sale.find(buildTenantQuery(req, { stockEntryId: { $in: lotIds }, isDeleted: { $ne: true } }), { session }),
        ReturnRecord.find(buildTenantQuery(req, { stockEntryId: { $in: lotIds }, isDeleted: { $ne: true } }), { session }),
      ]);
      const next = prepareOwnTradingEdit(purchase, req.body || {}, { lots, sales, returns });
      const locked = await OwnTradingPurchase.findOneAndUpdate({ ...query, status: 'Posted', updatedAt: purchase.updatedAt }, { $set: next }, { session });
      if (!locked) { const error = new Error('Purchase changed. Reopen it before saving.'); error.status = 409; throw error; }
      for (const item of next.items) {
        const old = purchase.items.find(row => row.lotId === item.lotId);
        const lot = lots.find(row => String(row.id || row._id) === String(item.lotId));
        if (!lot) throw new Error('Linked stock lot not found.');
        const quantityDelta = item.quantity - old.quantity;
        await StockEntry.findOneAndUpdate(buildTenantQuery(req, { _id: item.lotId }), { $set: {
          quantity: item.quantity, remainingQuantity: Number(lot.remainingQuantity) + quantityDelta,
          purchaseRate: item.landedUnitCost, totalAmount: item.landedCost,
          purchaseCost: item.lineAmount, allocatedPurchaseExpenses: item.allocatedExpenses,
          landedCostTotal: item.landedCost, netPayable: item.lineAmount,
          sourceMandi: next.sourceMandi, vehicleNumber: next.truckNumber,
        } }, { session });
        if (quantityDelta) {
          const product = await Product.findOneAndUpdate(buildTenantQuery(req, { _id: item.productId }), { $inc: { currentQuantity: quantityDelta } }, { session });
          if (!product) throw new Error('Purchase product not found.');
        }
      }
      for (const balance of next.supplierBalances) {
        const old = purchase.supplierBalances.find(row => row.supplierId === balance.supplierId);
        const delta = roundMoney(balance.purchaseAmount - old.purchaseAmount);
        if (!delta) continue;
        const supplier = await Supplier.findOneAndUpdate(buildTenantQuery(req, { _id: balance.supplierId }), {
          $inc: { currentBalance: -delta, remainingBalance: -delta, totalSupplied: delta },
        }, { session });
        if (!supplier) throw new Error('Purchase supplier not found.');
        await Ledger.create({
          tenantId: purchase.tenantId, partyId: balance.supplierId, partyType: 'Supplier',
          date: new Date().toISOString().slice(0, 10), type: delta > 0 ? 'Credit' : 'Debit',
          amount: Math.abs(delta), balanceAfter: supplier.currentBalance,
          description: `OWN TRADING PURCHASE ADJUSTMENT ${purchase.purchaseReference}: Purchase amount corrected.`,
        }, { session });
      }
      await AuditLog.create({ tenantId: purchase.tenantId, userId: req.user?.id || '', userName: req.user?.name || '', userRole: req.user?.role,
        action: 'EDIT_OWN_TRADING_PURCHASE', details: `Updated ${purchase.purchaseReference}; merchandise ${purchase.purchaseValue} → ${next.purchaseValue}, expenses ${purchase.expenseTotal} → ${next.expenseTotal}.`, timestamp: new Date().toISOString() }, { session });
      return locked;
    });
    res.json({ success: true, purchase: updated });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to update Own Trading purchase.' });
  }
}

export async function getOwnTradingPurchases(req, res) {
  try {
    res.json(await OwnTradingPurchase.find(buildTenantQuery(req)));
  } catch (error) {
    console.error('getOwnTradingPurchases error:', error);
    res.status(500).json({ error: 'Failed to fetch Own Trading purchases.' });
  }
}

export async function createOwnTradingPurchase(req, res) {
  let purchase;
  let validatingRequest = true;
  try {
    const tenantId = getTenantId(req) || 'tenant_default_001';
    const normalized = normalizeOwnTradingPurchase(req.body || {});
    validatingRequest = false;
    const existingRequest = await OwnTradingPurchase.findOne({ ...buildTenantQuery(req), idempotencyKey: normalized.idempotencyKey });
    if (existingRequest) {
      if (existingRequest.status === 'Posted') return res.status(200).json({ success: true, duplicate: true, purchase: existingRequest });
      return res.status(409).json({ error: 'This purchase request is already being processed or needs review.', purchaseId: existingRequest.id || existingRequest._id });
    }

    const supplierIds = [...new Set(normalized.items.map(item => item.supplierId))];
    const productIds = [...new Set(normalized.items.map(item => item.productId))];
    const [suppliers, products] = await Promise.all([
      Supplier.find({ ...buildTenantQuery(req), _id: { $in: supplierIds } }),
      Product.find({ ...buildTenantQuery(req), _id: { $in: productIds } }),
    ]);
    const supplierMap = new Map(suppliers.map(item => [String(item.id || item._id), item]));
    const productMap = new Map(products.map(item => [String(item.id || item._id), item]));
    if (supplierMap.size !== supplierIds.length || productMap.size !== productIds.length) {
      return res.status(404).json({ error: 'A selected supplier or product was not found in this business.' });
    }

    const supplierBalances = normalized.supplierBalances.map(balance => {
      const supplier = supplierMap.get(balance.supplierId);
      return { ...balance, supplierName: supplier.name };
    });
    const items = normalized.items.map(item => {
      const supplier = supplierMap.get(item.supplierId);
      const product = productMap.get(item.productId);
      return {
        ...item,
        supplierName: supplier.name,
        productName: product.name,
        unit: item.unit || product.unit || 'Crates',
      };
    });
    const purchaseReference = normalized.purchaseReference || `OT-${normalized.date.replaceAll('-', '')}-${normalized.idempotencyKey.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`;
    if (await OwnTradingPurchase.findOne({ ...buildTenantQuery(req), purchaseReference })) {
      return res.status(409).json({ error: 'Purchase reference is already in use.' });
    }

    const posted = await withMongoTransaction(async session => {
      purchase = await OwnTradingPurchase.create({
        tenantId,
        ...normalized,
        purchaseReference,
        items,
        supplierBalances,
        status: 'Processing',
        recordedBy: req.user?.id || '',
        recordedByName: req.user?.name || '',
      }, { session });

      const linkedItems = [];
      for (const [index, item] of items.entries()) {
        const stockEntry = await StockEntry.create({
        tenantId,
        lotNumber: `${purchaseReference}-${index + 1}`,
        vehicleNumber: normalized.truckNumber,
        unit: item.unit,
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        remainingQuantity: item.quantity,
        purchaseRate: item.landedUnitCost,
        date: normalized.date,
        totalAmount: item.landedCost,
        businessMode: 'Own Trading',
        ownTradingPurchaseId: purchase.id || purchase._id,
        purchaseReference,
        sourceMandi: normalized.sourceMandi,
        purchaseCost: item.lineAmount,
        allocatedPurchaseExpenses: item.allocatedExpenses,
        landedCostTotal: item.landedCost,
        supplierCommissionType: 'Fixed Amount',
        supplierCommissionValue: 0,
        marketFeeRate: 0,
        marketFeeFixedAmount: 0,
        marketFeeAmount: 0,
        totalDeductions: 0,
        netPayable: item.lineAmount,
        isSettled: false,
        settledAmount: 0,
        }, { session });
        const changedProduct = await Product.findOneAndUpdate(
          { ...buildTenantQuery(req), _id: item.productId },
          { $inc: { currentQuantity: item.quantity } },
          { session }
        );
        if (!changedProduct) throw new Error(`Could not add purchased stock for ${item.productName}.`);
        linkedItems.push({ ...item, lotId: stockEntry.id || stockEntry._id, lotNumber: stockEntry.lotNumber });
      }

      for (const balance of supplierBalances) {
        const supplier = await Supplier.findById(balance.supplierId, { session });
        if (!supplier || !assertTenantOwnership(req, supplier)) throw new Error('A selected supplier was not found in this business.');
        const currentBalance = Number(supplier.currentBalance) || 0;
        const afterPurchaseBalance = roundMoney(currentBalance - balance.purchaseAmount);
        await Supplier.findByIdAndUpdate(balance.supplierId, {
        currentBalance: afterPurchaseBalance,
        remainingBalance: afterPurchaseBalance,
        totalSupplied: roundMoney((Number(supplier.totalSupplied) || 0) + balance.purchaseAmount),
        }, { session });
        await Ledger.create({
        tenantId, partyId: balance.supplierId, partyType: 'Supplier', date: normalized.date,
        type: 'Credit', amount: balance.purchaseAmount, balanceAfter: afterPurchaseBalance,
        description: `OWN TRADING PURCHASE ${purchaseReference}: Purchased goods on account.`,
        }, { session });

        if (balance.advancePaid > 0) {
          const afterAdvanceBalance = roundMoney(afterPurchaseBalance + balance.advancePaid);
          await Supplier.findByIdAndUpdate(balance.supplierId, {
          currentBalance: afterAdvanceBalance,
          remainingBalance: afterAdvanceBalance,
          totalPaid: roundMoney((Number(supplier.totalPaid) || 0) + balance.advancePaid),
          }, { session });
          await Ledger.create({
          tenantId, partyId: balance.supplierId, partyType: 'Supplier', date: normalized.date,
          type: 'Debit', amount: balance.advancePaid, balanceAfter: afterAdvanceBalance,
          description: `OWN TRADING ADVANCE ${purchaseReference}: Advance paid at purchase entry.`,
          }, { session });
          await Payment.create({
          tenantId, partyId: balance.supplierId, partyName: balance.supplierName, partyType: 'Supplier',
          date: normalized.date, amount: balance.advancePaid, type: 'Paid', paymentMethod: 'Cash',
          description: `Own Trading advance for ${purchaseReference}`,
          balanceBefore: afterPurchaseBalance, balanceAfter: afterAdvanceBalance,
          ownTradingPurchaseId: purchase.id || purchase._id,
          ownTradingAllocationType: 'Supplier Payable',
          }, { session });
        }
      }

      const postedRecord = await OwnTradingPurchase.findByIdAndUpdate(purchase.id || purchase._id, { items: linkedItems, status: 'Posted' }, { session });
      await AuditLog.create({
      tenantId,
      userId: req.user?.id || 'system',
      userName: req.user?.name || 'System',
      userRole: req.user?.role || 'Admin',
      action: 'ADD_OWN_TRADING_PURCHASE',
      details: `Recorded Own Trading purchase ${purchaseReference}; ${linkedItems.length} stock lots, merchandise Rs. ${normalized.purchaseValue}, expenses Rs. ${normalized.expenseTotal}.`,
      timestamp: new Date().toISOString(),
      }, { session });
      return postedRecord;
    });
    res.status(201).json({ success: true, purchase: posted });
  } catch (error) {
    console.error('createOwnTradingPurchase error:', error);
    if (error?.code === 11000) return res.status(409).json({ error: 'Purchase reference or request was already recorded.' });
    res.status(error.status || (validatingRequest ? 400 : 500)).json({ error: error.message || 'Failed to record Own Trading purchase.' });
  }
}

export async function cancelOwnTradingPurchase(req, res) {
  try {
    const cancelled = await withMongoTransaction(async session => {
      const purchase = await OwnTradingPurchase.findById(req.params.id, { session });
      if (!purchase || !assertTenantOwnership(req, purchase)) {
        const error = new Error('Own Trading purchase not found.'); error.status = 404; throw error;
      }
      if (purchase.status !== 'Posted') {
        const error = new Error('Only posted purchases can be cancelled.'); error.status = 409; throw error;
      }
      const lock = await OwnTradingPurchase.findOneAndUpdate(
        { _id: purchase.id || purchase._id, ...buildTenantQuery(req), status: 'Posted' },
        { $set: { status: 'Cancelled', cancelledAt: new Date(), cancelledBy: req.user?.id || '' } },
        { session }
      );
      if (!lock) {
        const error = new Error('This purchase is already being changed. Refresh and try again.'); error.status = 409; throw error;
      }

      const lots = await StockEntry.find({ ...buildTenantQuery(req), ownTradingPurchaseId: purchase.id || purchase._id }, { session });
      const lotIds = lots.map(lot => String(lot.id || lot._id));
      const [sales, returns] = await Promise.all([
        Sale.find({ ...buildTenantQuery(req), stockEntryId: { $in: lotIds }, isDeleted: { $ne: true } }, { session }),
        ReturnRecord.find({ ...buildTenantQuery(req), stockEntryId: { $in: lotIds }, isDeleted: { $ne: true } }, { session }),
      ]);
      if (sales.length || returns.length || lots.some(lot => Number(lot.remainingQuantity ?? lot.quantity) !== Number(lot.quantity))) {
        const error = new Error('This purchase has sales, returns, or stock adjustments. Reverse those transactions before cancelling the purchase.'); error.status = 409; throw error;
      }

      for (const lot of lots) {
        const product = await Product.findById(lot.productId, { session });
        if (product && assertTenantOwnership(req, product)) {
          await Product.findByIdAndUpdate(lot.productId, { currentQuantity: Math.max(0, (Number(product.currentQuantity) || 0) - Number(lot.quantity || 0)) }, { session });
        }
        await StockEntry.findByIdAndDelete(lot.id || lot._id, { session });
      }
      for (const balance of purchase.supplierBalances || []) {
        const supplier = await Supplier.findById(balance.supplierId, { session });
        if (!supplier || !assertTenantOwnership(req, supplier)) continue;
        const newBalance = roundMoney((Number(supplier.currentBalance) || 0) + Number(balance.purchaseAmount || 0));
        await Supplier.findByIdAndUpdate(balance.supplierId, {
          currentBalance: newBalance,
          remainingBalance: newBalance,
          totalSupplied: Math.max(0, (Number(supplier.totalSupplied) || 0) - Number(balance.purchaseAmount || 0)),
        }, { session });
        await Ledger.create({
          tenantId: getTenantId(req) || purchase.tenantId,
          partyId: balance.supplierId,
          partyType: 'Supplier',
          date: new Date().toISOString().slice(0, 10),
          type: 'Debit',
          amount: Number(balance.purchaseAmount) || 0,
          balanceAfter: newBalance,
          description: `OWN TRADING CANCELLATION ${purchase.purchaseReference}: Purchase payable reversed. Any supplier advance remains as supplier credit until refunded.`,
        }, { session });
      }
      await AuditLog.create({
        tenantId: getTenantId(req) || purchase.tenantId,
        userId: req.user?.id || 'system', userName: req.user?.name || 'System', userRole: req.user?.role || 'Admin',
        action: 'CANCEL_OWN_TRADING_PURCHASE', details: `Cancelled Own Trading purchase ${purchase.purchaseReference}.`, timestamp: new Date().toISOString(),
      }, { session });
      return lock;
    });
    res.json({ success: true, purchase: cancelled });
  } catch (error) {
    console.error('cancelOwnTradingPurchase error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to cancel Own Trading purchase.' });
  }
}
