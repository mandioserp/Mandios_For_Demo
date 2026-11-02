import { Employee, Salary, SalaryAdvance, Expense, AuditLog } from '../models/index.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';

// Helper to generate a unique employee ID
async function generateEmployeeId() {
  const count = await Employee.countDocuments();
  const randomStr = Math.floor(1000 + Math.random() * 9000); // 4 digit random number
  return `EMP-${100 + count + 1}-${randomStr}`;
}

// ==================== EMPLOYEE CRUD ====================

export async function getEmployees(req, res) {
  try {
    const employees = await Employee.find(buildTenantQuery(req, { isDeleted: { $ne: true } }));
    // Handle local json database filtering if Mongo operators are parsed literally
    const filtered = employees.filter(e => e.isDeleted !== true);
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
}

export async function addEmployee(req, res) {
  try {
    const {
      name, fatherName, cnic, phone, alternatePhone, email,
      address, city, photo, notes, referenceBy, designation, department,
      joiningDate, salaryType, basicSalary, openingAdvance, status
    } = req.body;

    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!name || !phone || !designation || !joiningDate || !salaryType || basicSalary === undefined) {
      return res.status(400).json({ error: 'Required fields: Name, Phone, Designation, Joining Date, Salary Type, Basic Salary.' });
    }

    const employeeId = await generateEmployeeId();

    const employee = await Employee.create({
      tenantId,
      employeeId,
      name,
      fatherName: fatherName || '',
      cnic: cnic || '',
      phone,
      alternatePhone: alternatePhone || '',
      email: email || '',
      address: address || '',
      city: city || '',
      photo: photo || '',
      notes: notes || '',
      referenceBy: referenceBy || '',
      designation,
      department: department || '',
      joiningDate,
      salaryType,
      basicSalary: Number(basicSalary),
      openingAdvance: Number(openingAdvance || 0),
      status: status || 'Active',
      isDeleted: false
    });

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'ADD_EMPLOYEE',
      details: `Registered employee: ${name} (ID: ${employeeId}) as ${designation}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register employee.' });
  }
}

export async function editEmployee(req, res) {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.employeeId; // Employee ID cannot be changed
    delete updateData.tenantId;

    const employee = await Employee.findById(id);
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (!assertTenantOwnership(req, employee)) return res.status(404).json({ error: 'Employee not found.' });

    const tenantId = getTenantId(req) || employee.tenantId || 'tenant_default_001';

    const updated = await Employee.findByIdAndUpdate(id, updateData);

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'EDIT_EMPLOYEE',
      details: `Updated employee registration for ${employee.name} (ID: ${employee.employeeId}).`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update employee.' });
  }
}

export async function deleteEmployee(req, res) {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (!assertTenantOwnership(req, employee)) return res.status(404).json({ error: 'Employee not found.' });

    const tenantId = getTenantId(req) || employee.tenantId || 'tenant_default_001';
    const now = new Date();
    const deletedBy = req.user ? (req.user.name || req.user.email) : 'Admin';

    await Employee.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: now,
      deletedBy
    });

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'DELETE_EMPLOYEE',
      details: `Soft deleted employee: ${employee.name} (ID: ${employee.employeeId}).`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Employee soft-deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete employee.' });
  }
}

// ==================== SALARY MANAGEMENT ====================

export async function getSalaries(req, res) {
  try {
    const salaries = await Salary.find(buildTenantQuery(req, { isDeleted: { $ne: true } }));
    const filtered = salaries.filter(s => s.isDeleted !== true);
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch salaries.' });
  }
}

export async function addSalary(req, res) {
  try {
    const {
      employeeId, month, year, basicSalary, bonus, allowance,
      overtime, advanceDeduction, otherDeductions, paymentDate,
      paymentMethod, paymentStatus, remarks
    } = req.body;

    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!employeeId || !month || !year || basicSalary === undefined || !paymentDate || !paymentMethod || !paymentStatus) {
      return res.status(400).json({ error: 'Please fill all required fields for salary processing.' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (!assertTenantOwnership(req, employee)) return res.status(404).json({ error: 'Employee not found.' });

    const numericSalaryValues = [basicSalary, bonus || 0, allowance || 0, overtime || 0, advanceDeduction || 0, otherDeductions || 0].map(Number);
    if (numericSalaryValues.some(value => !Number.isFinite(value) || value < 0)) {
      return res.status(400).json({ error: 'Salary amounts must be finite, non-negative numbers.' });
    }

    // Formula calculation on backend to ensure absolute consistency
    const advanceDeducted = Number(advanceDeduction || 0);
    const netSalary = Number(basicSalary) + Number(bonus || 0) + Number(allowance || 0) + Number(overtime || 0) - advanceDeducted - Number(otherDeductions || 0);
    // Total Mandi expense includes Net Salary + Advance Deducted
    const salaryExpenseAmount = netSalary + advanceDeducted;

    // Create the salary record
    const salary = await Salary.create({
      tenantId,
      employeeId,
      employeeName: employee.name,
      month,
      year: Number(year),
      basicSalary: Number(basicSalary),
      bonus: Number(bonus || 0),
      allowance: Number(allowance || 0),
      overtime: Number(overtime || 0),
      advanceDeduction: advanceDeducted,
      otherDeductions: Number(otherDeductions || 0),
      netSalary,
      paymentDate,
      paymentMethod,
      paymentStatus,
      remarks: remarks || '',
      isDeleted: false
    });

    let expenseId = null;

    // Automatic Expense Integration: Mark Paid or Partial -> Create Expense
    if (paymentStatus === 'Paid' || paymentStatus === 'Partial') {
      const exp = await Expense.create({
        tenantId,
        category: 'Salary',
        amount: salaryExpenseAmount,
        date: paymentDate,
        description: `Salary Payment for ${month} ${year} - ${employee.name} (${employee.employeeId})`,
        recordedBy: req.user ? req.user.name : 'System'
      });
      expenseId = exp.id || exp._id;
      // Update salary with expense reference
      await Salary.findByIdAndUpdate(salary.id || salary._id, { expenseReference: expenseId });
    }

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'ADD_SALARY',
      details: `Processed ${paymentStatus} Salary for ${employee.name} (${month}/${year}). Net: Rs. ${netSalary}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ ...salary, expenseReference: expenseId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process salary.' });
  }
}

export async function editSalary(req, res) {
  try {
    const { id } = req.params;
    const {
      month, year, basicSalary, bonus, allowance,
      overtime, advanceDeduction, otherDeductions, paymentDate,
      paymentMethod, paymentStatus, remarks
    } = req.body;

    const salary = await Salary.findById(id);
    if (!salary || salary.isDeleted) {
      return res.status(404).json({ error: 'Salary record not found.' });
    }
    if (!assertTenantOwnership(req, salary)) return res.status(404).json({ error: 'Salary record not found.' });

    const tenantId = getTenantId(req) || salary.tenantId || 'tenant_default_001';

    const employee = await Employee.findById(salary.employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (!assertTenantOwnership(req, employee)) return res.status(404).json({ error: 'Salary record not found.' });
    if (salary.expenseReference) {
      const expense = await Expense.findById(salary.expenseReference);
      if (expense && !assertTenantOwnership(req, expense)) return res.status(404).json({ error: 'Salary record not found.' });
    }

    const updatedBasic = basicSalary !== undefined ? Number(basicSalary) : salary.basicSalary;
    const updatedBonus = bonus !== undefined ? Number(bonus) : salary.bonus;
    const updatedAllowance = allowance !== undefined ? Number(allowance) : salary.allowance;
    const updatedOvertime = overtime !== undefined ? Number(overtime) : salary.overtime;
    const updatedAdvance = advanceDeduction !== undefined ? Number(advanceDeduction) : salary.advanceDeduction;
    const updatedOther = otherDeductions !== undefined ? Number(otherDeductions) : salary.otherDeductions;

    if ([updatedBasic, updatedBonus, updatedAllowance, updatedOvertime, updatedAdvance, updatedOther]
      .some(value => !Number.isFinite(value) || value < 0)) {
      return res.status(400).json({ error: 'Salary amounts must be finite, non-negative numbers.' });
    }

    const netSalary = updatedBasic + updatedBonus + updatedAllowance + updatedOvertime - updatedAdvance - updatedOther;
    const salaryExpenseAmount = netSalary + updatedAdvance;

    // Handle connected Expense (update or delete or create)
    let expenseRef = salary.expenseReference;

    if (paymentStatus === 'Paid' || paymentStatus === 'Partial') {
      if (expenseRef) {
        // Update existing expense
        await Expense.findByIdAndUpdate(expenseRef, {
          amount: salaryExpenseAmount,
          date: paymentDate || salary.paymentDate,
          description: `Salary Payment for ${month || salary.month} ${year || salary.year} - ${employee.name} (${employee.employeeId})`,
        });
      } else {
        // Create new expense since it changed to Paid/Partial
        const exp = await Expense.create({
          tenantId,
          category: 'Salary',
          amount: salaryExpenseAmount,
          date: paymentDate || salary.paymentDate,
          description: `Salary Payment for ${month || salary.month} ${year || salary.year} - ${employee.name} (${employee.employeeId})`,
          recordedBy: req.user ? req.user.name : 'System'
        });
        expenseRef = exp.id || exp._id;
      }
    } else {
      // Unpaid: delete linked expense if any
      if (expenseRef) {
        await Expense.findByIdAndDelete(expenseRef);
        expenseRef = '';
      }
    }

    const updated = await Salary.findByIdAndUpdate(id, {
      month: month || salary.month,
      year: year !== undefined ? Number(year) : salary.year,
      basicSalary: updatedBasic,
      bonus: updatedBonus,
      allowance: updatedAllowance,
      overtime: updatedOvertime,
      advanceDeduction: updatedAdvance,
      otherDeductions: updatedOther,
      netSalary,
      paymentDate: paymentDate || salary.paymentDate,
      paymentMethod: paymentMethod || salary.paymentMethod,
      paymentStatus: paymentStatus || salary.paymentStatus,
      remarks: remarks !== undefined ? remarks : salary.remarks,
      expenseReference: expenseRef
    });

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'EDIT_SALARY',
      details: `Updated Salary record for ${employee.name} (${month || salary.month}/${year || salary.year}).`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update salary.' });
  }
}

export async function deleteSalary(req, res) {
  try {
    const { id } = req.params;
    const salary = await Salary.findById(id);
    if (!salary) {
      return res.status(404).json({ error: 'Salary record not found.' });
    }
    if (!assertTenantOwnership(req, salary)) return res.status(404).json({ error: 'Salary record not found.' });
    if (salary.expenseReference) {
      const expense = await Expense.findById(salary.expenseReference);
      if (expense && !assertTenantOwnership(req, expense)) return res.status(404).json({ error: 'Salary record not found.' });
    }

    const tenantId = getTenantId(req) || salary.tenantId || 'tenant_default_001';

    await Salary.findByIdAndUpdate(id, { isDeleted: true });

    // Clean up related expense to avoid duplicates and mismatching financial books
    if (salary.expenseReference) {
      await Expense.findByIdAndDelete(salary.expenseReference);
    }

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'DELETE_SALARY',
      details: `Deleted salary record for employee ID: ${salary.employeeId} (${salary.month}/${salary.year}).`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Salary record removed successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete salary.' });
  }
}

// ==================== SALARY ADVANCE ====================

export async function getAdvances(req, res) {
  try {
    const advances = await SalaryAdvance.find(buildTenantQuery(req, { isDeleted: { $ne: true } }));
    const filtered = advances.filter(a => a.isDeleted !== true);
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch advances.' });
  }
}

export async function addAdvance(req, res) {
  try {
    const { employeeId, date, amount, reason, remarks } = req.body;
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!employeeId || !date || amount === undefined) {
      return res.status(400).json({ error: 'Please provide Employee, Date, and Amount.' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (!assertTenantOwnership(req, employee)) return res.status(404).json({ error: 'Employee not found.' });

    const advanceAmount = Number(amount);
    if (!Number.isFinite(advanceAmount) || advanceAmount <= 0) {
      return res.status(400).json({ error: 'Advance amount must be a positive number.' });
    }
    if (!assertTenantOwnership(req, employee)) return res.status(404).json({ error: 'Employee not found.' });

    const advance = await SalaryAdvance.create({
      tenantId,
      employeeId,
      employeeName: employee.name,
      date,
      amount: advanceAmount,
      reason: reason || '',
      approvedBy: req.user ? req.user.name : 'Admin',
      remarks: remarks || '',
      isDeleted: false
    });

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'ADD_ADVANCE',
      details: `Recorded Salary Advance of Rs. ${amount} for ${employee.name}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(advance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record advance.' });
  }
}

export async function deleteAdvance(req, res) {
  try {
    const { id } = req.params;
    const advance = await SalaryAdvance.findById(id);
    if (!advance) {
      return res.status(404).json({ error: 'Advance not found.' });
    }
    if (!assertTenantOwnership(req, advance)) return res.status(404).json({ error: 'Advance not found.' });

    const tenantId = getTenantId(req) || advance.tenantId || 'tenant_default_001';

    await SalaryAdvance.findByIdAndUpdate(id, { isDeleted: true });

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'DELETE_ADVANCE',
      details: `Deleted Salary Advance record for Rs. ${advance.amount} to employee ID: ${advance.employeeId}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Advance removed successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete advance.' });
  }
}

// ==================== EMPLOYEE PROFILE AGGREGATOR ====================

export async function getEmployeeProfile(req, res) {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (!assertTenantOwnership(req, employee)) return res.status(404).json({ error: 'Employee not found.' });

    const salaries = await Salary.find(buildTenantQuery(req, { employeeId: id, isDeleted: { $ne: true } }));
    const advances = await SalaryAdvance.find(buildTenantQuery(req, { employeeId: id, isDeleted: { $ne: true } }));
    
    // Filter local arrays as fallback
    const filteredSalaries = salaries.filter(s => s.employeeId === id && s.isDeleted !== true);
    const filteredAdvances = advances.filter(a => a.employeeId === id && a.isDeleted !== true);

    // Fetch related general expenses
    const expenses = await Expense.find(buildTenantQuery(req));
    const relatedExpenses = expenses.filter(exp => {
      const desc = String(exp.description || '').toLowerCase();
      const matchName = desc.includes(employee.name.toLowerCase());
      const matchId = desc.includes(employee.employeeId.toLowerCase());
      return matchName || matchId;
    });

    res.json({
      employee,
      salaries: filteredSalaries,
      advances: filteredAdvances,
      expenses: relatedExpenses
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employee profile.' });
  }
}

// ==================== DASHBOARD INTEGRATION helper ====================

export async function getEmployeeStats(req, res) {
  try {
    const tenantQuery = buildTenantQuery(req);
    const employees = (await Employee.find(tenantQuery)).filter(e => !e.isDeleted);
    const salaries = (await Salary.find(tenantQuery)).filter(s => !s.isDeleted);
    const advances = (await SalaryAdvance.find(tenantQuery)).filter(a => !a.isDeleted);
    const expenses = await Expense.find(tenantQuery);

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === 'Active').length;

    // Calculate current month salary stats
    const currentMonthStr = new Date().toLocaleString('en-US', { month: 'long' });
    const currentYearNum = new Date().getFullYear();

    const monthlySalaries = salaries.filter(s => 
      String(s.month).toLowerCase() === currentMonthStr.toLowerCase() && 
      Number(s.year) === currentYearNum
    );

    const monthlySalaryExpense = monthlySalaries.reduce((sum, s) => sum + s.netSalary + (s.advanceDeduction || 0), 0);
    const salaryPaidThisMonth = monthlySalaries
      .filter(s => s.paymentStatus === 'Paid' || s.paymentStatus === 'Partial')
      .reduce((sum, s) => sum + s.netSalary + (s.advanceDeduction || 0), 0);

    const pendingSalaryAmount = monthlySalaries
      .filter(s => s.paymentStatus === 'Unpaid' || s.paymentStatus === 'Partial')
      .reduce((sum, s) => {
        if (s.paymentStatus === 'Unpaid') return sum + s.netSalary;
        // if partial, assume half paid or remaining netSalary (we default to full netSalary as pending if partial, or we can calculate based on payment record. Let's do full netSalary minus deductions, or standard pending calculation)
        return sum + s.netSalary * 0.5; // fallback approximation
      }, 0);

    // Staff expenses = all expenses in 'Salary' category
    const staffExpenses = expenses.filter(e => String(e.category).toLowerCase() === 'salary');
    const totalStaffExpense = staffExpenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      totalEmployees,
      activeEmployees,
      monthlySalaryExpense,
      salaryPaidThisMonth,
      pendingSalaryAmount,
      totalStaffExpense
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employee statistics.' });
  }
}
