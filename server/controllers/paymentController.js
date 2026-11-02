import { Payment, Supplier, Customer, Ledger, AuditLog, OwnTradingPurchase } from '../models/index.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';
import { sanitizeCustomerData } from '../utils/customerDataAccess.js';

export async function getPayments(req, res) {
  try {
    let query = buildTenantQuery(req);
    if (req.user?.role === 'Customer') {
      const customer = await Customer.findOne(buildTenantQuery(req, { userId: req.user.id }));
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      query = buildTenantQuery(req, { partyId: String(customer.id || customer._id), partyType: 'Customer' });
    }
    const payments = await Payment.find(query);
    const ledgers = await Ledger.find(buildTenantQuery(req));
    const withBalanceSnapshots = payments.map((payment) => {
      if (Number.isFinite(Number(payment.balanceBefore)) && Number.isFinite(Number(payment.balanceAfter))) return payment;
      const expectedLedgerType = payment.partyType === 'Supplier' ? 'Debit' : 'Credit';
      const candidates = ledgers.filter((entry) =>
        entry.partyType === payment.partyType &&
        String(entry.partyId) === String(payment.partyId) &&
        String(entry.date).slice(0, 10) === String(payment.date).slice(0, 10) &&
        entry.type === expectedLedgerType &&
        Math.abs((Number(entry.amount) || 0) - (Number(payment.amount) || 0)) < 0.01
      );
      candidates.sort((a, b) => {
        const paymentTime = new Date(payment.createdAt || payment.date).getTime();
        return Math.abs(new Date(a.createdAt || a.date).getTime() - paymentTime)
          - Math.abs(new Date(b.createdAt || b.date).getTime() - paymentTime);
      });
      const ledgerEntry = candidates[0];
      if (!ledgerEntry) return payment;
      const balanceAfter = Number(ledgerEntry.balanceAfter) || 0;
      const ledgerDelta = payment.partyType === 'Supplier'
        ? (Number(payment.amount) || 0)
        : -(Number(payment.amount) || 0);
      return { ...payment, balanceBefore: balanceAfter - ledgerDelta, balanceAfter };
    });
    res.json(req.user?.role === 'Customer' ? sanitizeCustomerData(withBalanceSnapshots) : withBalanceSnapshots);
  } catch {
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
}

export async function addPayment(req, res) {
  try {
    const { partyId, partyType, amount, date, description, paymentMethod, ownTradingPurchaseId } = req.body;
    const idempotencyKey = String(req.body.idempotencyKey || '').trim();
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!partyId || !partyType || amount === undefined || !date) {
      return res.status(400).json({ error: 'Please provide party, party type, amount, and date.' });
    }

    const payAmount = Number(amount);
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be a positive number.' });
    }
    if (ownTradingPurchaseId && !idempotencyKey) {
      return res.status(400).json({ error: 'An idempotency key is required for Own Trading payments.' });
    }
    if (ownTradingPurchaseId) {
      const duplicatePayment = await Payment.findOne({ ...buildTenantQuery(req), idempotencyKey });
      if (duplicatePayment) {
        return res.status(200).json({
          message: 'Payment was already recorded.', payment: duplicatePayment, duplicate: true,
          party: { id: String(duplicatePayment.partyId), name: duplicatePayment.partyName || '', partyType: duplicatePayment.partyType },
          balanceBefore: duplicatePayment.balanceBefore, balanceAfter: duplicatePayment.balanceAfter,
        });
      }
    }
    let ownTradingPurchase = null;
    let ownTradingAllocationType;
    let ownTradingAllocations = [];
    if (ownTradingPurchaseId) {
      ownTradingPurchase = await OwnTradingPurchase.findById(ownTradingPurchaseId);
      if (!ownTradingPurchase || !assertTenantOwnership(req, ownTradingPurchase) || ownTradingPurchase.status !== 'Posted') {
        return res.status(404).json({ error: 'Own Trading purchase not found.' });
      }
      if (partyType === 'Supplier') {
        const supplierBalance = (ownTradingPurchase.supplierBalances || []).find(balance => String(balance.supplierId) === String(partyId));
        if (!supplierBalance || payAmount > Number(supplierBalance.outstandingPayable || 0)) {
          return res.status(400).json({ error: 'Payment cannot exceed the outstanding payable for this Own Trading purchase.' });
        }
        ownTradingAllocationType = 'Supplier Payable';
      } else if (partyType === 'Customer') {
        let remaining = payAmount;
        for (const balance of ownTradingPurchase.customerBalances || []) {
          if (String(balance.customerId) !== String(partyId) || remaining <= 0) continue;
          const allocation = Math.min(remaining, Math.max(0, Number(balance.outstandingReceivable) || 0));
          if (allocation > 0) {
            ownTradingAllocations.push({ stockEntryId: balance.stockEntryId, amount: allocation });
            remaining = Math.round((remaining - allocation) * 100) / 100;
          }
        }
        if (remaining > 0.009) return res.status(400).json({ error: 'Payment cannot exceed this customer’s outstanding Own Trading receivable.' });
        ownTradingAllocationType = 'Customer Receivable';
      }
    }
    let partyName = '';
    let newBalance = 0;
    let balanceBefore = 0;
    let createdPayment;
    let partyPhone = '';
    const selectedMethod = paymentMethod || 'Cash';

    if (partyType === 'Supplier') {
      const supplier = await Supplier.findById(partyId);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found.' });
      }
      if (!assertTenantOwnership(req, supplier)) return res.status(404).json({ error: 'Supplier not found.' });
      partyName = supplier.name;
      partyPhone = supplier.phone || '';
      balanceBefore = Number(supplier.currentBalance) || 0;

      // When we pay a supplier, our debt reduces. Supplier's balance increases (goes up/gets less negative).
      newBalance = supplier.currentBalance + payAmount;
      await Supplier.findByIdAndUpdate(partyId, {
        totalPaid: supplier.totalPaid + payAmount,
        currentBalance: newBalance,
        remainingBalance: newBalance,
      });

      // Credit means stock supplied, Debit means we paid them (reduces payable)
      await Ledger.create({
        tenantId,
        partyId,
        partyType: 'Supplier',
        date,
        type: 'Debit',
        amount: payAmount,
        balanceAfter: newBalance,
        description: description ? `[${selectedMethod}] ${description}` : `Payment paid to supplier via ${selectedMethod}`,
      });

      createdPayment = await Payment.create({
        tenantId,
        partyId,
        partyName,
        partyType,
        date,
        amount: payAmount,
        type: 'Paid',
        paymentMethod: selectedMethod,
        description: description || `Payment paid via ${selectedMethod}`,
        balanceBefore,
        balanceAfter: newBalance,
        ...(ownTradingPurchase ? { idempotencyKey } : {}),
        ...(ownTradingPurchase ? { ownTradingPurchaseId, ownTradingAllocationType } : {}),
      });

    } else if (partyType === 'Customer') {
      const customer = await Customer.findById(partyId);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found.' });
      }
      if (!assertTenantOwnership(req, customer)) return res.status(404).json({ error: 'Customer not found.' });
      partyName = customer.name;
      partyPhone = customer.phone || '';
      balanceBefore = Number(customer.currentBalance) || 0;

      // When they pay us, their debt reduces. Balance goes down (gets closer to zero or negative).
      newBalance = customer.currentBalance - payAmount;
      await Customer.findByIdAndUpdate(partyId, {
        totalPaid: customer.totalPaid + payAmount,
        currentBalance: newBalance,
        remainingBalance: newBalance,
      });

      // Debit means purchase, Credit means payment received (reduces receivable)
      await Ledger.create({
        tenantId,
        partyId,
        partyType: 'Customer',
        date,
        type: 'Credit',
        amount: payAmount,
        balanceAfter: newBalance,
        description: description ? `[${selectedMethod}] ${description}` : `Payment received from customer via ${selectedMethod}`,
      });

      createdPayment = await Payment.create({
        tenantId,
        partyId,
        partyName,
        partyType,
        date,
        amount: payAmount,
        type: 'Received',
        paymentMethod: selectedMethod,
        description: description || `Payment received via ${selectedMethod}`,
        balanceBefore,
        balanceAfter: newBalance,
        ...(ownTradingPurchase ? { idempotencyKey } : {}),
        ...(ownTradingPurchase ? { ownTradingPurchaseId, ownTradingAllocationType, ownTradingAllocations } : {}),
      });
    } else {
      return res.status(400).json({ error: 'Invalid party type. Must be Supplier or Customer.' });
    }

    if (ownTradingPurchase && ownTradingAllocationType === 'Supplier Payable') {
      const supplierBalances = (ownTradingPurchase.supplierBalances || []).map(balance => String(balance.supplierId) === String(partyId)
        ? {
            ...balance,
            paidAmount: Math.round((Number(balance.paidAmount ?? balance.advancePaid ?? 0) + payAmount) * 100) / 100,
            outstandingPayable: Math.max(0, Math.round((Number(balance.outstandingPayable || 0) - payAmount) * 100) / 100),
          }
        : balance);
      await OwnTradingPurchase.findByIdAndUpdate(ownTradingPurchase.id || ownTradingPurchase._id, { supplierBalances });
    } else if (ownTradingPurchase && ownTradingAllocationType === 'Customer Receivable') {
      const allocations = new Map(ownTradingAllocations.map(item => [String(item.stockEntryId), Number(item.amount)]));
      const customerBalances = (ownTradingPurchase.customerBalances || []).map(balance => {
        const allocated = allocations.get(String(balance.stockEntryId)) || 0;
        if (!allocated || String(balance.customerId) !== String(partyId)) return balance;
        return {
          ...balance,
          recoveredAmount: Math.round((Number(balance.recoveredAmount || 0) + allocated) * 100) / 100,
          outstandingReceivable: Math.round((Number(balance.outstandingReceivable || 0) - allocated) * 100) / 100,
        };
      });
      await OwnTradingPurchase.findByIdAndUpdate(ownTradingPurchase.id || ownTradingPurchase._id, { customerBalances });
    }

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: `PAYMENT_${partyType.toUpperCase()}`,
      details: `Recorded payment (${selectedMethod}) of Rs. ${payAmount} for ${partyType} ${partyName}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      message: 'Payment recorded and ledger updated.',
      payment: createdPayment,
      party: { id: String(partyId), name: partyName, phone: partyPhone, partyType },
      balanceBefore,
      balanceAfter: newBalance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
}

export async function deletePayment(req, res) {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }
    if (!assertTenantOwnership(req, payment)) return res.status(404).json({ error: 'Payment not found.' });

    const tenantId = getTenantId(req) || payment.tenantId || 'tenant_default_001';
    const { partyId, partyType, amount, partyName } = payment;

    if (partyType === 'Supplier') {
      const supplier = await Supplier.findById(partyId);
      if (supplier) {
        if (!assertTenantOwnership(req, supplier)) return res.status(404).json({ error: 'Payment not found.' });
        // Reverse payment: we paid them, so now our debt goes back up (gets more negative)
        const reversedBalance = supplier.currentBalance - amount;
        await Supplier.findByIdAndUpdate(partyId, {
          totalPaid: Math.max(0, supplier.totalPaid - amount),
          currentBalance: reversedBalance,
          remainingBalance: reversedBalance,
        });

        await Ledger.create({
          tenantId,
          partyId,
          partyType: 'Supplier',
          date: new Date().toISOString().split('T')[0],
          type: 'Credit',
          amount,
          balanceAfter: reversedBalance,
          description: `DELETED PAYMENT REVERSAL: Cancelled payment of Rs. ${amount}`,
        });
      }
    } else if (partyType === 'Customer') {
      const customer = await Customer.findById(partyId);
      if (customer) {
        if (!assertTenantOwnership(req, customer)) return res.status(404).json({ error: 'Payment not found.' });
        // Reverse payment: they paid us, so now their debt goes back up (gets more positive)
        const reversedBalance = customer.currentBalance + amount;
        await Customer.findByIdAndUpdate(partyId, {
          totalPaid: Math.max(0, customer.totalPaid - amount),
          currentBalance: reversedBalance,
          remainingBalance: reversedBalance,
        });

        await Ledger.create({
          tenantId,
          partyId,
          partyType: 'Customer',
          date: new Date().toISOString().split('T')[0],
          type: 'Debit',
          amount,
          balanceAfter: reversedBalance,
          description: `DELETED PAYMENT REVERSAL: Cancelled payment of Rs. ${amount}`,
        });
      }
    }

    if (payment.ownTradingPurchaseId) {
      const purchase = await OwnTradingPurchase.findById(payment.ownTradingPurchaseId);
      if (purchase && assertTenantOwnership(req, purchase)) {
        if (payment.ownTradingAllocationType === 'Supplier Payable') {
          const supplierBalances = (purchase.supplierBalances || []).map(balance => String(balance.supplierId) === String(partyId)
            ? {
                ...balance,
                paidAmount: Math.max(0, Number(balance.paidAmount ?? balance.advancePaid ?? 0) - Number(amount || 0)),
                outstandingPayable: Math.round((Number(balance.outstandingPayable || 0) + Number(amount || 0)) * 100) / 100,
              }
            : balance);
          await OwnTradingPurchase.findByIdAndUpdate(purchase.id || purchase._id, { supplierBalances });
        } else if (payment.ownTradingAllocationType === 'Customer Receivable') {
          const allocations = new Map((payment.ownTradingAllocations || []).map(item => [String(item.stockEntryId), Number(item.amount)]));
          const customerBalances = (purchase.customerBalances || []).map(balance => {
            const allocated = allocations.get(String(balance.stockEntryId)) || 0;
            if (!allocated || String(balance.customerId) !== String(partyId)) return balance;
            return {
              ...balance,
              recoveredAmount: Math.max(0, Number(balance.recoveredAmount || 0) - allocated),
              outstandingReceivable: Math.round((Number(balance.outstandingReceivable || 0) + allocated) * 100) / 100,
            };
          });
          await OwnTradingPurchase.findByIdAndUpdate(purchase.id || purchase._id, { customerBalances });
        }
      }
    }

    await Payment.findByIdAndDelete(id);

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_PAYMENT',
      details: `Deleted payment record of Rs. ${amount} for ${partyType} ${partyName}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Payment record deleted and balances adjusted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete payment.' });
  }
}
