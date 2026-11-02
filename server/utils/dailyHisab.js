const dateOnly = (value) => String(value || '').slice(0, 10);
const amountOf = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const idOf = (record) => String(record?.id || record?._id || '');

function signedLedgerMovement(entry, partyType) {
  const amount = amountOf(entry.amount);
  const ledgerSign = entry.type === 'Debit' ? 1 : entry.type === 'Credit' ? -1 : 0;
  const obligationSign = partyType === 'Supplier' ? -1 : 1;
  return ledgerSign * amount * obligationSign;
}

/**
 * Builds read-only daily hisab rows from the same ledger postings used by party ledgers.
 * Amounts are shown from the party's outstanding perspective: positive means a customer
 * owes the business or the business owes a supplier; negative means an advance/credit.
 */
export function buildDailyHisab({ customers = [], suppliers = [], ledgers = [], payments = [], date }) {
  const selectedDate = dateOnly(date);
  const buildRows = (parties, partyType) => parties.map((party) => {
    const partyId = idOf(party);
    const partyLedgers = ledgers.filter((entry) =>
      entry.partyType === partyType && String(entry.partyId) === partyId
    );
    const partyPayments = payments.filter((entry) =>
      entry.partyType === partyType && String(entry.partyId) === partyId && dateOnly(entry.date) === selectedDate
    );
    const todayPayment = partyPayments.reduce((sum, entry) => sum + amountOf(entry.amount), 0);
    let previousBalance = 0;
    let todayLedgerMovement = 0;

    for (const entry of partyLedgers) {
      const entryDate = dateOnly(entry.date);
      const movement = signedLedgerMovement(entry, partyType);
      const isOpeningBalance = String(entry.description || '').trim().toLowerCase() === 'opening balance';

      // The opening balance is carry-forward money even when its stored ledger date
      // matches the selected date, so it belongs to Previous Balance, not Purchases.
      if (entryDate < selectedDate || (entryDate === selectedDate && isOpeningBalance)) {
        previousBalance += movement;
      } else if (entryDate === selectedDate) {
        todayLedgerMovement += movement;
      }
    }

    // Payment rows mirror ledger postings. Add their amount back to the day's net
    // movement to isolate purchases/returns/settlement adjustments from cash paid.
    const todayPurchases = todayLedgerMovement + todayPayment;
    const totalOutstanding = previousBalance + todayPurchases;
    const remainingBalance = totalOutstanding - todayPayment;

    return {
      partyId,
      partyType,
      partyName: party.name || '',
      phone: party.phone || '',
      khataId: party.khataId || '',
      previousBalance: Math.round(previousBalance * 100) / 100,
      todayPurchases: Math.round(todayPurchases * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      todayPayment: Math.round(todayPayment * 100) / 100,
      remainingBalance: Math.round(remainingBalance * 100) / 100,
    };
  });

  const summarize = (rows) => rows.reduce((summary, row) => {
    summary.previousBalance += row.previousBalance;
    summary.todayPurchases += row.todayPurchases;
    summary.totalOutstanding += row.totalOutstanding;
    summary.todayPayment += row.todayPayment;
    summary.remainingBalance += row.remainingBalance;
    return summary;
  }, { previousBalance: 0, todayPurchases: 0, totalOutstanding: 0, todayPayment: 0, remainingBalance: 0 });

  const customerRows = buildRows(customers, 'Customer');
  const supplierRows = buildRows(suppliers, 'Supplier');
  return {
    date: selectedDate,
    customers: customerRows,
    suppliers: supplierRows,
    customerTotals: summarize(customerRows),
    supplierTotals: summarize(supplierRows),
  };
}
