import { calculateLotRemaining } from '../utils/lotStock.js';
import { StockEntry, Product, Supplier, Ledger, AuditLog, Sale, ReturnRecord } from '../models/index.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';

export async function getStockEntries(req, res) {
  try {
    const tenantQuery = buildTenantQuery(req);
    let stockQuery = tenantQuery;
    if (req.user?.role === 'Supplier') {
      const supplier = await Supplier.findOne(buildTenantQuery(req, { userId: req.user.id }));
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      stockQuery = buildTenantQuery(req, { supplierId: supplier.id || supplier._id });
    }
    const [entries, sales, returns, products] = await Promise.all([
      StockEntry.find(stockQuery),
      Sale.find({ ...tenantQuery, isDeleted: { $ne: true } }),
      ReturnRecord.find({ ...tenantQuery, status: 'Approved', isDeleted: false }),
      Product.find(tenantQuery)
    ]);

    const productMap = {};
    for (const p of products) {
      productMap[String(p.id || p._id)] = p;
    }

    const enrichedEntries = entries.map(entry => {
      const entryId = String(entry.id || entry._id);
      const lotNumStr = entry.lotNumber ? String(entry.lotNumber) : null;

      // Find linked sales for this stock entry
      const lotSales = sales.filter(s => {
        const sStockId = s.stockEntryId ? String(s.stockEntryId) : null;
        const sLotNum = s.stockLotNumber ? String(s.stockLotNumber) : null;
        if (sStockId && sStockId === entryId) return true;
        if (sLotNum && lotNumStr && sLotNum === lotNumStr) return true;
        return false;
      });

      // Find linked approved returns for this stock entry
      const lotReturns = returns.filter(r => {
        const rStockId = r.stockEntryId ? String(r.stockEntryId) : null;
        const rSaleId = r.saleId ? String(r.saleId) : null;
        const matchesStock = (rStockId && rStockId === entryId);
        const matchesSale = rSaleId && lotSales.some(s => String(s.id || s._id) === rSaleId);
        return matchesStock || matchesSale;
      });

      const arrivedQuantity = Number(entry.quantity) || 0;
      const isOwnTrading = entry.businessMode === 'Own Trading';
      const rawSoldQuantity = lotSales.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
      const returnedQuantity = lotReturns.reduce((acc, r) => acc + (Number(r.produceReturnedQty) || 0), 0);
      const netSoldQuantity = Math.max(0, rawSoldQuantity - returnedQuantity);
      const remainingQuantity = calculateLotRemaining(arrivedQuantity, lotSales, lotReturns, isOwnTrading);

      const rawGrossSales = lotSales.reduce((acc, s) => acc + (Number(s.grossSale) || (Number(s.quantity || 0) * Number(s.saleRate || 0)) || 0), 0);
      const returnedGrossValue = lotReturns.reduce((acc, r) => acc + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0)) || 0), 0);
      const grossSalesAmount = Math.max(0, Math.round((rawGrossSales - returnedGrossValue) * 100) / 100);
      const totalAmount = isOwnTrading ? (Number(entry.landedCostTotal) || Number(entry.totalAmount) || 0) : grossSalesAmount;

      const purchaseRate = isOwnTrading ? (Number(entry.purchaseRate) || 0) : (netSoldQuantity > 0 ? Math.round((grossSalesAmount / netSoldQuantity) * 100) / 100 : (entry.purchaseRate || 0));

      const prod = entry.productId ? productMap[String(entry.productId)] : null;
      const unit = entry.unit || prod?.unit || 'Crates';
      const lotNumber = entry.lotNumber || (entryId.substring(0, 6).toUpperCase());
      const status = remainingQuantity === 0 ? 'Depleted' : (netSoldQuantity > 0 ? 'Partially Sold' : 'In-Stock');

      const entryObj = typeof entry.toObject === 'function' ? entry.toObject() : { ...entry };

      return {
        ...entryObj,
        lotNumber,
        unit,
        arrivedQuantity,
        soldQuantity: rawSoldQuantity,
        returnedQuantity,
        netSoldQuantity,
        remainingQuantity,
        purchaseRate,
        totalAmount,
        grossSalesAmount: rawGrossSales,
        returnedGrossAmount: returnedGrossValue,
        status,
      };
    });

    // Sort newest date first
    enrichedEntries.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));

    res.json(enrichedEntries);
  } catch (err) {
    console.error('getStockEntries error:', err);
    res.status(500).json({ error: 'Failed to fetch stock entries.' });
  }
}

export async function addStockEntry(req, res) {
  try {
    const { supplierId, productId, quantity, date, vehicleNumber, lotNumber } = req.body;
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!supplierId || !productId || !quantity || !date) {
      return res.status(400).json({ error: 'Please provide supplier, product, quantity, and date.' });
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }
    if (!assertTenantOwnership(req, supplier)) return res.status(404).json({ error: 'Supplier not found.' });

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    if (!assertTenantOwnership(req, product)) return res.status(404).json({ error: 'Product not found.' });

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number.' });
    }

    // Auto-generate lotNumber if not supplied
    let finalLotNumber = lotNumber;
    if (!finalLotNumber) {
      const totalCount = await StockEntry.countDocuments({ tenantId }) || 0;
      finalLotNumber = `${totalCount + 1001}`;
    }

    // Create Stock Entry
    const entry = await StockEntry.create({
      tenantId,
      lotNumber: finalLotNumber,
      vehicleNumber: vehicleNumber || '',
      unit: product.unit || 'Crates',
      supplierId,
      supplierName: supplier.name,
      productId,
      productName: product.name,
      quantity: qty,
      remainingQuantity: qty,
      purchaseRate: 0,
      date,
      totalAmount: 0,
    });

    // 1. Update Product Inventory
    await Product.findByIdAndUpdate(productId, {
      currentQuantity: product.currentQuantity + qty,
    });

    // 2. Audit Log
    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ADD_STOCK',
      details: `Added ${qty} ${product.unit || 'units'} of ${product.name} (Lot #${finalLotNumber}) from supplier ${supplier.name}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record stock entry.' });
  }
}

export async function updateStockEntry(req, res) {
  try {
    const { id } = req.params;
    const { supplierId, productId, quantity, date, vehicleNumber, lotNumber } = req.body;

    const entry = await StockEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Stock entry not found.' });
    }
    if (!assertTenantOwnership(req, entry)) return res.status(404).json({ error: 'Stock entry not found.' });
    if (entry.businessMode === 'Own Trading') return res.status(400).json({ error: 'Own Trading lots are managed through their purchase record and cannot be edited as consignment lots.' });

    const oldQty = entry.quantity;
    const oldProductId = entry.productId;
    const oldSupplierId = entry.supplierId;

    const newQty = Number(quantity);
    if (!Number.isFinite(newQty) || newQty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number.' });
    }

    // Verify product and supplier exist
    const targetProduct = await Product.findById(productId || oldProductId);
    const targetSupplier = await Supplier.findById(supplierId || oldSupplierId);

    if (!targetProduct || !targetSupplier) {
      return res.status(404).json({ error: 'Product or Supplier not found.' });
    }
    if (!assertTenantOwnership(req, targetProduct) || !assertTenantOwnership(req, targetSupplier)) {
      return res.status(404).json({ error: 'Product or Supplier not found.' });
    }

    // Adjust inventories
    // 1. Revert Old product stock
    const oldProd = await Product.findById(oldProductId);
    if (oldProd) {
      await Product.findByIdAndUpdate(oldProductId, {
        currentQuantity: Math.max(0, oldProd.currentQuantity - oldQty),
      });
    }

    // 2. Apply New product stock
    const freshProd = await Product.findById(productId || oldProductId);
    await Product.findByIdAndUpdate(freshProd.id || freshProd._id, {
      currentQuantity: freshProd.currentQuantity + newQty,
    });

    // 3. Update stock entry (adjust remainingQuantity accordingly)
    const soldQty = Math.max(0, oldQty - (entry.remainingQuantity || oldQty));
    const newRemaining = Math.max(0, newQty - soldQty);

    const updated = await StockEntry.findByIdAndUpdate(id, {
      supplierId: targetSupplier.id || targetSupplier._id,
      supplierName: targetSupplier.name,
      productId: targetProduct.id || targetProduct._id,
      productName: targetProduct.name,
      unit: targetProduct.unit || entry.unit || 'Crates',
      lotNumber: lotNumber || entry.lotNumber,
      vehicleNumber: vehicleNumber !== undefined ? vehicleNumber : entry.vehicleNumber,
      quantity: newQty,
      remainingQuantity: newRemaining,
      date,
    });

    const tenantId = getTenantId(req) || entry.tenantId || 'tenant_default_001';

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE_STOCK',
      details: `Updated Stock Entry ${id} (Lot #${updated.lotNumber || id}). Qty: ${oldQty} -> ${newQty}`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update stock entry.' });
  }
}

export async function deleteStockEntry(req, res) {
  try {
    const { id } = req.params;
    const entry = await StockEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Stock entry not found.' });
    }
    if (!assertTenantOwnership(req, entry)) return res.status(404).json({ error: 'Stock entry not found.' });
    if (entry.businessMode === 'Own Trading') return res.status(400).json({ error: 'Cancel the linked Own Trading purchase to remove these lots.' });

    const tenantId = getTenantId(req) || entry.tenantId || 'tenant_default_001';
    const { productId, supplierId, quantity, totalAmount, productName, supplierName } = entry;

    // Adjust product inventory
    const product = await Product.findById(productId);
    if (product) {
      await Product.findByIdAndUpdate(productId, {
        currentQuantity: Math.max(0, product.currentQuantity - quantity),
      });
    }

    // If lot was already recorded/settled, revert supplier balance
    if (entry.isSettled && entry.settledAmount > 0) {
      const supplier = await Supplier.findById(supplierId);
      if (supplier) {
        const revertedBalance = supplier.currentBalance + entry.settledAmount;
        await Supplier.findByIdAndUpdate(supplierId, {
          totalSupplied: Math.max(0, supplier.totalSupplied - entry.settledAmount),
          currentBalance: revertedBalance,
          remainingBalance: revertedBalance,
        });

        // Add debit reversal ledger entry
        await Ledger.create({
          tenantId,
          partyId: supplierId,
          partyType: 'Supplier',
          date: new Date().toISOString().split('T')[0],
          type: 'Debit',
          amount: entry.settledAmount,
          balanceAfter: revertedBalance,
          description: `DELETED SETTLED LOT REVERSAL: Cancelled supply lot of ${quantity} of ${productName}`,
        });
      }
    }

    await StockEntry.findByIdAndDelete(id);

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_STOCK',
      details: `Deleted Stock Entry ${id}. Reverted ${quantity} units of ${productName} from supplier ${supplierName}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Stock entry deleted and accounts adjusted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete stock entry.' });
  }
}

export async function updateLotFinancials(req, res) {
  try {
    const { id } = req.params;
    const { supplierCommissionType, supplierCommissionValue, marketFeeFixedAmount, marketFeeRate, marketFeePercentage, lotExpenses } = req.body;

    const entry = await StockEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Stock entry lot not found.' });
    }
    if (!assertTenantOwnership(req, entry)) return res.status(404).json({ error: 'Stock entry lot not found.' });
    if (entry.businessMode === 'Own Trading') return res.status(400).json({ error: 'Own Trading lots do not use consignment financial adjustments or settlement.' });

    const [lotSales, lotReturns] = await Promise.all([
      Sale.find({ stockEntryId: id, isDeleted: { $ne: true } }),
      ReturnRecord.find({ stockEntryId: id, status: 'Approved', isDeleted: false })
    ]);

    const totalRawGrossSales = lotSales.reduce((sum, s) => sum + (s.grossSale || (s.quantity * s.saleRate)), 0);
    const totalRawQtySold = lotSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

    const totalReturnedGross = lotReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
    const totalReturnedQty = lotReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);

    // Net lot gross sales and quantity sold after deducting returned stock value
    const lotGrossSales = Math.max(0, Math.round((totalRawGrossSales - totalReturnedGross) * 100) / 100);
    const lotQtySold = Math.max(0, totalRawQtySold - totalReturnedQty);

    const commVal = Number(supplierCommissionValue) || 0;
    const commType = supplierCommissionType || 'Percentage';
    const marketFee = Number(marketFeeFixedAmount !== undefined ? marketFeeFixedAmount : (marketFeeRate !== undefined ? marketFeeRate : (marketFeePercentage !== undefined ? marketFeePercentage : (entry.marketFeeFixedAmount ?? entry.marketFeeRate ?? 0)))) || 0;

    let supplierCommissionDeduction = 0;
    if (commType === 'Percentage') {
      supplierCommissionDeduction = lotGrossSales * (commVal / 100);
    } else if (commType === 'Per Unit') {
      supplierCommissionDeduction = lotQtySold * commVal;
    } else if (commType === 'Fixed Amount') {
      supplierCommissionDeduction = commVal;
    }
    supplierCommissionDeduction = Math.round(supplierCommissionDeduction * 100) / 100;

    const marketFeeDeduction = Math.round(marketFee * 100) / 100;

    let totalExpenseDeductions = 0;
    if (lotExpenses && typeof lotExpenses === 'object') {
      Object.values(lotExpenses).forEach(v => {
        const num = Number(v);
        if (!isNaN(num) && num > 0) {
          totalExpenseDeductions += num;
        }
      });
    }
    totalExpenseDeductions = Math.round(totalExpenseDeductions * 100) / 100;

    const totalDeductions = Math.round((supplierCommissionDeduction + marketFeeDeduction + totalExpenseDeductions) * 100) / 100;
    const netPayable = Math.round((lotGrossSales - totalDeductions) * 100) / 100;

    const previousDeductions = entry.totalDeductions || 0;
    const deductionDelta = totalDeductions - previousDeductions;

    // Update Stock Entry lot
    const updated = await StockEntry.findByIdAndUpdate(id, {
      supplierCommissionType: commType,
      supplierCommissionValue: commVal,
      marketFeeFixedAmount: marketFee,
      marketFeeRate: marketFee,
      marketFeeAmount: marketFeeDeduction,
      lotExpenses: lotExpenses || {},
      totalDeductions,
      netPayable
    });

    const tenantId = getTenantId(req) || entry.tenantId || 'tenant_default_001';

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE_LOT_FINANCIALS',
      details: `Updated lot financial settlement for Lot ${id}. Comm: ${commVal} (${commType}), Market Fee: Rs. ${marketFee}, Total Deductions: Rs. ${totalDeductions}, Net Payable: Rs. ${netPayable}`,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      stockEntry: {
        ...(entry._doc || entry),
        supplierCommissionType: commType,
        supplierCommissionValue: commVal,
        marketFeeFixedAmount: marketFee,
        marketFeeRate: marketFee,
        marketFeeAmount: marketFeeDeduction,
        lotExpenses: lotExpenses || {},
        totalDeductions,
        netPayable
      },
      calculations: {
        rawGrossSales: totalRawGrossSales,
        totalReturnedGross,
        lotGrossSales,
        supplierCommissionDeduction,
        marketFeeFixedAmount: marketFee,
        marketFeeRate: marketFee,
        marketFeeDeduction,
        totalExpenseDeductions,
        totalDeductions,
        netPayable
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update lot financial settlement.' });
  }
}

export async function recordLotSettlement(req, res) {
  try {
    const { id } = req.params;
    const { supplierCommissionType, supplierCommissionValue, marketFeeFixedAmount, marketFeeRate, marketFeePercentage, lotExpenses } = req.body || {};

    const entry = await StockEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Consignment lot not found.' });
    }
    if (!assertTenantOwnership(req, entry)) return res.status(404).json({ error: 'Consignment lot not found.' });
    if (entry.businessMode === 'Own Trading') return res.status(400).json({ error: 'Own Trading is posted transaction by transaction and does not use lot settlement.' });

    // Ensure amount is recorded only once and prevents duplicate entries
    if (entry.isSettled) {
      return res.status(400).json({ 
        error: 'This consignment lot settlement has already been recorded to Outstanding Payables and Supplier Supply Value.',
        isSettled: true,
        settledAmount: entry.settledAmount
      });
    }

    const commType = supplierCommissionType !== undefined ? supplierCommissionType : (entry.supplierCommissionType || 'Percentage');
    const commVal = supplierCommissionValue !== undefined ? Number(supplierCommissionValue) || 0 : (entry.supplierCommissionValue !== undefined ? entry.supplierCommissionValue : 0);
    const hasFixedMarketFee = marketFeeFixedAmount !== undefined || entry.marketFeeFixedAmount !== undefined;
    const marketFee = Number(marketFeeFixedAmount !== undefined ? marketFeeFixedAmount : (entry.marketFeeFixedAmount !== undefined ? entry.marketFeeFixedAmount : (marketFeeRate !== undefined ? marketFeeRate : (marketFeePercentage !== undefined ? marketFeePercentage : (entry.marketFeeRate || 0))))) || 0;
    const expenses = lotExpenses !== undefined ? lotExpenses : (entry.lotExpenses || {});

    // Calculate sales & applicable amount for this sold consignment minus returned stock value
    const [lotSales, lotReturns] = await Promise.all([
      Sale.find({ stockEntryId: id, isDeleted: { $ne: true } }),
      ReturnRecord.find({ stockEntryId: id, status: 'Approved', isDeleted: false })
    ]);

    const totalRawGrossSales = lotSales.reduce((sum, s) => sum + (s.grossSale || (s.quantity * s.saleRate)), 0);
    const totalRawQtySold = lotSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

    const totalReturnedGross = lotReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
    const totalReturnedQty = lotReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);

    // Effective gross sales value after subtracting returns
    const lotGrossSales = Math.max(0, Math.round((totalRawGrossSales - totalReturnedGross) * 100) / 100);
    const lotQtySold = Math.max(0, totalRawQtySold - totalReturnedQty);

    let supplierCommissionDeduction = 0;
    if (commType === 'Percentage') {
      supplierCommissionDeduction = lotGrossSales * (commVal / 100);
    } else if (commType === 'Per Unit') {
      supplierCommissionDeduction = lotQtySold * commVal;
    } else if (commType === 'Fixed Amount') {
      supplierCommissionDeduction = commVal;
    }
    supplierCommissionDeduction = Math.round(supplierCommissionDeduction * 100) / 100;

    const marketFeeDeduction = hasFixedMarketFee
      ? Math.round(marketFee * 100) / 100
      : Math.round((lotGrossSales * (marketFee / 100)) * 100) / 100;

    let totalExpenseDeductions = 0;
    if (expenses && typeof expenses === 'object') {
      Object.values(expenses).forEach(v => {
        const num = Number(v);
        if (!isNaN(num) && num > 0) {
          totalExpenseDeductions += num;
        }
      });
    }
    totalExpenseDeductions = Math.round(totalExpenseDeductions * 100) / 100;

    const totalDeductions = Math.round((supplierCommissionDeduction + marketFeeDeduction + totalExpenseDeductions) * 100) / 100;
    const netPayable = Math.round((lotGrossSales - totalDeductions) * 100) / 100;

    // Applicable amount for this sold consignment
    const applicableAmount = netPayable > 0 ? netPayable : lotGrossSales;

    if (applicableAmount <= 0) {
      return res.status(400).json({ error: 'Cannot record settlement: No sales recorded for this consignment lot yet.' });
    }

    const supplier = await Supplier.findById(entry.supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier associated with this consignment lot not found.' });
    }
    if (!assertTenantOwnership(req, supplier)) {
      return res.status(404).json({ error: 'Supplier associated with this consignment lot not found.' });
    }

    // 1. Add amount to Supplier's Supply Value (totalSupplied)
    const updatedTotalSupplied = (supplier.totalSupplied || 0) + applicableAmount;

    // 2. Add amount to Outstanding Payables (currentBalance)
    // For Supplier, negative currentBalance represents our payable debt (Outstanding Payable)
    const updatedBalance = (supplier.currentBalance || 0) - applicableAmount;

    await Supplier.findByIdAndUpdate(entry.supplierId, {
      totalSupplied: updatedTotalSupplied,
      currentBalance: updatedBalance,
      remainingBalance: updatedBalance
    });

    const tenantId = getTenantId(req) || entry.tenantId || 'tenant_default_001';

    // Create Consolidated Supplier Ledger entry (Bikri Parchi / Consignment Settlement)
    const lotDesc = `LOT SETTLEMENT (Bikri Parchi): Lot #${entry.lotNumber || id.substring(0, 8).toUpperCase()} (${entry.productName || 'Produce'}) - Realized Gross: Rs. ${lotGrossSales.toLocaleString()}, Total Deductions: Rs. ${totalDeductions.toLocaleString()} (Commission: Rs. ${supplierCommissionDeduction.toLocaleString()}, Market Fee: Rs. ${marketFeeDeduction.toLocaleString()}, Expenses: Rs. ${totalExpenseDeductions.toLocaleString()}), Net Payable: Rs. ${applicableAmount.toLocaleString()} credited to Supplier Khata.`;

    await Ledger.create({
      tenantId,
      partyId: entry.supplierId,
      partyType: 'Supplier',
      date: new Date().toISOString().split('T')[0],
      type: 'Credit',
      amount: applicableAmount,
      balanceAfter: updatedBalance,
      description: lotDesc
    });

    // Mark StockEntry as settled to ensure it is recorded only ONCE
    const updatedStock = await StockEntry.findByIdAndUpdate(id, {
      supplierCommissionType: commType,
      supplierCommissionValue: commVal,
      marketFeeFixedAmount: hasFixedMarketFee ? marketFee : undefined,
      marketFeeRate: marketFee,
      marketFeeAmount: marketFeeDeduction,
      lotExpenses: expenses,
      totalDeductions,
      netPayable,
      isSettled: true,
      settledAmount: applicableAmount,
      settledAt: new Date().toISOString()
    }, { new: true });

    // Audit Log
    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'RECORD_LOT_SETTLEMENT',
      details: `Recorded Lot Sheet Settlement for Lot ${id}. Added Rs. ${applicableAmount} to Supplier ${supplier.name} Supply Value and Outstanding Payables.`,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Successfully recorded Rs. ${applicableAmount.toLocaleString()} to Outstanding Payables and Supplier Supply Value!`,
      applicableAmount,
      stockEntry: updatedStock
    });
  } catch (err) {
    console.error('Error recording lot settlement:', err);
    res.status(500).json({ error: 'Failed to record lot settlement.' });
  }
}
