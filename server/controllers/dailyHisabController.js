import { Customer, Supplier, Ledger, Payment } from '../models/index.js';
import { buildTenantQuery } from '../utils/tenant.js';
import { buildDailyHisab } from '../utils/dailyHisab.js';

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export async function getDailyHisab(req, res) {
  try {
    const { date } = req.query;
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'A valid date in YYYY-MM-DD format is required.' });
    }

    const [customers, suppliers, ledgers, payments] = await Promise.all([
      Customer.find(buildTenantQuery(req, { isDeleted: { $ne: true } })),
      Supplier.find(buildTenantQuery(req, { isDeleted: { $ne: true } })),
      Ledger.find(buildTenantQuery(req)),
      Payment.find(buildTenantQuery(req)),
    ]);

    res.json(buildDailyHisab({ customers, suppliers, ledgers, payments, date }));
  } catch (err) {
    console.error('getDailyHisab error:', err);
    res.status(500).json({ error: 'Failed to calculate Daily Hisab.' });
  }
}
