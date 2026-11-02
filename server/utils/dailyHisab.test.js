import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyHisab } from './dailyHisab.js';

test('customer hisab separates opening balance, sales, returns and receipts', () => {
  const result = buildDailyHisab({
    date: '2026-10-04',
    customers: [{ _id: 'customer-1', name: 'Customer One' }],
    ledgers: [
      { partyId: 'customer-1', partyType: 'Customer', date: '2026-10-01', type: 'Debit', amount: 1000, description: 'Opening Balance' },
      { partyId: 'customer-1', partyType: 'Customer', date: '2026-10-04', type: 'Debit', amount: 250, description: 'Sale' },
      { partyId: 'customer-1', partyType: 'Customer', date: '2026-10-04', type: 'Credit', amount: 20, description: 'Return' },
      { partyId: 'customer-1', partyType: 'Customer', date: '2026-10-04', type: 'Credit', amount: 50, description: '[Cash] Receipt' },
      { partyId: 'customer-1', partyType: 'Customer', date: '2026-10-06', type: 'Debit', amount: 100, description: 'Backdated follow-up balance irrelevant for selected day', balanceAfter: 99999 },
    ],
    payments: [{ partyId: 'customer-1', partyType: 'Customer', date: '2026-10-04', amount: 50, type: 'Received' }],
  });

  assert.deepEqual(result.customers[0], {
    partyId: 'customer-1', partyType: 'Customer', partyName: 'Customer One', phone: '', khataId: '',
    previousBalance: 1000, todayPurchases: 230, totalOutstanding: 1230, todayPayment: 50, remainingBalance: 1180,
  });
});

test('supplier hisab converts the negative payable ledger convention and includes return deductions', () => {
  const result = buildDailyHisab({
    date: '2026-10-04',
    suppliers: [{ _id: 'supplier-1', name: 'Supplier One' }],
    ledgers: [
      { partyId: 'supplier-1', partyType: 'Supplier', date: '2026-10-01', type: 'Credit', amount: 5000, description: 'Opening Balance' },
      { partyId: 'supplier-1', partyType: 'Supplier', date: '2026-10-04', type: 'Credit', amount: 1000, description: 'Lot settlement' },
      { partyId: 'supplier-1', partyType: 'Supplier', date: '2026-10-04', type: 'Debit', amount: 600, description: '[Cash] Payment' },
      { partyId: 'supplier-1', partyType: 'Supplier', date: '2026-10-04', type: 'Debit', amount: 100, description: 'Return deduction' },
    ],
    payments: [{ partyId: 'supplier-1', partyType: 'Supplier', date: '2026-10-04', amount: 600, type: 'Paid' }],
  });

  assert.deepEqual(result.suppliers[0], {
    partyId: 'supplier-1', partyType: 'Supplier', partyName: 'Supplier One', phone: '', khataId: '',
    previousBalance: 5000, todayPurchases: 900, totalOutstanding: 5900, todayPayment: 600, remainingBalance: 5300,
  });
});

test('an opening balance dated on the selected day is carried forward, not counted as a purchase', () => {
  const result = buildDailyHisab({
    date: '2026-10-04',
    customers: [{ _id: 'customer-2', name: 'Customer Two' }],
    ledgers: [{ partyId: 'customer-2', partyType: 'Customer', date: '2026-10-04', type: 'Credit', amount: 300, description: 'Opening Balance' }],
  });

  assert.equal(result.customers[0].previousBalance, -300);
  assert.equal(result.customers[0].todayPurchases, 0);
  assert.equal(result.customers[0].remainingBalance, -300);
});
