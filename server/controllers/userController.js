import bcryptjs from 'bcryptjs';
import { User, Customer, Supplier, Employee, AuditLog, Ledger, Payment, StockEntry, Sale, Truck, ReturnRecord } from '../models/index.js';
import { CommissionRule } from '../models/settings.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';
import { peekNextKhataId, getNextKhataId, isKhataIdUnique, syncCounterIfNeeded } from '../utils/counter.js';
import { truckHasSupplier } from '../utils/truckCargo.js';

// --- DATA INTEGRITY LINKED DATA HELPERS ---

/**
 * Checks whether a Supplier has any linked data anywhere in the application
 * (Stock lots, sales realizations, payments, khata ledgers, truck logistics, returns, commission rules, or non-zero balances).
 */
export async function getSupplierLinkedData(supplierId, req) {
  const sIdStr = String(supplierId);
  const tenantQuery = buildTenantQuery(req);

  const [
    allStock,
    allSales,
    allPayments,
    allLedgers,
    allTrucks,
    allReturns,
    allRules,
    supplier
  ] = await Promise.all([
    StockEntry.find(tenantQuery),
    Sale.find(tenantQuery),
    Payment.find(tenantQuery),
    Ledger.find(tenantQuery),
    Truck.find(tenantQuery),
    ReturnRecord.find(tenantQuery),
    CommissionRule.find(tenantQuery),
    Supplier.findById(supplierId)
  ]);

  const supplierIds = new Set([sIdStr]);
  if (supplier) {
    if (supplier.id) supplierIds.add(String(supplier.id));
    if (supplier._id) supplierIds.add(String(supplier._id));
    if (supplier.khataId) supplierIds.add(String(supplier.khataId));
  }

  // 1. Stock / Lot arrivals
  const linkedStock = allStock.filter(st => 
    supplierIds.has(String(st.supplierId)) || 
    (supplier && st.supplierName && st.supplierName.trim().toLowerCase() === supplier.name.trim().toLowerCase())
  );
  const stockIds = new Set(linkedStock.map(st => String(st.id || st._id)));

  // 2. Sales linked to this supplier's stock lots
  const linkedSales = allSales.filter(s => s.stockEntryId && stockIds.has(String(s.stockEntryId)));

  // 3. Payments
  const linkedPayments = allPayments.filter(p => 
    (supplierIds.has(String(p.partyId)) || (supplier && p.partyName && p.partyName.trim().toLowerCase() === supplier.name.trim().toLowerCase())) && 
    p.partyType === 'Supplier'
  );

  // 4. Ledger entries
  const linkedLedgers = allLedgers.filter(l => 
    supplierIds.has(String(l.partyId)) && 
    l.partyType === 'Supplier'
  );

  // 5. Trucks / Transport Logistics
  const linkedTrucks = allTrucks.filter(t => [...supplierIds].some(id => truckHasSupplier(t, id, supplier?.name)));

  // 6. Produce / Crate Returns
  const linkedReturns = allReturns.filter(r => 
    supplierIds.has(String(r.supplierId)) || 
    (supplier && r.supplierName && r.supplierName.trim().toLowerCase() === supplier.name.trim().toLowerCase()) ||
    (r.stockEntryId && stockIds.has(String(r.stockEntryId)))
  );

  // 7. Commission Rules
  const linkedRules = allRules.filter(r => 
    supplierIds.has(String(r.supplierId)) ||
    (supplier && r.supplierName && r.supplierName.trim().toLowerCase() === supplier.name.trim().toLowerCase())
  );

  // 8. Financial Activity / Balances
  const hasBalance = supplier && Math.abs(Number(supplier.currentBalance) || 0) > 0.01;
  const hasRemainingBal = supplier && Math.abs(Number(supplier.remainingBalance) || 0) > 0.01;
  const hasSuppliedVolume = supplier && (Number(supplier.totalSupplied) || 0) > 0;
  const hasPaidVolume = supplier && (Number(supplier.totalPaid) || 0) > 0;

  const reasons = [];
  if (linkedStock.length > 0) reasons.push(`${linkedStock.length} stock lot arrival(s)`);
  if (linkedSales.length > 0) reasons.push(`${linkedSales.length} linked lot sales`);
  if (linkedPayments.length > 0) reasons.push(`${linkedPayments.length} payment voucher(s)`);
  if (linkedLedgers.length > 0) reasons.push(`${linkedLedgers.length} khata ledger transaction(s)`);
  if (linkedTrucks.length > 0) reasons.push(`${linkedTrucks.length} truck transport log(s)`);
  if (linkedReturns.length > 0) reasons.push(`${linkedReturns.length} return record(s)`);
  if (linkedRules.length > 0) reasons.push(`${linkedRules.length} commission rule(s)`);
  if (hasBalance) {
    const balVal = Number(supplier.currentBalance);
    reasons.push(`outstanding balance (Rs. ${Math.abs(balVal).toLocaleString()} ${balVal < 0 ? 'Payable' : 'Receivable'})`);
  } else if (hasRemainingBal) {
    reasons.push(`remaining khata balance of Rs. ${Math.abs(Number(supplier.remainingBalance)).toLocaleString()}`);
  } else if (hasSuppliedVolume || hasPaidVolume) {
    reasons.push(`historical trade activity (Rs. ${(Number(supplier?.totalSupplied) || 0).toLocaleString()} supplied)`);
  }

  const hasLinkedData = reasons.length > 0;

  return {
    hasLinkedData,
    reasons,
    counts: {
      stockCount: linkedStock.length,
      salesCount: linkedSales.length,
      paymentCount: linkedPayments.length,
      ledgerCount: linkedLedgers.length,
      truckCount: linkedTrucks.length,
      returnCount: linkedReturns.length,
      ruleCount: linkedRules.length,
      hasFinancialActivity: hasBalance || hasRemainingBal || hasSuppliedVolume || hasPaidVolume
    }
  };
}

/**
 * Checks whether a Customer has any linked data anywhere in the application
 * (Sales invoices, payments, khata ledgers, produce/crate returns, commission rules, or non-zero balances).
 */
export async function getCustomerLinkedData(customerId, req) {
  const cIdStr = String(customerId);
  const tenantQuery = buildTenantQuery(req);

  const [
    allSales,
    allPayments,
    allLedgers,
    allReturns,
    allRules,
    customer
  ] = await Promise.all([
    Sale.find(tenantQuery),
    Payment.find(tenantQuery),
    Ledger.find(tenantQuery),
    ReturnRecord.find(tenantQuery),
    CommissionRule.find(tenantQuery),
    Customer.findById(customerId)
  ]);

  const customerIds = new Set([cIdStr]);
  if (customer) {
    if (customer.id) customerIds.add(String(customer.id));
    if (customer._id) customerIds.add(String(customer._id));
    if (customer.khataId) customerIds.add(String(customer.khataId));
  }

  // 1. Sales / Invoices
  const linkedSales = allSales.filter(s => 
    customerIds.has(String(s.customerId)) || 
    (customer && s.customerName && s.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
  );

  // 2. Payments
  const linkedPayments = allPayments.filter(p => 
    (customerIds.has(String(p.partyId)) || (customer && p.partyName && p.partyName.trim().toLowerCase() === customer.name.trim().toLowerCase())) && 
    p.partyType === 'Customer'
  );

  // 3. Ledger entries
  const linkedLedgers = allLedgers.filter(l => 
    customerIds.has(String(l.partyId)) && 
    l.partyType === 'Customer'
  );

  // 4. Produce / Crate Returns
  const linkedReturns = allReturns.filter(r => 
    customerIds.has(String(r.customerId)) || 
    (customer && r.customerName && r.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
  );

  // 5. Commission Rules
  const linkedRules = allRules.filter(r => 
    customerIds.has(String(r.customerId)) ||
    (customer && r.customerName && r.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
  );

  // 6. Financial Activity / Balances
  const hasBalance = customer && Math.abs(Number(customer.currentBalance) || 0) > 0.01;
  const hasRemainingBal = customer && Math.abs(Number(customer.remainingBalance) || 0) > 0.01;
  const hasPurchasedVolume = customer && (Number(customer.totalPurchases) || 0) > 0;
  const hasPaidVolume = customer && (Number(customer.totalPaid) || 0) > 0;

  const reasons = [];
  if (linkedSales.length > 0) reasons.push(`${linkedSales.length} sale invoice(s)`);
  if (linkedPayments.length > 0) reasons.push(`${linkedPayments.length} payment voucher(s)`);
  if (linkedLedgers.length > 0) reasons.push(`${linkedLedgers.length} khata ledger transaction(s)`);
  if (linkedReturns.length > 0) reasons.push(`${linkedReturns.length} produce/crate return(s)`);
  if (linkedRules.length > 0) reasons.push(`${linkedRules.length} commission rule(s)`);
  if (hasBalance) {
    const balVal = Number(customer.currentBalance);
    reasons.push(`outstanding balance (Rs. ${Math.abs(balVal).toLocaleString()} ${balVal > 0 ? 'Receivable' : 'Credit'})`);
  } else if (hasRemainingBal) {
    reasons.push(`remaining khata balance of Rs. ${Math.abs(Number(customer.remainingBalance)).toLocaleString()}`);
  } else if (hasPurchasedVolume || hasPaidVolume) {
    reasons.push(`historical purchase activity (Rs. ${(Number(customer?.totalPurchases) || 0).toLocaleString()} purchased)`);
  }

  const hasLinkedData = reasons.length > 0;

  return {
    hasLinkedData,
    reasons,
    counts: {
      salesCount: linkedSales.length,
      paymentCount: linkedPayments.length,
      ledgerCount: linkedLedgers.length,
      returnCount: linkedReturns.length,
      ruleCount: linkedRules.length,
      hasFinancialActivity: hasBalance || hasRemainingBal || hasPurchasedVolume || hasPaidVolume
    }
  };
}

// --- CLERKS ---
export async function getClerks(req, res) {
  try {
    const clerks = await User.find(buildTenantQuery(req, { role: 'Clerk', isDeleted: { $ne: true } }));
    res.json(clerks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clerks.' });
  }
}

export async function addClerk(req, res) {
  try {
    const { name, email, password, phone, address, status } = req.body;
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!name || !phone || !email || !email.trim() || !password || !password.trim()) {
      return res.status(400).json({ error: 'Please provide name, email, password, and phone number for creating a clerk account.' });
    }

    const trimmedEmail = email.trim();
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const salt = bcryptjs.genSaltSync(10);
    const hashedPassword = bcryptjs.hashSync(password, salt);

    const clerkData = {
      tenantId,
      name,
      email: trimmedEmail,
      password: hashedPassword,
      phone,
      address,
      role: 'Clerk',
      status: status || 'Active',
    };

    const clerk = await User.create(clerkData);

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ADD_CLERK',
      details: `Created clerk account for ${name} (${trimmedEmail}).`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(clerk);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create clerk account.' });
  }
}

export async function editClerk(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password, phone, address, status } = req.body;

    const clerk = await User.findById(id);
    if (!clerk || clerk.role !== 'Clerk') {
      return res.status(404).json({ error: 'Clerk not found.' });
    }
    if (!assertTenantOwnership(req, clerk)) return res.status(404).json({ error: 'Clerk not found.' });

    const updateData = { name, phone, address, status };
    if (email !== undefined) {
      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Email address is required for clerk.' });
      }
      const existing = await User.findOne({ email: email.trim() });
      if (existing && (existing.id !== id && existing._id?.toString() !== id)) {
        return res.status(400).json({ error: 'Email already registered by another account.' });
      }
      updateData.email = email.trim();
    }
    if (password && password.trim()) {
      const salt = bcryptjs.genSaltSync(10);
      updateData.password = bcryptjs.hashSync(password, salt);
    }

    const updated = await User.findByIdAndUpdate(id, updateData, { new: true });

    const tenantId = getTenantId(req) || clerk.tenantId || 'tenant_default_001';

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'EDIT_CLERK',
      details: `Updated clerk account details for ${name || clerk.name}.`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update clerk.' });
  }
}

export async function deleteClerk(req, res) {
  try {
    const { id } = req.params;
    const clerk = await User.findById(id);
    if (!clerk || (clerk.role !== 'Clerk' && clerk.role?.toLowerCase() !== 'clerk')) {
      return res.status(404).json({ error: 'Clerk not found.' });
    }
    if (!assertTenantOwnership(req, clerk)) return res.status(404).json({ error: 'Clerk not found.' });

    const tenantId = getTenantId(req) || clerk.tenantId || 'tenant_default_001';
    const now = new Date();
    const deletedBy = req.user ? (req.user.name || req.user.email) : 'Admin';

    await User.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: now,
      deletedBy
    });

    try {
      await AuditLog.create({
        tenantId,
        userId: req.user ? (req.user.id || req.user._id || 'admin_id') : 'admin_id',
        userName: req.user ? (req.user.name || 'Admin') : 'Admin',
        userRole: req.user ? (req.user.role || 'Admin') : 'Admin',
        action: 'DELETE_CLERK',
        details: `Soft deleted clerk account ${clerk.name} (${clerk.email}).`,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.error('Audit log failed during delete clerk:', auditErr);
    }

    res.json({ message: 'Clerk account soft-deleted successfully.' });
  } catch (err) {
    console.error('Error deleting clerk:', err);
    res.status(500).json({ error: err.message || 'Failed to delete clerk.' });
  }
}

// --- SUPPLIERS ---
async function hasPartyTransactions(req, partyType, partyId) {
  const tenantQuery = buildTenantQuery(req);
  const ledgerQuery = { ...tenantQuery, partyId: String(partyId), partyType };
  const [payments, ledgers, purchasesOrSales] = await Promise.all([
    Payment.findOne({ ...tenantQuery, partyId: String(partyId), partyType }),
    Ledger.find(ledgerQuery),
    partyType === 'Supplier'
      ? StockEntry.findOne({ ...tenantQuery, supplierId: String(partyId) })
      : Sale.findOne({ ...tenantQuery, customerId: String(partyId) }),
  ]);

  return Boolean(
    payments || purchasesOrSales ||
    ledgers.some(entry => String(entry.description || '').trim().toLowerCase() !== 'opening balance')
  );
}

async function withOpeningBalanceLock(req, parties, partyType) {
  if (!parties.length) return [];

  const ids = parties.map(party => String(party.id || party._id));
  const tenantQuery = buildTenantQuery(req);
  const [payments, ledgers, purchasesOrSales] = await Promise.all([
    Payment.find({ ...tenantQuery, partyId: { $in: ids }, partyType }),
    Ledger.find({ ...tenantQuery, partyId: { $in: ids }, partyType }),
    partyType === 'Supplier'
      ? StockEntry.find({ ...tenantQuery, supplierId: { $in: ids } })
      : Sale.find({ ...tenantQuery, customerId: { $in: ids } }),
  ]);
  const activeIds = new Set([
    ...payments.map(entry => String(entry.partyId)),
    ...purchasesOrSales.map(entry => String(partyType === 'Supplier' ? entry.supplierId : entry.customerId)),
    ...ledgers
      .filter(entry => String(entry.description || '').trim().toLowerCase() !== 'opening balance')
      .map(entry => String(entry.partyId)),
  ]);

  return parties.map(party => ({
    ...party,
    openingBalanceLocked: activeIds.has(String(party.id || party._id)),
  }));
}

async function updateOpeningBalanceLedger(req, party, partyType, balance) {
  const tenantId = getTenantId(req) || party.tenantId || 'tenant_default_001';
  const partyId = String(party.id || party._id);
  const openingEntries = await Ledger.find({
    ...buildTenantQuery(req),
    partyId,
    partyType,
    description: 'Opening Balance',
  });

  if (Number(balance) === 0) {
    await Promise.all(openingEntries.map(entry => Ledger.findByIdAndDelete(entry.id || entry._id)));
    return;
  }

  const openingEntry = {
    tenantId,
    partyId,
    partyType,
    date: openingEntries[0]?.date || new Date().toISOString().split('T')[0],
    type: partyType === 'Supplier'
      ? (balance < 0 ? 'Credit' : 'Debit')
      : (balance > 0 ? 'Debit' : 'Credit'),
    amount: Math.abs(balance),
    balanceAfter: balance,
    description: 'Opening Balance',
  };

  if (openingEntries.length) {
    await Ledger.findByIdAndUpdate(openingEntries[0].id || openingEntries[0]._id, openingEntry);
    await Promise.all(openingEntries.slice(1).map(entry => Ledger.findByIdAndDelete(entry.id || entry._id)));
  } else {
    await Ledger.create(openingEntry);
  }
}

export async function getSuppliers(req, res) {
  try {
    const suppliers = await Supplier.find(buildTenantQuery(req, { isDeleted: { $ne: true } }));
    res.json(await withOpeningBalanceLock(req, suppliers, 'Supplier'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suppliers.' });
  }
}

export async function getSupplier(req, res) {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findOne(buildTenantQuery(req, { _id: id, isDeleted: { $ne: true } }));
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }
    res.json({ ...supplier, openingBalanceLocked: await hasPartyTransactions(req, 'Supplier', id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch supplier.' });
  }
}

// Preview Next Khata ID
export async function getNextSupplierKhataId(req, res) {
  try {
    const tenantId = getTenantId(req) || 'tenant_default_001';
    const preview = await peekNextKhataId(tenantId, 'Supplier');
    res.json(preview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate next Supplier Khata ID preview.' });
  }
}

export async function addSupplier(req, res) {
  try {
    const { name, email, password, phone, address, cnic, currentBalance, khataId: customKhataId } = req.body;
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!name || !phone) {
      return res.status(400).json({ error: 'Please provide Beopari Name and phone number.' });
    }

    // Determine Khata ID (manual or atomic auto-generation)
    let finalKhataId = '';
    if (customKhataId && customKhataId.trim() !== '') {
      finalKhataId = customKhataId.trim().toUpperCase();
      const isUnique = await isKhataIdUnique(tenantId, 'Supplier', finalKhataId);
      if (!isUnique) {
        return res.status(400).json({ error: `Khata ID "${finalKhataId}" is already in use for another supplier in this business.` });
      }
      await syncCounterIfNeeded(tenantId, 'Supplier', finalKhataId);
    } else {
      const generated = await getNextKhataId(tenantId, 'Supplier');
      finalKhataId = generated.khataId;
    }

    if (email && email.trim()) {
      const existingUser = await User.findOne({ email: email.trim() });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered.' });
      }
    }

    let hashedPassword = '';
    if (password && password.trim()) {
      const salt = bcryptjs.genSaltSync(10);
      hashedPassword = bcryptjs.hashSync(password, salt);
    }

    const userData = {
      tenantId,
      name,
      phone,
      address,
      khataId: finalKhataId,
      role: 'Supplier',
      status: 'Active',
    };

    if (email && email.trim()) {
      userData.email = email.trim();
    }
    if (hashedPassword) {
      userData.password = hashedPassword;
    }

    const user = await User.create(userData);

    const initBalance = Number(currentBalance) || 0;

    const supplier = await Supplier.create({
      tenantId,
      userId: user ? (user.id || user._id) : null,
      khataId: finalKhataId,
      name,
      phone,
      address,
      cnic,
      currentBalance: initBalance,
      totalSupplied: 0,
      totalPaid: 0,
      remainingBalance: initBalance,
    });

    // Create initial ledger entry if balance is non-zero
    if (initBalance !== 0) {
      await Ledger.create({
        tenantId,
        partyId: supplier.id || supplier._id,
        partyType: 'Supplier',
        date: new Date().toISOString().split('T')[0],
        type: initBalance < 0 ? 'Credit' : 'Debit',
        amount: Math.abs(initBalance),
        balanceAfter: initBalance,
        description: 'Opening Balance',
      });
    }

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ADD_SUPPLIER',
      details: `Created supplier ${name} (Khata ID: ${finalKhataId})${email ? ` and linked account ${email}` : ''}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(supplier);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create supplier profile.' });
  }
}

export async function editSupplier(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password, phone, address, cnic, currentBalance, khataId: customKhataId } = req.body;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }
    if (!assertTenantOwnership(req, supplier)) return res.status(404).json({ error: 'Supplier not found.' });

    const hasTransactions = await hasPartyTransactions(req, 'Supplier', id);
    const canUpdateOpeningBalance = currentBalance !== undefined && Number.isFinite(Number(currentBalance));
    if (hasTransactions && canUpdateOpeningBalance && Number(currentBalance) !== Number(supplier.currentBalance || 0)) {
      return res.status(400).json({ error: 'Opening balance cannot be changed after a purchase or financial transaction has been recorded.' });
    }

    const tenantId = getTenantId(req) || supplier.tenantId || 'tenant_default_001';
    let updatedKhataId = supplier.khataId;
    let khataIdChanged = false;

    if (customKhataId !== undefined && customKhataId.trim() !== '') {
      const cleanKhataId = customKhataId.trim().toUpperCase();
      if (cleanKhataId !== (supplier.khataId || '')) {
        const isUnique = await isKhataIdUnique(tenantId, 'Supplier', cleanKhataId, id);
        if (!isUnique) {
          return res.status(400).json({ error: `Khata ID "${cleanKhataId}" is already assigned to another supplier.` });
        }
        await syncCounterIfNeeded(tenantId, 'Supplier', cleanKhataId);
        updatedKhataId = cleanKhataId;
        khataIdChanged = true;
      }
    }

    // Update supplier info
    const nextBalance = !hasTransactions && canUpdateOpeningBalance ? Number(currentBalance) : supplier.currentBalance;
    const updatedSupplier = await Supplier.findByIdAndUpdate(id, {
      name,
      phone,
      address,
      cnic,
      khataId: updatedKhataId,
      currentBalance: nextBalance,
      remainingBalance: !hasTransactions && canUpdateOpeningBalance ? Number(currentBalance) : supplier.remainingBalance,
    }, { new: true });

    if (!hasTransactions && canUpdateOpeningBalance && Number(currentBalance) !== Number(supplier.currentBalance || 0)) {
      await updateOpeningBalanceLedger(req, supplier, 'Supplier', Number(currentBalance));
    }

    // Update linked user info
    if (supplier.userId) {
      const userUpdate = { name, phone, address, khataId: updatedKhataId };
      if (email !== undefined) {
        if (email && email.trim()) {
          const duplicate = await User.findOne({ email: email.trim().toLowerCase() });
          if (!duplicate || duplicate.id === supplier.userId || duplicate._id?.toString() === supplier.userId) {
            userUpdate.email = email.trim().toLowerCase();
          }
        } else {
          userUpdate.email = undefined;
          userUpdate.$unset = { email: "" };
        }
      }
      if (password && password.trim()) {
        const salt = bcryptjs.genSaltSync(10);
        userUpdate.password = bcryptjs.hashSync(password, salt);
      }
      await User.findByIdAndUpdate(supplier.userId, userUpdate);
    }

    const auditDetails = khataIdChanged 
      ? `Updated supplier profile ${name || supplier.name}. Changed Khata ID from "${supplier.khataId || 'None'}" to "${updatedKhataId}".`
      : `Updated supplier profile details for ${name || supplier.name}.`;

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'EDIT_SUPPLIER',
      details: auditDetails,
      timestamp: new Date().toISOString(),
    });

    res.json(updatedSupplier);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update supplier profile.' });
  }
}

export async function deleteSupplier(req, res) {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }
    if (!assertTenantOwnership(req, supplier)) return res.status(404).json({ error: 'Supplier not found.' });

    // Check if supplier has any linked data across the system
    const linkedCheck = await getSupplierLinkedData(id, req);
    if (linkedCheck.hasLinkedData) {
      return res.status(400).json({ 
        error: `Cannot delete supplier "${supplier.name}". This supplier has active or historical data linked in the system (${linkedCheck.reasons.join(', ')}). Deletion is blocked to ensure accounting and transactional data integrity.`,
        linkedReasons: linkedCheck.reasons,
        counts: linkedCheck.counts
      });
    }

    const tenantId = getTenantId(req) || supplier.tenantId || 'tenant_default_001';
    const now = new Date();
    const deletedBy = req.user ? (req.user.name || req.user.email) : 'Admin';

    // Soft Delete linked User
    if (supplier.userId) {
      await User.findByIdAndUpdate(supplier.userId, {
        isDeleted: true,
        deletedAt: now,
        deletedBy
      });
    }

    // Soft Delete Supplier
    await Supplier.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: now,
      deletedBy
    });

    try {
      await AuditLog.create({
        tenantId,
        userId: req.user ? (req.user.id || req.user._id || 'admin_id') : 'admin_id',
        userName: req.user ? (req.user.name || 'Admin') : 'Admin',
        userRole: req.user ? (req.user.role || 'Admin') : 'Admin',
        action: 'DELETE_SUPPLIER',
        details: `Soft deleted supplier ${supplier.name} and disabled associated login account.`,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.error('Audit log failed during delete supplier:', auditErr);
    }

    res.json({ message: 'Supplier deleted successfully.' });
  } catch (err) {
    console.error('Error deleting supplier:', err);
    res.status(500).json({ error: err.message || 'Failed to delete supplier.' });
  }
}

// --- CUSTOMERS ---
export async function getCustomers(req, res) {
  try {
    const customers = await Customer.find(buildTenantQuery(req, { isDeleted: { $ne: true } }));
    res.json(await withOpeningBalanceLock(req, customers, 'Customer'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers.' });
  }
}

export async function getCustomer(req, res) {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne(buildTenantQuery(req, { _id: id, isDeleted: { $ne: true } }));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    res.json({ ...customer, openingBalanceLocked: await hasPartyTransactions(req, 'Customer', id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer.' });
  }
}

// Preview Next Customer Khata ID
export async function getNextCustomerKhataId(req, res) {
  try {
    const tenantId = getTenantId(req) || 'tenant_default_001';
    const preview = await peekNextKhataId(tenantId, 'Customer');
    res.json(preview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate next Customer Khata ID preview.' });
  }
}

export async function addCustomer(req, res) {
  try {
    const { name, email, password, phone, address, referenceBy, currentBalance, khataId: customKhataId } = req.body;
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!name || !phone) {
      return res.status(400).json({ error: 'Please provide customer name and phone number.' });
    }

    // Determine Khata ID (manual or atomic auto-generation)
    let finalKhataId = '';
    if (customKhataId && customKhataId.trim() !== '') {
      finalKhataId = customKhataId.trim().toUpperCase();
      const isUnique = await isKhataIdUnique(tenantId, 'Customer', finalKhataId);
      if (!isUnique) {
        return res.status(400).json({ error: `Khata ID "${finalKhataId}" is already in use for another customer in this business.` });
      }
      await syncCounterIfNeeded(tenantId, 'Customer', finalKhataId);
    } else {
      const generated = await getNextKhataId(tenantId, 'Customer');
      finalKhataId = generated.khataId;
    }

    if (email && email.trim()) {
      const existingUser = await User.findOne({ email: email.trim() });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered.' });
      }
    }

    let hashedPassword = '';
    if (password && password.trim()) {
      const salt = bcryptjs.genSaltSync(10);
      hashedPassword = bcryptjs.hashSync(password, salt);
    }

    const userData = {
      tenantId,
      name,
      phone,
      address,
      khataId: finalKhataId,
      role: 'Customer',
      status: 'Active',
    };

    if (email && email.trim()) {
      userData.email = email.trim();
    }
    if (hashedPassword) {
      userData.password = hashedPassword;
    }

    const user = await User.create(userData);

    const initBalance = Number(currentBalance) || 0;

    const customer = await Customer.create({
      tenantId,
      userId: user ? (user.id || user._id) : null,
      khataId: finalKhataId,
      name,
      phone,
      address,
      referenceBy: referenceBy || '',
      currentBalance: initBalance,
      totalPurchases: 0,
      totalPaid: 0,
      remainingBalance: initBalance,
    });

    // Opening ledger entry
    if (initBalance !== 0) {
      await Ledger.create({
        tenantId,
        partyId: customer.id || customer._id,
        partyType: 'Customer',
        date: new Date().toISOString().split('T')[0],
        type: initBalance > 0 ? 'Debit' : 'Credit',
        amount: Math.abs(initBalance),
        balanceAfter: initBalance,
        description: 'Opening Balance',
      });
    }

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ADD_CUSTOMER',
      details: `Created customer ${name} (Khata ID: ${finalKhataId})${email ? ` and linked account ${email}` : ''}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create customer.' });
  }
}

export async function editCustomer(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password, phone, address, referenceBy, currentBalance, khataId: customKhataId } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    if (!assertTenantOwnership(req, customer)) return res.status(404).json({ error: 'Customer not found.' });

    const hasTransactions = await hasPartyTransactions(req, 'Customer', id);
    const canUpdateOpeningBalance = currentBalance !== undefined && Number.isFinite(Number(currentBalance));
    if (hasTransactions && canUpdateOpeningBalance && Number(currentBalance) !== Number(customer.currentBalance || 0)) {
      return res.status(400).json({ error: 'Opening balance cannot be changed after a purchase or financial transaction has been recorded.' });
    }

    const tenantId = getTenantId(req) || customer.tenantId || 'tenant_default_001';
    let updatedKhataId = customer.khataId;
    let khataIdChanged = false;

    if (customKhataId !== undefined && customKhataId.trim() !== '') {
      const cleanKhataId = customKhataId.trim().toUpperCase();
      if (cleanKhataId !== (customer.khataId || '')) {
        const isUnique = await isKhataIdUnique(tenantId, 'Customer', cleanKhataId, id);
        if (!isUnique) {
          return res.status(400).json({ error: `Khata ID "${cleanKhataId}" is already assigned to another customer.` });
        }
        await syncCounterIfNeeded(tenantId, 'Customer', cleanKhataId);
        updatedKhataId = cleanKhataId;
        khataIdChanged = true;
      }
    }

    // Update customer info
    const nextBalance = !hasTransactions && canUpdateOpeningBalance ? Number(currentBalance) : customer.currentBalance;
    const updatedCustomer = await Customer.findByIdAndUpdate(id, {
      name,
      phone,
      address,
      khataId: updatedKhataId,
      referenceBy: referenceBy !== undefined ? referenceBy : customer.referenceBy,
      currentBalance: nextBalance,
      remainingBalance: !hasTransactions && canUpdateOpeningBalance ? Number(currentBalance) : customer.remainingBalance,
    }, { new: true });

    if (!hasTransactions && canUpdateOpeningBalance && Number(currentBalance) !== Number(customer.currentBalance || 0)) {
      await updateOpeningBalanceLedger(req, customer, 'Customer', Number(currentBalance));
    }

    // Update linked user
    if (customer.userId) {
      const userUpdate = { name, phone, address, khataId: updatedKhataId };
      if (email !== undefined) {
        if (email && email.trim()) {
          const duplicate = await User.findOne({ email: email.trim().toLowerCase() });
          if (!duplicate || duplicate.id === customer.userId || duplicate._id?.toString() === customer.userId) {
            userUpdate.email = email.trim().toLowerCase();
          }
        } else {
          userUpdate.email = undefined;
          userUpdate.$unset = { email: "" };
        }
      }
      if (password && password.trim()) {
        const salt = bcryptjs.genSaltSync(10);
        userUpdate.password = bcryptjs.hashSync(password, salt);
      }
      await User.findByIdAndUpdate(customer.userId, userUpdate);
    }

    const auditDetails = khataIdChanged
      ? `Updated customer profile ${name || customer.name}. Changed Khata ID from "${customer.khataId || 'None'}" to "${updatedKhataId}".`
      : `Updated customer profile details for ${name || customer.name}.`;

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'EDIT_CUSTOMER',
      details: auditDetails,
      timestamp: new Date().toISOString(),
    });

    res.json(updatedCustomer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update customer.' });
  }
}

export async function deleteCustomer(req, res) {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    if (!assertTenantOwnership(req, customer)) return res.status(404).json({ error: 'Customer not found.' });

    // Check if customer has any linked data across the system
    const linkedCheck = await getCustomerLinkedData(id, req);
    if (linkedCheck.hasLinkedData) {
      return res.status(400).json({ 
        error: `Cannot delete customer "${customer.name}". This customer has active or historical data linked in the system (${linkedCheck.reasons.join(', ')}). Deletion is blocked to ensure accounting and transactional data integrity.`,
        linkedReasons: linkedCheck.reasons,
        counts: linkedCheck.counts
      });
    }

    const tenantId = getTenantId(req) || customer.tenantId || 'tenant_default_001';
    const now = new Date();
    const deletedBy = req.user ? (req.user.name || req.user.email) : 'Admin';

    if (customer.userId) {
      await User.findByIdAndUpdate(customer.userId, {
        isDeleted: true,
        deletedAt: now,
        deletedBy
      });
    }

    await Customer.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: now,
      deletedBy
    });

    try {
      await AuditLog.create({
        tenantId,
        userId: req.user ? (req.user.id || req.user._id || 'admin_id') : 'admin_id',
        userName: req.user ? (req.user.name || 'Admin') : 'Admin',
        userRole: req.user ? (req.user.role || 'Admin') : 'Admin',
        action: 'DELETE_CUSTOMER',
        details: `Soft deleted customer ${customer.name} and disabled associated login account.`,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.error('Audit log failed during delete customer:', auditErr);
    }

    res.json({ message: 'Customer deleted successfully.' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ error: err.message || 'Failed to delete customer.' });
  }
}

// --- DELETED USERS / TRASH & RESTORE ---

export async function getDeletedUsers(req, res) {
  try {
    const tenantQuery = buildTenantQuery(req, { isDeleted: true });

    const [deletedUsers, deletedSuppliers, deletedCustomers, deletedEmployees] = await Promise.all([
      User.find(tenantQuery),
      Supplier.find(tenantQuery),
      Customer.find(tenantQuery),
      Employee.find(tenantQuery)
    ]);

    const result = [];
    const handledUserIds = new Set();

    // 1. Process Suppliers
    for (const s of deletedSuppliers) {
      if (s.userId) handledUserIds.add(s.userId.toString());
      result.push({
        id: s.id || s._id,
        entityId: s.id || s._id,
        userId: s.userId,
        name: s.name,
        role: 'Supplier',
        userType: 'Supplier',
        phone: s.phone || 'N/A',
        email: 'N/A',
        deletedAt: s.deletedAt || s.updatedAt,
        deletedBy: s.deletedBy || 'Admin',
        entityType: 'Supplier',
      });
    }

    // 2. Process Customers
    for (const c of deletedCustomers) {
      if (c.userId) handledUserIds.add(c.userId.toString());
      result.push({
        id: c.id || c._id,
        entityId: c.id || c._id,
        userId: c.userId,
        name: c.name,
        role: 'Customer',
        userType: 'Customer',
        phone: c.phone || 'N/A',
        email: 'N/A',
        deletedAt: c.deletedAt || c.updatedAt,
        deletedBy: c.deletedBy || 'Admin',
        entityType: 'Customer',
      });
    }

    // 3. Process Employees
    for (const e of deletedEmployees) {
      result.push({
        id: e.id || e._id,
        entityId: e.id || e._id,
        name: e.name,
        role: e.designation || 'Employee',
        userType: 'Employee',
        phone: e.phone || 'N/A',
        email: e.email || 'N/A',
        deletedAt: e.deletedAt || e.updatedAt,
        deletedBy: e.deletedBy || 'Admin',
        entityType: 'Employee',
      });
    }

    // 4. Process User Accounts (e.g. Clerks, Admins)
    for (const u of deletedUsers) {
      const uId = (u.id || u._id).toString();
      if (handledUserIds.has(uId)) {
        // Link email to supplier/customer entry
        const existingItem = result.find(r => r.userId?.toString() === uId);
        if (existingItem && u.email) {
          existingItem.email = u.email;
        }
        continue;
      }
      result.push({
        id: uId,
        entityId: uId,
        name: u.name,
        role: u.role || 'Clerk',
        userType: u.role || 'Clerk',
        phone: u.phone || 'N/A',
        email: u.email || 'N/A',
        deletedAt: u.deletedAt || u.updatedAt,
        deletedBy: u.deletedBy || 'Admin',
        entityType: 'User',
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Error in getDeletedUsers:', err);
    res.status(500).json({ error: 'Failed to fetch deleted users.' });
  }
}

export async function restoreUser(req, res) {
  try {
    const { id } = req.params;
    const { entityType } = req.body || {};
    const tenantId = getTenantId(req) || 'tenant_default_001';

    let targetType = entityType;
    let restoredName = '';

    // Auto-detect entity type if not provided
    if (!targetType) {
      const supplier = await Supplier.findById(id);
      if (supplier) targetType = 'Supplier';
      else {
        const customer = await Customer.findById(id);
        if (customer) targetType = 'Customer';
        else {
          const employee = await Employee.findById(id);
          if (employee) targetType = 'Employee';
          else targetType = 'User';
        }
      }
    }

    if (targetType === 'Supplier') {
      const supplier = await Supplier.findById(id);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      if (!assertTenantOwnership(req, supplier)) return res.status(404).json({ error: 'Supplier not found.' });
      restoredName = supplier.name;

      await Supplier.findByIdAndUpdate(id, { isDeleted: false, deletedAt: null, deletedBy: null });
      if (supplier.userId) {
        const user = await User.findById(supplier.userId);
        if (user && user.email) {
          const activeUser = await User.findOne({
            email: user.email.trim(),
            isDeleted: { $ne: true },
            _id: { $ne: user.id || user._id }
          });
          if (activeUser) {
            return res.status(400).json({ error: `Cannot restore: an active user with email "${user.email}" already exists.` });
          }
        }
        if (user) {
          await User.findByIdAndUpdate(supplier.userId, { isDeleted: false, deletedAt: null, deletedBy: null });
        }
      }
    } else if (targetType === 'Customer') {
      const customer = await Customer.findById(id);
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      if (!assertTenantOwnership(req, customer)) return res.status(404).json({ error: 'Customer not found.' });
      restoredName = customer.name;

      await Customer.findByIdAndUpdate(id, { isDeleted: false, deletedAt: null, deletedBy: null });
      if (customer.userId) {
        const user = await User.findById(customer.userId);
        if (user && user.email) {
          const activeUser = await User.findOne({
            email: user.email.trim(),
            isDeleted: { $ne: true },
            _id: { $ne: user.id || user._id }
          });
          if (activeUser) {
            return res.status(400).json({ error: `Cannot restore: an active user with email "${user.email}" already exists.` });
          }
        }
        if (user) {
          await User.findByIdAndUpdate(customer.userId, { isDeleted: false, deletedAt: null, deletedBy: null });
        }
      }
    } else if (targetType === 'Employee') {
      const employee = await Employee.findById(id);
      if (!employee) return res.status(404).json({ error: 'Employee not found.' });
      if (!assertTenantOwnership(req, employee)) return res.status(404).json({ error: 'Employee not found.' });
      restoredName = employee.name;

      await Employee.findByIdAndUpdate(id, { isDeleted: false, deletedAt: null, deletedBy: null });
    } else {
      // User account (e.g. Clerk / Admin)
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: 'User not found.' });
      if (!assertTenantOwnership(req, user)) return res.status(404).json({ error: 'User not found.' });
      restoredName = user.name;

      if (user.email) {
        const activeUser = await User.findOne({
          email: user.email.trim(),
          isDeleted: { $ne: true },
          _id: { $ne: user.id || user._id }
        });
        if (activeUser) {
          return res.status(400).json({ error: `Cannot restore: an active user with email "${user.email}" already exists.` });
        }
      }

      await User.findByIdAndUpdate(id, { isDeleted: false, deletedAt: null, deletedBy: null });

      // Restore linked Supplier or Customer if exists
      const linkedSupplier = await Supplier.findOne({ userId: id });
      if (linkedSupplier) {
        await Supplier.findByIdAndUpdate(linkedSupplier.id || linkedSupplier._id, { isDeleted: false, deletedAt: null, deletedBy: null });
      }
      const linkedCustomer = await Customer.findOne({ userId: id });
      if (linkedCustomer) {
        await Customer.findByIdAndUpdate(linkedCustomer.id || linkedCustomer._id, { isDeleted: false, deletedAt: null, deletedBy: null });
      }
    }

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'Admin',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'RESTORE_USER',
      details: `Restored ${targetType} account: ${restoredName}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: `${targetType} "${restoredName}" restored successfully.` });
  } catch (err) {
    console.error('Error restoring user:', err);
    res.status(500).json({ error: 'Failed to restore user.' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const now = new Date();
    const deletedBy = req.user ? (req.user.name || req.user.email) : 'Admin';
    const tenantId = getTenantId(req) || 'tenant_default_001';

    let deletedName = '';
    let found = false;

    // 1. Try User model
    const user = await User.findById(id);
    if (user) {
      if (!assertTenantOwnership(req, user)) return res.status(404).json({ error: 'User not found.' });
      found = true;
      deletedName = user.name || user.email;

      // If user is a Supplier, check linked data
      if (user.role === 'Supplier') {
        const linkedSup = await Supplier.findOne({ userId: id }) || await Supplier.findOne({ phone: user.phone });
        if (linkedSup) {
          const supCheck = await getSupplierLinkedData(linkedSup.id || linkedSup._id, req);
          if (supCheck.hasLinkedData) {
            return res.status(400).json({
              error: `Cannot delete supplier user "${user.name}". This supplier has active or historical data linked in the application (${supCheck.reasons.join(', ')}). Deletion is blocked to preserve data integrity.`,
              linkedReasons: supCheck.reasons,
              counts: supCheck.counts
            });
          }
        }
      }

      // If user is a Customer, check linked data
      if (user.role === 'Customer') {
        const linkedCust = await Customer.findOne({ userId: id }) || await Customer.findOne({ phone: user.phone });
        if (linkedCust) {
          const custCheck = await getCustomerLinkedData(linkedCust.id || linkedCust._id, req);
          if (custCheck.hasLinkedData) {
            return res.status(400).json({
              error: `Cannot delete customer user "${user.name}". This customer has active or historical data linked in the application (${custCheck.reasons.join(', ')}). Deletion is blocked to preserve data integrity.`,
              linkedReasons: custCheck.reasons,
              counts: custCheck.counts
            });
          }
        }
      }

      await User.findByIdAndUpdate(id, { isDeleted: true, deletedAt: now, deletedBy });

      const linkedSupplier = await Supplier.findOne({ userId: id });
      if (linkedSupplier) {
        if (!assertTenantOwnership(req, linkedSupplier)) return res.status(404).json({ error: 'User not found.' });
        await Supplier.findByIdAndUpdate(linkedSupplier.id || linkedSupplier._id, { isDeleted: true, deletedAt: now, deletedBy });
      }
      const linkedCustomer = await Customer.findOne({ userId: id });
      if (linkedCustomer) {
        if (!assertTenantOwnership(req, linkedCustomer)) return res.status(404).json({ error: 'User not found.' });
        await Customer.findByIdAndUpdate(linkedCustomer.id || linkedCustomer._id, { isDeleted: true, deletedAt: now, deletedBy });
      }
    }

    // 2. Try Supplier model
    if (!found) {
      const supplier = await Supplier.findById(id);
      if (supplier) {
        if (!assertTenantOwnership(req, supplier)) return res.status(404).json({ error: 'User record not found.' });
        found = true;
        deletedName = supplier.name;

        const supCheck = await getSupplierLinkedData(id, req);
        if (supCheck.hasLinkedData) {
          return res.status(400).json({
            error: `Cannot delete supplier "${supplier.name}". This supplier has active or historical data linked in the application (${supCheck.reasons.join(', ')}). Deletion is blocked to preserve data integrity.`,
            linkedReasons: supCheck.reasons,
            counts: supCheck.counts
          });
        }

        await Supplier.findByIdAndUpdate(id, { isDeleted: true, deletedAt: now, deletedBy });
        if (supplier.userId) {
          await User.findByIdAndUpdate(supplier.userId, { isDeleted: true, deletedAt: now, deletedBy });
        }
      }
    }

    // 3. Try Customer model
    if (!found) {
      const customer = await Customer.findById(id);
      if (customer) {
        if (!assertTenantOwnership(req, customer)) return res.status(404).json({ error: 'User record not found.' });
        found = true;
        deletedName = customer.name;

        const custCheck = await getCustomerLinkedData(id, req);
        if (custCheck.hasLinkedData) {
          return res.status(400).json({
            error: `Cannot delete customer "${customer.name}". This customer has active or historical data linked in the application (${custCheck.reasons.join(', ')}). Deletion is blocked to preserve data integrity.`,
            linkedReasons: custCheck.reasons,
            counts: custCheck.counts
          });
        }

        await Customer.findByIdAndUpdate(id, { isDeleted: true, deletedAt: now, deletedBy });
        if (customer.userId) {
          await User.findByIdAndUpdate(customer.userId, { isDeleted: true, deletedAt: now, deletedBy });
        }
      }
    }

    // 4. Try Employee model
    if (!found) {
      const employee = await Employee.findById(id);
      if (employee) {
        if (!assertTenantOwnership(req, employee)) return res.status(404).json({ error: 'User record not found.' });
        found = true;
        deletedName = employee.name;
        await Employee.findByIdAndUpdate(id, { isDeleted: true, deletedAt: now, deletedBy });
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    try {
      await AuditLog.create({
        tenantId,
        userId: req.user ? (req.user.id || req.user._id || 'admin_id') : 'admin_id',
        userName: req.user ? (req.user.name || 'Admin') : 'Admin',
        userRole: req.user ? (req.user.role || 'Admin') : 'Admin',
        action: 'DELETE_USER',
        details: `Soft deleted user account: ${deletedName} (ID: ${id}).`,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.error('AuditLog failed during deleteUser:', auditErr);
    }

    res.json({ message: `User "${deletedName}" soft-deleted successfully.` });
  } catch (err) {
    console.error('Error in deleteUser:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
}
