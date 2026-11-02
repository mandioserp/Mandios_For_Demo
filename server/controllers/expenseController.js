import { Expense, AuditLog } from '../models/index.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';

export async function getExpenses(req, res) {
  try {
    const expenses = await Expense.find(buildTenantQuery(req));
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses.' });
  }
}

export async function addExpense(req, res) {
  try {
    const { category, amount, date, description } = req.body;
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!category || amount === undefined || !date) {
      return res.status(400).json({ error: 'Please provide category, amount, and date.' });
    }

    const expense = await Expense.create({
      tenantId,
      category,
      amount: Number(amount),
      date,
      description: description || '',
      recordedBy: req.user ? req.user.name : 'System',
    });

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'ADD_EXPENSE',
      details: `Added expense: Rs. ${amount} in category "${category}" on ${date}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record expense.' });
  }
}

export async function editExpense(req, res) {
  try {
    const { id } = req.params;
    const { category, amount, date, description } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    if (!assertTenantOwnership(req, expense)) return res.status(404).json({ error: 'Expense not found.' });

    const tenantId = getTenantId(req) || expense.tenantId || 'tenant_default_001';

    const updated = await Expense.findByIdAndUpdate(id, {
      category: category || expense.category,
      amount: amount !== undefined ? Number(amount) : expense.amount,
      date: date || expense.date,
      description: description !== undefined ? description : expense.description,
    });

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'EDIT_EXPENSE',
      details: `Edited expense ${id}: ${expense.category} -> ${category || expense.category}.`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense.' });
  }
}

export async function deleteExpense(req, res) {
  try {
    const { id } = req.params;
    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    if (!assertTenantOwnership(req, expense)) return res.status(404).json({ error: 'Expense not found.' });

    const tenantId = getTenantId(req) || expense.tenantId || 'tenant_default_001';

    await Expense.findByIdAndDelete(id);

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'DELETE_EXPENSE',
      details: `Deleted expense of Rs. ${expense.amount} from category "${expense.category}" dated ${expense.date}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
}
