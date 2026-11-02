import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { downloadPayrollReportPDF } from '../utils/pdfExport.js';
import { escapeHtml, openSafePrintWindow } from '../utils/safePrint.js';
import { buildPrintReportHeaderHtml, PRINT_REPORT_HEADER_STYLES } from './common/PrintReportHeader.jsx';
import DialogAlert from './common/DialogAlert.jsx';
import {
  Users, UserCheck, DollarSign, Calendar, Plus, Pencil, Trash, Search, Eye, Printer, FileSpreadsheet,
  Filter, ArrowLeft, Briefcase, MapPin, Phone, Mail, FileText, CreditCard, AlertTriangle, Download,
  UserPlus, CheckCircle2, ChevronRight, X, BarChart3, Receipt
} from 'lucide-react';
import SpokeSpinner from './common/SpokeSpinner.jsx';

export default function EmployeeManagement() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'Admin';

  // Top level horizontal tab
  const [activeTopTab, setActiveTopTab] = useState('directory'); // 'directory', 'reports'

  // Registered Business Profile State
  const [businessProfile, setBusinessProfile] = useState({
    businessName: '',
    ownerName: '',
    ownerName1: '',
    ownerNumber1: '',
    ownerName2: '',
    ownerNumber2: '',
    logo: '',
    mobileNumber: '',
    whatsAppNumber: '',
    email: '',
    address: '',
    city: '',
    country: '',
    businessCode: '',
    tenantId: ''
  });

  const fetchBusinessProfile = async () => {
    try {
      const res = await api.get('/settings/business');
      if (res.data) {
        setBusinessProfile(res.data);
      }
    } catch (err) {
      console.error('Failed to load business profile', err);
    }
  };
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'profile'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [profileData, setProfileData] = useState({ employee: null, salaries: [], advances: [], expenses: [] });
  
  // Search & Filter state for List
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSalaryType, setFilterSalaryType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals / Forms
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit'
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);
  const [salarySubmitting, setSalarySubmitting] = useState(false);
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);
  const [employeeModalAlert, setEmployeeModalAlert] = useState(null);
  const [salaryModalAlert, setSalaryModalAlert] = useState(null);
  const [advanceModalAlert, setAdvanceModalAlert] = useState(null);
  const [employeeFormData, setEmployeeFormData] = useState({
    name: '', fatherName: '', cnic: '', phone: '', alternatePhone: '', email: '',
    address: '', city: '', photo: '', notes: '', referenceBy: '', designation: '', department: '',
    joiningDate: new Date().toISOString().split('T')[0], salaryType: 'Monthly',
    basicSalary: '', openingAdvance: '0', status: 'Active'
  });

  // Salary Payment Modal Form
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryFormData, setSalaryFormData] = useState({
    month: new Date().toLocaleString('en-US', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    basicSalary: '',
    bonus: '0',
    allowance: '0',
    overtime: '0',
    advanceDeduction: '0',
    otherDeductions: '0',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    paymentStatus: 'Paid',
    remarks: ''
  });

  // Salary Advance Modal Form
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceFormData, setAdvanceFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    reason: '',
    remarks: ''
  });

  // Toast State
  const [toast, setToast] = useState(null);

  // Profile Active Tab
  const [profileTab, setProfileTab] = useState('personal'); // 'personal', 'employment', 'salary', 'advance', 'expense'

  // Reports States
  const [allSalaries, setAllSalaries] = useState([]);
  const [allAdvances, setAllAdvances] = useState([]);
  const [settingPaymentMethods, setSettingPaymentMethods] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('monthly_payroll'); 
  // 'employee_list', 'monthly_payroll', 'payment_status', 'pending_salary', 'salary_advances', 'staff_expenses'
  
  const [reportFilters, setReportFilters] = useState({
    month: new Date().toLocaleString('en-US', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    status: '',
    paymentMethod: ''
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch all employees & payment methods
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const [empRes, pmRes] = await Promise.all([
        api.get('/employees').catch(() => ({ data: [] })),
        api.get('/settings/payment-methods').catch(() => ({ data: [] }))
      ]);
      setEmployees(empRes.data || []);
      setSettingPaymentMethods(pmRes.data || []);
    } catch (err) {
      console.error(err);
      showToast(t('Failed to load employee list'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all payroll history for reports
  const fetchReportsData = async () => {
    setReportsLoading(true);
    try {
      const [salariesRes, advancesRes] = await Promise.all([
        api.get('/salaries'),
        api.get('/advances')
      ]);
      setAllSalaries(salariesRes.data || []);
      setAllAdvances(advancesRes.data || []);
    } catch (err) {
      console.error(err);
      showToast(t('Failed to load payroll reports history'), 'error');
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchBusinessProfile();
  }, []);

  useEffect(() => {
    if (activeTopTab === 'reports') {
      fetchReportsData();
    }
  }, [activeTopTab]);

  // Fetch complete employee profile
  const fetchEmployeeProfile = async (id) => {
    try {
      const res = await api.get(`/employees/profile/${id}`);
      setProfileData(res.data);
      // Auto-populate salary form basic salary
      if (res.data?.employee) {
        setSalaryFormData(prev => ({
          ...prev,
          basicSalary: res.data.employee.basicSalary.toString(),
          advanceDeduction: calculatePendingAdvance(res.data.advances, res.data.salaries).toString()
        }));
      }
    } catch (err) {
      console.error(err);
      showToast(t('Failed to load employee profile'), 'error');
    }
  };

  const calculatePendingAdvance = (advances, salaries) => {
    const totalAdvances = (advances || []).reduce((sum, a) => sum + a.amount, 0);
    const totalDeducted = (salaries || []).reduce((sum, s) => sum + (s.advanceDeduction || 0), 0);
    const openingAdvance = profileData?.employee?.openingAdvance || 0;
    return Math.max(0, (totalAdvances + openingAdvance) - totalDeducted);
  };

  const handleViewProfile = (employee) => {
    setSelectedEmployee(employee);
    setProfileTab('personal');
    fetchEmployeeProfile(employee._id || employee.id);
    setViewMode('profile');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEmployeeFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle Create/Edit Employee Submit
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (employeeSubmitting) return;
    
    // Validations
    if (!employeeFormData.name || !employeeFormData.phone || !employeeFormData.designation || !employeeFormData.joiningDate || !employeeFormData.basicSalary) {
      setEmployeeModalAlert({ type: 'error', message: t('Required fields: Name, Phone, Designation, Joining Date, Salary, Type.') });
      return;
    }

    setEmployeeSubmitting(true);
    setEmployeeModalAlert(null);
    try {
      const payload = {
        ...employeeFormData,
        basicSalary: Number(employeeFormData.basicSalary),
        openingAdvance: Number(employeeFormData.openingAdvance || 0)
      };

      if (modalMode === 'add') {
        await api.post('/employees', payload);
        showToast(t('Employee successfully registered'));
      } else {
        await api.put(`/employees/${selectedEmployee._id || selectedEmployee.id}`, payload);
        showToast(t('Employee details updated successfully'));
      }
      setShowAddEditModal(false);
      setEmployeeModalAlert(null);
      fetchEmployees();
      if (viewMode === 'profile' && selectedEmployee) {
        fetchEmployeeProfile(selectedEmployee._id || selectedEmployee.id);
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || t('Failed to save employee records');
      setEmployeeModalAlert({ type: 'error', message: errMsg });
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  // Handle Delete Employee
  const handleDeleteEmployee = async (id, name) => {
    const confirmed = await confirm({
      title: t('Remove {{name}}?', { name }),
      message: t('Are you absolutely sure you want to remove employee "{{name}}"? This will soft-delete their records and move them to Trash.', { name }),
      confirmText: t('Remove Employee'),
      type: 'danger'
    });
    if (!confirmed) {
      return;
    }
    try {
      await api.delete(`/employees/${id}`);
      showToast(t('Employee "{{name}}" has been successfully removed.', { name }));
      fetchEmployees();
      if (viewMode === 'profile') {
        setViewMode('list');
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || t('Failed to delete employee record'), 'error');
    }
  };

  // Process Salary Submit
  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    if (salarySubmitting) return;
    if (!salaryFormData.month || !salaryFormData.year || !salaryFormData.basicSalary) {
      setSalaryModalAlert({ type: 'error', message: t('Please enter Month, Year and Basic Salary') });
      return;
    }

    setSalarySubmitting(true);
    setSalaryModalAlert(null);
    try {
      const payload = {
        employeeId: selectedEmployee._id || selectedEmployee.id,
        month: salaryFormData.month,
        year: Number(salaryFormData.year),
        basicSalary: Number(salaryFormData.basicSalary),
        bonus: Number(salaryFormData.bonus || 0),
        allowance: Number(salaryFormData.allowance || 0),
        overtime: Number(salaryFormData.overtime || 0),
        advanceDeduction: Number(salaryFormData.advanceDeduction || 0),
        otherDeductions: Number(salaryFormData.otherDeductions || 0),
        paymentDate: salaryFormData.paymentDate,
        paymentMethod: salaryFormData.paymentMethod,
        paymentStatus: salaryFormData.paymentStatus,
        remarks: salaryFormData.remarks
      };

      await api.post('/salaries', payload);
      showToast(t('Salary payment successfully processed'));
      setShowSalaryModal(false);
      setSalaryModalAlert(null);
      fetchEmployeeProfile(selectedEmployee._id || selectedEmployee.id);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || t('Failed to process salary payment');
      setSalaryModalAlert({ type: 'error', message: errMsg });
    } finally {
      setSalarySubmitting(false);
    }
  };

  // Process Salary Advance Submit
  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    if (advanceSubmitting) return;
    if (!advanceFormData.amount || !advanceFormData.date) {
      setAdvanceModalAlert({ type: 'error', message: t('Amount and Date are required.') });
      return;
    }

    setAdvanceSubmitting(true);
    setAdvanceModalAlert(null);
    try {
      const payload = {
        employeeId: selectedEmployee._id || selectedEmployee.id,
        date: advanceFormData.date,
        amount: Number(advanceFormData.amount),
        reason: advanceFormData.reason,
        remarks: advanceFormData.remarks
      };

      await api.post('/advances', payload);
      showToast(t('Salary advance recorded successfully'));
      setShowAdvanceModal(false);
      setAdvanceModalAlert(null);
      fetchEmployeeProfile(selectedEmployee._id || selectedEmployee.id);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || t('Failed to record salary advance');
      setAdvanceModalAlert({ type: 'error', message: errMsg });
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  // Remove Salary Record
  const handleDeleteSalary = async (id) => {
    const confirmed = await confirm({
      title: t('Delete Salary Record?'),
      message: t('Are you sure you want to delete this salary record? Connected expense will be cleaned up.'),
      confirmText: t('Delete Record'),
      type: 'danger'
    });
    if (!confirmed) {
      return;
    }
    try {
      await api.delete(`/salaries/${id}`);
      showToast(t('Salary record deleted successfully'));
      fetchEmployeeProfile(selectedEmployee._id || selectedEmployee.id);
    } catch (err) {
      console.error(err);
      showToast(t('Failed to delete salary record'), 'error');
    }
  };

  // Remove Advance Record
  const handleDeleteAdvance = async (id) => {
    const confirmed = await confirm({
      title: t('Delete Salary Advance?'),
      message: t('Are you sure you want to delete this salary advance?'),
      confirmText: t('Delete Advance'),
      type: 'danger'
    });
    if (!confirmed) {
      return;
    }
    try {
      await api.delete(`/advances/${id}`);
      showToast(t('Salary advance deleted successfully'));
      fetchEmployeeProfile(selectedEmployee._id || selectedEmployee.id);
    } catch (err) {
      console.error(err);
      showToast(t('Failed to delete advance record'), 'error');
    }
  };

  // Net Salary Dynamic Calculation on Frontend
  const computedNetSalary = () => {
    const basic = Number(salaryFormData.basicSalary || 0);
    const bonus = Number(salaryFormData.bonus || 0);
    const allowance = Number(salaryFormData.allowance || 0);
    const overtime = Number(salaryFormData.overtime || 0);
    const advance = Number(salaryFormData.advanceDeduction || 0);
    const other = Number(salaryFormData.otherDeductions || 0);
    return basic + bonus + allowance + overtime - advance - other;
  };

  // Export to CSV/Excel Helper
  const exportToExcel = (dataList, filename) => {
    if (!dataList || dataList.length === 0) {
      showToast(t('No data available to export'), 'error');
      return;
    }
    const headers = Object.keys(dataList[0]).join(',');
    const rows = dataList.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(t('Report exported successfully to Excel CSV format!'));
  };

  // Native print trigger with the shared MandiOS report header
  const triggerPrint = (elementId, title) => {
    const printContent = document.getElementById(elementId);
    if (!printContent) {
      showToast(t('Printing error: Area not found'), 'error');
      return;
    }

    const bizName = businessProfile?.businessName || businessProfile?.name || '';
    const safeBizName = escapeHtml(bizName);
    const reportTitleFormatted = title || (selectedReportType ? selectedReportType.replace(/_/g, ' ').toUpperCase() : 'EMPLOYEE AUDIT REPORT');
    const reportPeriod = reportFilters.month && reportFilters.year ? `${reportFilters.month} ${reportFilters.year}` : '';

    const reportStyles = `
      @page { size: A4 landscape; margin: 10mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
      ${PRINT_REPORT_HEADER_STYLES}
      body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #0f172a; line-height: 1.4; padding: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
      th { background-color: #0f172a !important; color: #ffffff !important; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 9px 12px; border: 1px solid #334155; }
      td { padding: 8px 12px; border: 1px solid #cbd5e1; color: #1e293b; font-weight: 500; }
      tr:nth-child(even) td { background-color: #f8fafc; }
      tr:hover td { background-color: #f1f5f9; }
      .text-right { text-align: right; } .text-center { text-align: center; }
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .font-bold { font-weight: 700; } .font-black { font-weight: 900; }
      .badge-pill { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 10px; font-weight: 900; text-transform: uppercase; }
      .signature-footer { margin-top: 36px; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }
      .sig-line { width: 220px; border-top: 2px dashed #94a3b8; text-align: center; padding-top: 6px; font-size: 11px; font-weight: 800; color: #334155; }
    `;
    const reportHeader = buildPrintReportHeaderHtml({
      title: t(reportTitleFormatted),
      period: reportPeriod,
      filters: user?.name ? [{ label: t('Generated By'), value: user.name }] : [],
      profile: businessProfile,
      includeStyles: false,
      labels: {
        arthiCode: t('ARHTI CODE'),
        date: t('Date'),
        generated: t('Generated'),
        footer: t('MandiOS Business Report'),
        proprietor: t('Proprietor'),
        period: t('Report Period'),
        locale: language === 'ur' ? 'ur-PK' : 'en-GB'
      }
    });
    const signatureFooter = `
      <div class="signature-footer">
        <div class="sig-line">${t('Prepared By (HR & Payroll)')}</div>
        <div class="sig-line">${t('Audited By (Finance)')}</div>
        <div class="sig-line">${t('Authorized Signatory')} (${safeBizName})</div>
      </div>
      <div class="mt-6 text-center text-[10px] font-bold text-slate-400 border-t border-slate-200 pt-2 uppercase tracking-widest">
        ${escapeHtml(t('Computer Generated Official Report • {{business}} • Valid Without Physical Stamp', { business: bizName }))}
      </div>
    `;
    const win = openSafePrintWindow(title, `<html><head><style>${reportStyles}</style></head><body>${reportHeader}${printContent.innerHTML}${signatureFooter}</body></html>`, 'height=850,width=1150');
    if (!win) return;
    setTimeout(() => {
      win.print();
    }, 600);
  };

  // Print Salary Slip Voucher for an Individual Employee
  const triggerPrintPaySlip = (salary, employee) => {
    if (!salary || !employee) return;

    const bizName = businessProfile?.businessName || businessProfile?.name || '';
    const safeBizName = escapeHtml(bizName);
    const paySlipHeader = buildPrintReportHeaderHtml({
      title: t('OFFICIAL SALARY PAY SLIP'),
      period: `${salary.month} ${salary.year}`,
      filters: [
        { label: t('Employee'), value: employee.name },
        ...(employee.employeeId ? [{ label: t('Employee ID'), value: employee.employeeId }] : []),
        ...(salary.paymentDate ? [{ label: t('Disbursement Date'), value: salary.paymentDate }] : [])
      ],
      profile: businessProfile,
      includeStyles: false,
      labels: {
        arthiCode: t('ARHTI CODE'),
        date: t('Date'),
        generated: t('Generated'),
        footer: t('MandiOS Business Report'),
        proprietor: t('Proprietor'),
        period: t('Report Period'),
        locale: language === 'ur' ? 'ur-PK' : 'en-GB'
      }
    });

    let printDocument = '<!DOCTYPE html><html><head><title>Pay_Slip_' + (employee.name || 'Staff') + '_' + salary.month + '_' + salary.year + '</title>';
    printDocument += '<link href="https://cdn.jsdelivr.net/npm/tailwindcss@3.3.0/dist/tailwind.min.css" rel="stylesheet">';
    printDocument += '<style>';
    printDocument += `
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #0f172a; padding: 16px; }
      ${PRINT_REPORT_HEADER_STYLES}
      .slip-card { border: 2px solid #0f172a; border-radius: 16px; padding: 24px; background: #ffffff; }
      .field-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 10px; }
      .table-slip { width: 100%; border-collapse: collapse; margin-top: 16px; }
      .table-slip th { background: #0f172a; color: #ffffff; padding: 10px 12px; border: 1px solid #334155; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; }
      .table-slip td { padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #1e293b; }
      .text-right { text-align: right; }
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .font-bold { font-weight: 700; }
      .font-black { font-weight: 900; }
    `;
    printDocument += '</style></head><body>';
    
    printDocument += `
      <div class="slip-card shadow-sm">
        ${paySlipHeader}

        <!-- EMPLOYEE INFO -->
        <div class="grid grid-cols-2 gap-3 mb-6">
          <div class="field-box">
            <span class="text-[10px] text-slate-500 font-bold uppercase block">Employee Name</span>
            <span class="text-sm font-black text-slate-900">${employee.name}</span>
          </div>
          <div class="field-box">
            <span class="text-[10px] text-slate-500 font-bold uppercase block">Employee Code / ID</span>
            <span class="text-sm font-black text-indigo-700 font-mono">${employee.employeeId || 'N/A'}</span>
          </div>
          <div class="field-box">
            <span class="text-[10px] text-slate-500 font-bold uppercase block">Designation & Department</span>
            <span class="text-xs font-bold text-slate-800">${employee.designation || 'Staff'} (${employee.department || 'General'})</span>
          </div>
          <div class="field-box">
            <span class="text-[10px] text-slate-500 font-bold uppercase block">Payment Method & Status</span>
            <span class="text-xs font-bold text-slate-800">${salary.paymentMethod} — <span class="text-emerald-700 uppercase font-black">${salary.paymentStatus}</span></span>
          </div>
        </div>

        <!-- SALARY BREAKDOWN TABLE -->
        <table class="table-slip">
          <thead>
            <tr>
              <th>Earning & Deduction Particulars</th>
              <th class="text-right">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${t('Basic Monthly Salary')}</td>
              <td class="text-right font-mono font-bold">Rs. ${(salary.basicSalary || 0).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="text-emerald-700">+ ${t('Bonus & Incentives')}</td>
              <td class="text-right font-mono font-bold text-emerald-700">+ Rs. ${(salary.bonus || 0).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="text-emerald-700">+ ${t('Allowances (Food / Travel / Housing)')}</td>
              <td class="text-right font-mono font-bold text-emerald-700">+ Rs. ${(salary.allowance || 0).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="text-emerald-700">+ ${t('Overtime Earnings')}</td>
              <td class="text-right font-mono font-bold text-emerald-700">+ Rs. ${(salary.overtime || 0).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="text-rose-700">- ${t('Salary Advance Adjustment')}</td>
              <td class="text-right font-mono font-bold text-rose-700">- Rs. ${(salary.advanceDeduction || 0).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="text-rose-700">- ${t('Other Deductions')}</td>
              <td class="text-right font-mono font-bold text-rose-700">- Rs. ${(salary.otherDeductions || 0).toLocaleString()}</td>
            </tr>
            <tr class="bg-indigo-50 font-black text-sm">
              <td class="text-indigo-950 uppercase">${t('Net Disbursed Salary Payout')}</td>
              <td class="text-right font-mono text-indigo-950">Rs. ${(salary.netSalary || 0).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        ${salary.remarks ? `
          <div class="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
            <strong>${t('Remarks / Notes:')}</strong> ${salary.remarks}
          </div>
        ` : ''}

        <!-- SIGNATURES -->
        <div class="mt-12 pt-8 flex justify-between border-t border-slate-300 text-xs font-bold text-slate-700">
          <div class="text-center">
            <div class="w-44 border-b-2 border-slate-800 mb-1"></div>
            <span>${t('Employee Signature')}</span>
          </div>
          <div class="text-center">
            <div class="w-44 border-b-2 border-slate-800 mb-1"></div>
            <span>${escapeHtml(t('Authorized Stamp & Signature ({{business}})', { business: bizName }))}</span>
          </div>
        </div>
      </div>
    `;

    printDocument += '</body></html>';
    const win = openSafePrintWindow(`Pay_Slip_${employee.name || 'Staff'}_${salary.month}_${salary.year}`, printDocument, 'height=800,width=900');
    if (!win) return;
    setTimeout(() => {
      win.print();
    }, 500);
  };

  // Filtering Employees List
  const filteredEmployees = employees.filter(emp => {
    const matchSearch = 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.cnic && emp.cnic.includes(searchQuery)) ||
      emp.phone.includes(searchQuery);

    const matchDesignation = filterDesignation ? emp.designation === filterDesignation : true;
    const matchStatus = filterStatus ? emp.status === filterStatus : true;
    const matchSalaryType = filterSalaryType ? emp.salaryType === filterSalaryType : true;

    return matchSearch && matchDesignation && matchStatus && matchSalaryType;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const designations = [...new Set(employees.map(e => e.designation))];

  // ==================== REPORT FILTERING LOGIC ====================
  const getFilteredReportData = () => {
    switch (selectedReportType) {
      case 'employee_list':
        return employees.map(e => ({
          'Employee ID': e.employeeId,
          'Name': e.name,
          'Designation': e.designation,
          'Phone': e.phone,
          'CNIC': e.cnic || 'N/A',
          'Joining Date': e.joiningDate,
          'Salary Cycle': e.salaryType,
          'Monthly Basic (Rs.)': e.basicSalary,
          'Status': e.status
        }));

      case 'monthly_payroll':
        return allSalaries
          .filter(s => s.month === reportFilters.month && s.year.toString() === reportFilters.year)
          .map(s => {
            const empObj = employees.find(e => e.employeeId === s.employeeId || e._id === s.employeeId);
            return {
              'Employee ID': empObj?.employeeId || s.employeeId,
              'Employee Name': s.employeeName || empObj?.name || 'Unknown',
              'Designation': empObj?.designation || 'Staff',
              'Basic Contract (Rs.)': s.basicSalary,
              'Bonus + Allowances (Rs.)': s.bonus + s.allowance,
              'Overtime (Rs.)': s.overtime,
              'Advance Deducted (Rs.)': s.advanceDeduction,
              'Other Deduct (Rs.)': s.otherDeductions,
              'Net Payout (Rs.)': s.netSalary,
              'Payment Date': s.paymentDate,
              'Status': s.paymentStatus
            };
          });

      case 'payment_status':
        return allSalaries
          .filter(s => {
            const matchStatus = reportFilters.status ? s.paymentStatus === reportFilters.status : true;
            const matchMethod = reportFilters.paymentMethod ? s.paymentMethod === reportFilters.paymentMethod : true;
            return matchStatus && matchMethod;
          })
          .map(s => {
            const empObj = employees.find(e => e.employeeId === s.employeeId || e._id === s.employeeId);
            return {
              'Period': `${s.month} ${s.year}`,
              'Employee ID': empObj?.employeeId || s.employeeId,
              'Employee Name': s.employeeName || empObj?.name || 'Unknown',
              'Basic Salary (Rs.)': s.basicSalary,
              'Net Paid (Rs.)': s.netSalary,
              'Payment Date': s.paymentDate,
              'Payment Method': s.paymentMethod,
              'Payment Status': s.paymentStatus
            };
          });

      case 'pending_salary':
        // Find employees who do not have a processed salary for the chosen Month & Year
        return employees
          .filter(e => e.status === 'Active')
          .filter(e => {
            const empId = e.employeeId || e._id;
            const hasSalary = allSalaries.some(s => 
              (s.employeeId === empId || s.employeeId === e._id) && 
              s.month === reportFilters.month && 
              s.year.toString() === reportFilters.year
            );
            return !hasSalary;
          })
          .map(e => ({
            'Employee ID': e.employeeId,
            'Name': e.name,
            'Designation': e.designation,
            'Contact Mobile': e.phone,
            'Salary Cycle': e.salaryType,
            'Contract Basic (Rs.)': e.basicSalary,
            'Joining Date': e.joiningDate
          }));

      case 'salary_advances':
        return allAdvances
          .filter(a => {
            // Optional month/year filters can map to advance date "YYYY-MM-DD"
            if (reportFilters.month && reportFilters.year) {
              const monthIndex = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
                .indexOf(reportFilters.month.toLowerCase()) + 1;
              const paddedMonth = monthIndex.toString().padStart(2, '0');
              const prefix = `${reportFilters.year}-${paddedMonth}`;
              return a.date.startsWith(prefix);
            }
            return true;
          })
          .map(a => {
            const empObj = employees.find(e => e.employeeId === a.employeeId || e._id === a.employeeId);
            return {
              'Disbursement Date': a.date,
              'Employee ID': empObj?.employeeId || a.employeeId,
              'Employee Name': a.employeeName || empObj?.name || 'Unknown',
              'Advance Disbursed (Rs.)': a.amount,
              'Reason': a.reason || 'Personal Help',
              'Approved By': a.approvedBy || 'Admin'
            };
          });

      case 'staff_expenses':
        // Merges salaries (Paid/Partial) and advances to formulate total Staff Expense Report
        const salariesFiltered = allSalaries
          .filter(s => s.month === reportFilters.month && s.year.toString() === reportFilters.year && s.paymentStatus !== 'Unpaid')
          .map(s => {
            const empObj = employees.find(e => e.employeeId === s.employeeId || e._id === s.employeeId);
            return {
              'Category': 'Monthly Salary Payout',
              'Reference Date': s.paymentDate,
              'Employee Name': s.employeeName || empObj?.name || 'Unknown',
              'Description': `Processed Salary for ${s.month} ${s.year}`,
              'Debit Amount (Rs.)': s.netSalary + (s.advanceDeduction || 0)
            };
          });

        const advancesFiltered = allAdvances
          .filter(a => {
            const monthIndex = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
              .indexOf(reportFilters.month.toLowerCase()) + 1;
            const paddedMonth = monthIndex.toString().padStart(2, '0');
            const prefix = `${reportFilters.year}-${paddedMonth}`;
            return a.date.startsWith(prefix);
          })
          .map(a => {
            const empObj = employees.find(e => e.employeeId === a.employeeId || e._id === a.employeeId);
            return {
              'Category': 'Salary Advance Loan',
              'Reference Date': a.date,
              'Employee Name': a.employeeName || empObj?.name || 'Unknown',
              'Description': `Salary Advance: ${a.reason || 'Domestic Needs'}`,
              'Debit Amount (Rs.)': a.amount
            };
          });

        return [...salariesFiltered, ...advancesFiltered];

      default:
        return [];
    }
  };

  const reportData = getFilteredReportData();

  // Sum calculations for reports
  const getReportTotal = () => {
    if (selectedReportType === 'monthly_payroll') {
      return reportData.reduce((sum, r) => sum + r['Net Payout (Rs.)'], 0);
    }
    if (selectedReportType === 'salary_advances') {
      return reportData.reduce((sum, r) => sum + r['Advance Disbursed (Rs.)'], 0);
    }
    if (selectedReportType === 'staff_expenses') {
      return reportData.reduce((sum, r) => sum + r['Debit Amount (Rs.)'], 0);
    }
    if (selectedReportType === 'employee_list') {
      return reportData.reduce((sum, r) => sum + r['Monthly Basic (Rs.)'], 0);
    }
    if (selectedReportType === 'pending_salary') {
      return reportData.reduce((sum, r) => sum + r['Contract Basic (Rs.)'], 0);
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-700 dark:text-slate-200">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl transition-all border
          ${toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-[#4F46E5]/10 border-[#4F46E5]/20 text-[#4F46E5] dark:text-indigo-400'}`}>
          <CheckCircle2 size={18} />
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight font-display text-slate-800 dark:text-white flex items-center gap-2">
            {t("Employee & Payroll Management")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mt-1">
            {t("Manage employee profiles, monthly salary calculation, salary advances, and automated expense books")}
          </p>
        </div>

        {viewMode === 'list' && (
          <div className="flex flex-wrap gap-2">
            {/* Top Level Nav Tabs */}
            <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 mr-2 text-xs font-black uppercase tracking-wider">
              <button
                onClick={() => { setActiveTopTab('directory'); setViewMode('list'); }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTopTab === 'directory' ? 'bg-[#4F46E5] text-white shadow' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t("Directory")}
              </button>
              <button
                onClick={() => { setActiveTopTab('reports'); setViewMode('list'); }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTopTab === 'reports' ? 'bg-[#4F46E5] text-white shadow' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t("Payroll Reports")}
              </button>
            </div>

            {activeTopTab === 'directory' && isAdmin && (
              <button
                onClick={() => {
                  setModalMode('add');
                  setEmployeeFormData({
                    name: '', fatherName: '', cnic: '', phone: '', alternatePhone: '', email: '',
                    address: '', city: '', photo: '', notes: '', designation: '', department: '',
                    joiningDate: new Date().toISOString().split('T')[0], salaryType: 'Monthly',
                    basicSalary: '', openingAdvance: '0', status: 'Active'
                  });
                  setShowAddEditModal(true);
                }}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-500/15"
              >
                <UserPlus size={16} />
                <span>{t("Add Employee")}</span>
              </button>
            )}

            {activeTopTab === 'directory' && (
              <>
                <button
                  onClick={() => triggerPrint('employees-table-area', 'Employee Directory')}
                  className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-xs font-black uppercase tracking-wider transition-all border border-slate-200 dark:border-slate-800"
                >
                  <Printer size={15} />
                  <span>{t("Print")}</span>
                </button>
                <button
                  onClick={() => {
                    const directoryData = filteredEmployees.map(e => ({
                      'Employee ID': e.employeeId,
                      'Name': e.name,
                      'Designation': e.designation,
                      'Phone': e.phone,
                      'CNIC': e.cnic || 'N/A',
                      'Joining Date': e.joiningDate,
                      'Salary Cycle': e.salaryType,
                      'Monthly Basic (Rs.)': e.basicSalary,
                      'Status': e.status
                    }));
                    downloadPayrollReportPDF({
                      reportTitle: 'Active Staff Directory',
                      reportPeriod: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                      reportData: directoryData,
                      businessProfile: businessProfile,
                      totalAmount: directoryData.reduce((acc, curr) => acc + (Number(curr['Monthly Basic (Rs.)']) || 0), 0)
                    });
                    showToast(t("Directory PDF generated successfully!"));
                  }}
                  className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-rose-600/15 border border-rose-500/20 text-rose-500 hover:bg-rose-600/20 text-xs font-black uppercase tracking-wider transition-all"
                >
                  <FileText size={15} />
                  <span>{t("Download PDF")}</span>
                </button>
                <button
                  onClick={() => exportToExcel(employees, 'employee_mandi_directory')}
                  className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-emerald-600/15 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-600/20 text-xs font-black uppercase tracking-wider transition-all"
                >
                  <FileSpreadsheet size={15} />
                  <span>{t("Excel")}</span>
                </button>
              </>
            )}

            {activeTopTab === 'reports' && (
              <>
                <button
                  onClick={() => triggerPrint('reports-print-area', `${selectedReportType}_report`)}
                  className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-xs font-black uppercase tracking-wider transition-all border border-slate-200 dark:border-slate-800"
                >
                  <Printer size={15} />
                  <span>{t("Print Report")}</span>
                </button>
                <button
                  onClick={() => {
                    downloadPayrollReportPDF({
                      reportTitle: selectedReportType ? selectedReportType.replace(/_/g, ' ') : 'Payroll Report',
                      reportPeriod: reportFilters.month && reportFilters.year ? `${reportFilters.month} ${reportFilters.year}` : '',
                      reportData: reportData,
                      businessProfile: businessProfile,
                      totalAmount: getReportTotal()
                    });
                    showToast(t("Payroll PDF report downloaded successfully!"));
                  }}
                  className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-rose-600/15 border border-rose-500/20 text-rose-500 hover:bg-rose-600/20 text-xs font-black uppercase tracking-wider transition-all"
                >
                  <FileText size={15} />
                  <span>{t("Download PDF")}</span>
                </button>
                <button
                  onClick={() => exportToExcel(reportData, `${selectedReportType}_excel_export`)}
                  className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-emerald-600/15 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-600/20 text-xs font-black uppercase tracking-wider transition-all"
                >
                  <FileSpreadsheet size={15} />
                  <span>{t("Excel Export")}</span>
                </button>
              </>
            )}
          </div>
        )}

        {viewMode === 'profile' && (
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-xs font-black uppercase tracking-wider transition-all border border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft size={15} />
            <span>{t("Back to Directory")}</span>
          </button>
        )}
      </div>

      {/* ==================================== TAB: DIRECTORY VIEW ==================================== */}
      {activeTopTab === 'directory' && viewMode === 'list' && (
        <div className="space-y-6">
          {/* SEARCH & FILTERS BOX */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-md space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800/60">
              <Filter className="text-[#4F46E5] dark:text-indigo-400 shrink-0" size={18} />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t("Directory Filters & Search")}</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 block">{t("Search Employee")}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder={t("ID, Name, CNIC, Phone...")}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 block">{t("Designation")}</label>
                <select
                  value={filterDesignation}
                  onChange={(e) => { setFilterDesignation(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                >
                  <option value="">{t("All Designations")}</option>
                  {designations.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 block">{t("Salary Cycle")}</label>
                <select
                  value={filterSalaryType}
                  onChange={(e) => { setFilterSalaryType(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                >
                  <option value="">{t("All Salary Types")}</option>
                  <option value="Monthly">{t("Monthly")}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 block">{t("Status")}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                >
                  <option value="">{t("All Statuses")}</option>
                  <option value="Active">{t("Active")}</option>
                  <option value="Inactive">{t("Inactive")}</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABLE VIEW */}
          <div className="rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden">
            <div id="employees-table-area" className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">{t("Employee ID")}</th>
                    <th className="py-3 px-4">{t("Photo")}</th>
                    <th className="py-3 px-4">{t("Name")}</th>
                    <th className="py-3 px-4">{t("Designation")}</th>
                    <th className="py-3 px-4">{t("Phone")}</th>
                    <th className="py-3 px-4">{t("CNIC")}</th>
                    <th className="py-3 px-4">{t("Joining Date")}</th>
                    <th className="py-3 px-4">{t("Salary Cycle")}</th>
                    <th className="py-3 px-4 text-right">{t("Monthly Basic")}</th>
                    <th className="py-3 px-4 text-center">{t("Status")}</th>
                    <th className="py-3 px-4 text-center print:hidden">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan="11" className="py-10 text-center text-slate-400">
                        <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <span>{t("Loading directory records...")}</span>
                      </td>
                    </tr>
                  ) : currentEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="py-10 text-center text-slate-400 uppercase font-black tracking-wider">
                        {t("No employee registration logs found.")}
                      </td>
                    </tr>
                  ) : (
                    currentEmployees.map(emp => (
                      <tr key={emp._id || emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#4F46E5] dark:text-indigo-400">{emp.employeeId}</td>
                        <td className="py-3.5 px-4">
                          {emp.photo ? (
                            <img src={emp.photo} alt={emp.name} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 font-black flex items-center justify-center border border-slate-200 dark:border-slate-800 text-sm">
                              {emp.name.charAt(0)}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">
                          <span>{emp.name}</span>
                          {emp.referenceBy && (
                            <span className="block text-[10px] text-indigo-500 font-semibold tracking-tight">{t("Ref:")} {emp.referenceBy}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{emp.designation}</td>
                        <td className="py-3.5 px-4 font-mono">{emp.phone}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">{emp.cnic || 'N/A'}</td>
                        <td className="py-3.5 px-4">{emp.joiningDate}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            {t(emp.salaryType)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black font-mono">{t("Rs.")} {emp.basicSalary.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            emp.status === 'Active' 
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' 
                              : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                          }`}>
                            {t(emp.status)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center print:hidden">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleViewProfile(emp)}
                              className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20"
                              title={t("View Profile")}
                            >
                              <Eye size={14} />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => {
                                    setModalMode('edit');
                                    setSelectedEmployee(emp);
                                    setEmployeeFormData({ ...emp });
                                    setShowAddEditModal(true);
                                  }}
                                  className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20"
                                  title={t("Edit Details")}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteEmployee(emp._id || emp.id, emp.name)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
                                  title={t("Remove Employee")}
                                >
                                  <Trash size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-400">{t("Showing")} {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredEmployees.length)} {t("of")} {filteredEmployees.length} {t("registered employees")}</span>
                <div className="flex space-x-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40"
                  >
                    {t("Previous")}
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40"
                  >
                    {t("Next")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================== TAB: DETAILED PROFILE VIEW ==================================== */}
      {viewMode === 'profile' && selectedEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
          
          {/* PROFILE SUMMARY BADGE */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-md text-center space-y-4">
              <div className="relative inline-block">
                {profileData.employee?.photo ? (
                  <img src={profileData.employee.photo} alt={profileData.employee.name} className="w-24 h-24 rounded-full mx-auto object-cover border-2 border-[#4F46E5] shadow-lg animate-scale-up" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400 font-black text-3xl flex items-center justify-center mx-auto border-2 border-[#4F46E5]/30 shadow-lg animate-scale-up">
                    {profileData.employee?.name?.charAt(0)}
                  </div>
                )}
                <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#1E293B] ${
                  profileData.employee?.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white leading-tight">{profileData.employee?.name}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">{profileData.employee?.designation}</p>
                <p className="text-[10px] font-mono text-[#4F46E5] dark:text-indigo-400 font-bold mt-1 bg-[#4F46E5]/5 py-0.5 px-2 rounded-full inline-block">
                  {profileData.employee?.employeeId}
                </p>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 space-y-2.5 text-left text-xs">
                <div className="flex items-center space-x-2.5 text-slate-500 dark:text-slate-400 font-semibold">
                  <Phone size={14} className="text-[#4F46E5] shrink-0" />
                  <span className="font-mono font-bold">{profileData.employee?.phone}</span>
                </div>
                {profileData.employee?.email && (
                  <div className="flex items-center space-x-2.5 text-slate-500 dark:text-slate-400 font-semibold">
                    <Mail size={14} className="text-[#4F46E5] shrink-0" />
                    <span className="truncate">{profileData.employee.email}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2.5 text-slate-500 dark:text-slate-400 font-semibold">
                  <MapPin size={14} className="text-[#4F46E5] shrink-0" />
                  <span>{profileData.employee?.city || 'N/A'}{t(", Pakistan")}</span>
                </div>
              </div>

              {isAdmin && (
                <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 flex space-x-2">
                  <button
                    onClick={() => {
                      setModalMode('edit');
                      setEmployeeFormData({ ...profileData.employee });
                      setShowAddEditModal(true);
                    }}
                    className="flex-1 py-2 rounded-xl border border-amber-500/20 text-amber-500 hover:bg-amber-500/10 text-xs font-black uppercase tracking-wider transition-colors"
                  >
                    {t("Edit Info")}
                  </button>
                  <button
                    onClick={() => handleDeleteEmployee(profileData.employee?._id || profileData.employee?.id, profileData.employee?.name)}
                    className="p-2 rounded-xl border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 text-xs font-black uppercase tracking-wider transition-colors"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* QUICK STATS CARD */}
            <div className="p-5 rounded-2xl bg-[#1E293B] text-white space-y-4 shadow-md font-semibold">
              <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 border-b border-indigo-500/20 pb-2">{t("Financial Summary")}</h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">{t("Basic Salary")}</span>
                  <span className="font-mono font-black text-sm">{t("Rs.")} {profileData.employee?.basicSalary.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{t("Advance Spent")}</span>
                  <span className="font-mono font-black text-sm text-rose-400">{t("Rs.")} {profileData.advances?.reduce((sum, a) => sum + a.amount, 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{t("Deducted Adv.")}</span>
                  <span className="font-mono font-black text-sm text-emerald-400">{t("Rs.")} {profileData.salaries?.reduce((sum, s) => sum + (s.advanceDeduction || 0), 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{t("Pending Adv.")}</span>
                  <span className="font-mono font-black text-sm text-amber-400">{t("Rs.")} {calculatePendingAdvance(profileData.advances, profileData.salaries).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TABED SECTIONS */}
          <div className="lg:col-span-3 space-y-6">
            {/* TABS SELECTOR */}
            <div className="flex overflow-x-auto p-1 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-sm text-xs font-bold uppercase tracking-wider gap-1">
              {[
                { id: 'personal', label: 'Personal details', icon: FileText },
                { id: 'employment', label: 'Employment logs', icon: Briefcase },
                { id: 'salary', label: 'Salary ledger', icon: DollarSign },
                { id: 'advance', label: 'Advances history', icon: CreditCard },
                { id: 'expense', label: 'Expenses linked', icon: Receipt }
              ].map(tabItem => {
                const IconComp = tabItem.icon;
                const isActive = profileTab === tabItem.id;
                return (
                  <button
                    key={tabItem.id}
                    onClick={() => setProfileTab(tabItem.id)}
                    className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all duration-150
                      ${isActive 
                        ? 'bg-[#4F46E5] text-white shadow-md' 
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                    <IconComp size={14} />
                    <span>{t(tabItem.label)}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENTS CONTAINER */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-md">
              
              {/* TAB 1: PERSONAL DETAILS */}
              {profileTab === 'personal' && (
                <div className="space-y-6 animate-fade-in text-xs font-semibold">
                  <h4 className="text-sm font-black border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-800 dark:text-white uppercase tracking-wider">
                    {t("Personal registration files")}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Full Name")}</span>
                      <span className="text-slate-800 dark:text-white font-bold">{profileData.employee?.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Father Name")}</span>
                      <span className="text-slate-800 dark:text-white font-bold">{profileData.employee?.fatherName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("National CNIC Number")}</span>
                      <span className="font-mono text-slate-800 dark:text-white font-bold">{profileData.employee?.cnic || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Contact Mobile")}</span>
                      <span className="font-mono text-slate-800 dark:text-white font-bold">{profileData.employee?.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Alternate Mobile")}</span>
                      <span className="font-mono text-slate-800 dark:text-white font-bold">{profileData.employee?.alternatePhone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Email ID")}</span>
                      <span className="text-slate-800 dark:text-white font-bold">{profileData.employee?.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Permanent Address")}</span>
                      <span className="text-slate-800 dark:text-white font-bold">{profileData.employee?.address || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("City Location")}</span>
                      <span className="text-slate-800 dark:text-white font-bold">{profileData.employee?.city || 'N/A'}</span>
                    </div>
                  </div>

                  {profileData.employee?.notes && (
                    <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4">
                      <span className="text-slate-400 block mb-1">{t("Special / Medical / Registration Notes")}</span>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-150 dark:border-slate-850">
                        <p className="whitespace-pre-line text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{profileData.employee.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: EMPLOYMENT DETAILS */}
              {profileTab === 'employment' && (
                <div className="space-y-6 animate-fade-in text-xs font-semibold">
                  <h4 className="text-sm font-black border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-800 dark:text-white uppercase tracking-wider">
                    {t("Employment & Contract logs")}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Employee ID")}</span>
                      <span className="font-mono text-[#4F46E5] dark:text-indigo-400 font-black">{profileData.employee?.employeeId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Designation Position")}</span>
                      <span className="text-slate-800 dark:text-white font-bold">{profileData.employee?.designation}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Department Team")}</span>
                      <span className="text-slate-800 dark:text-white font-bold">{profileData.employee?.department || 'Operations Team'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Joining Date")}</span>
                      <span className="text-slate-800 dark:text-white font-bold">{profileData.employee?.joiningDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Salary Payment Cycle")}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400 border border-[#4F46E5]/20 inline-block mt-0.5">
                        {profileData.employee?.salaryType}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Basic Contract Salary")}</span>
                      <span className="font-mono text-slate-800 dark:text-white font-black text-sm">{t("Rs.")} {profileData.employee?.basicSalary.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Initial Opening Advance")}</span>
                      <span className="font-mono text-slate-800 dark:text-white font-black text-sm">{t("Rs.")} {profileData.employee?.openingAdvance?.toLocaleString() || '0'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">{t("Contract Status")}</span>
                      <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        profileData.employee?.status === 'Active' 
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' 
                          : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                      }`}>
                        {profileData.employee?.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SALARY HISTORY */}
              {profileTab === 'salary' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">{t("Salary payments history logs")}</h4>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setSalaryFormData({
                            month: new Date().toLocaleString('en-US', { month: 'long' }),
                            year: new Date().getFullYear().toString(),
                            basicSalary: profileData.employee?.basicSalary.toString() || '',
                            bonus: '0',
                            allowance: '0',
                            overtime: '0',
                            advanceDeduction: calculatePendingAdvance(profileData.advances, profileData.salaries).toString(),
                            otherDeductions: '0',
                            paymentDate: new Date().toISOString().split('T')[0],
                            paymentMethod: 'Cash',
                            paymentStatus: 'Paid',
                            remarks: ''
                          });
                          setShowSalaryModal(true);
                        }}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        <Plus size={14} />
                        <span>{t("Process Salary Payment")}</span>
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-150 dark:border-slate-800/60 text-xs font-semibold">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 border-b border-slate-150 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">{t("Period")}</th>
                          <th className="py-2.5 px-3 text-right">{t("Basic")}</th>
                          <th className="py-2.5 px-3 text-right">{t("Bonus/Allow.")}</th>
                          <th className="py-2.5 px-3 text-right">{t("Overtime")}</th>
                          <th className="py-2.5 px-3 text-right">{t("Advance Ded.")}</th>
                          <th className="py-2.5 px-3 text-right">{t("Net Salary")}</th>
                          <th className="py-2.5 px-3">{t("Payment Date")}</th>
                          <th className="py-2.5 px-3">{t("Method")}</th>
                          <th className="py-2.5 px-3 text-center">{t("Status")}</th>
                          <th className="py-2.5 px-3 text-center">{t("Actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {profileData.salaries?.length === 0 ? (
                          <tr>
                            <td colSpan="10" className="py-8 text-center text-slate-400">
                              {t("No salary payments processed yet.")}
                            </td>
                          </tr>
                        ) : (
                          profileData.salaries.map(sal => (
                            <tr key={sal._id || sal.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                              <td className="py-2.5 px-3 font-bold">{t(sal.month)} {sal.year}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{t("Rs.")} {sal.basicSalary.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-500">{t("+Rs.")} {(sal.bonus + sal.allowance).toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-indigo-500">{t("+Rs.")} {sal.overtime.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-rose-500">{t("-Rs.")} {sal.advanceDeduction.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-slate-800 dark:text-white">{t("Rs.")} {sal.netSalary.toLocaleString()}</td>
                              <td className="py-2.5 px-3">{sal.paymentDate}</td>
                              <td className="py-2.5 px-3 text-slate-500">{t(sal.paymentMethod)}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  sal.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-500' :
                                  sal.paymentStatus === 'Partial' ? 'bg-amber-500/10 text-amber-500' :
                                  'bg-rose-500/10 text-rose-500'
                                }`}>
                                  {t(sal.paymentStatus)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  <button
                                    onClick={() => triggerPrintPaySlip(sal, profileData.employee)}
                                    className="p-1 rounded text-indigo-500 hover:bg-indigo-500/10"
                                    title={t("Print Official Salary Pay Slip")}
                                  >
                                    <Printer size={12} />
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDeleteSalary(sal._id || sal.id)}
                                      className="p-1 rounded text-rose-500 hover:bg-rose-500/10"
                                      title={t("Delete salary record")}
                                    >
                                      <Trash size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: ADVANCES HISTORY */}
              {profileTab === 'advance' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">{t("Salary advances disbursed logs")}</h4>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setAdvanceFormData({
                            date: new Date().toISOString().split('T')[0],
                            amount: '',
                            reason: '',
                            remarks: ''
                          });
                          setShowAdvanceModal(true);
                        }}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/10"
                      >
                        <Plus size={14} />
                        <span>{t("Disburse Salary Advance")}</span>
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-150 dark:border-slate-800/60 text-xs font-semibold">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 border-b border-slate-150 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">{t("Date")}</th>
                          <th className="py-2.5 px-3 text-right">{t("Advance Amount")}</th>
                          <th className="py-2.5 px-3">{t("Disbursed / Reason")}</th>
                          <th className="py-2.5 px-3">{t("Approved By")}</th>
                          <th className="py-2.5 px-3">{t("Audit / Remarks")}</th>
                          <th className="py-2.5 px-3 text-center">{t("Actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {profileData.employee?.openingAdvance > 0 && (
                          <tr className="bg-amber-500/5 hover:bg-amber-500/10">
                            <td className="py-2.5 px-3 italic font-bold">{profileData.employee.joiningDate}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-amber-500">{t("Rs.")} {profileData.employee.openingAdvance.toLocaleString()}</td>
                            <td className="py-2.5 px-3 italic font-bold">{t("Opening Contract Advance Balance")}</td>
                            <td className="py-2.5 px-3">{t("System")}</td>
                            <td className="py-2.5 px-3 text-slate-400 font-bold">{t("Added automatically at employee setup")}</td>
                            <td className="py-2.5 px-3 text-center text-slate-400 italic">{t("Static")}</td>
                          </tr>
                        )}
                        {profileData.advances?.length === 0 && (!profileData.employee?.openingAdvance || profileData.employee.openingAdvance === 0) ? (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-slate-400">
                              {t("No salary advances recorded.")}
                            </td>
                          </tr>
                        ) : (
                          profileData.advances.map(adv => (
                            <tr key={adv._id || adv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                              <td className="py-2.5 px-3 font-mono">{adv.date}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-rose-500">{t("Rs.")} {adv.amount.toLocaleString()}</td>
                              <td className="py-2.5 px-3">{t(adv.reason || 'Personal / Domestic Needs')}</td>
                              <td className="py-2.5 px-3 text-indigo-500 font-bold">{adv.approvedBy || 'Admin'}</td>
                              <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">{adv.remarks || '-'}</td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center">
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDeleteAdvance(adv._id || adv.id)}
                                      className="p-1 rounded text-rose-500 hover:bg-rose-500/10"
                                      title={t("Delete advance record")}
                                    >
                                      <Trash size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: EXPENSES LINKED */}
              {profileTab === 'expense' && (
                <div className="space-y-6 animate-fade-in text-xs font-semibold">
                  <h4 className="text-sm font-black border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-800 dark:text-white uppercase tracking-wider">
                    {t("Automatically linked expense module logs")}
                  </h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {t("The general ledger automatically maps salaries and other miscellaneous cash payouts matching the name/ID of")} <b>{profileData.employee?.name}</b> {t("in real-time.")}
                  </p>

                  <div className="overflow-x-auto rounded-xl border border-slate-150 dark:border-slate-800/60">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 border-b border-slate-150 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">{t("Expense Category")}</th>
                          <th className="py-2.5 px-3">{t("Recorded Date")}</th>
                          <th className="py-2.5 px-3 text-right">{t("Amount Outbound")}</th>
                          <th className="py-2.5 px-3">{t("Description Record")}</th>
                          <th className="py-2.5 px-3">{t("Recorded By")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {profileData.expenses?.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-slate-400">
                              {t("No expense entries found matching this employee.")}
                            </td>
                          </tr>
                        ) : (
                          profileData.expenses.map(exp => (
                            <tr key={exp._id || exp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 font-bold border border-indigo-100 dark:border-indigo-900">
                                  {t(exp.category)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono">{exp.date}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-rose-500">{t("Rs.")} {exp.amount.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-sm truncate">{exp.description}</td>
                              <td className="py-2.5 px-3 text-slate-400 font-bold">{exp.recordedBy || 'System'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* ==================================== TAB: PAYROLL REPORTS VIEW ==================================== */}
      {activeTopTab === 'reports' && viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
          
          {/* REPORTS NAVIGATION PANEL */}
          <div className="lg:col-span-1 p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-md space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 text-[#4F46E5] dark:text-indigo-400">
              {t("Select Payroll Report")}
            </h3>

            <div className="space-y-1.5">
              {[
                { id: 'monthly_payroll', label: 'Monthly Payroll Sheet', icon: DollarSign, desc: 'Calculate monthly take-home payouts' },
                { id: 'employee_list', label: 'Active Staff Directory', icon: Users, desc: 'Overview of joined contract employees' },
                { id: 'payment_status', label: 'Disbursement Status', icon: Receipt, desc: 'Filter cash payouts by Paid/Unpaid' },
                { id: 'pending_salary', label: 'Pending Salaries Due', icon: AlertTriangle, desc: 'Track staff pending salaries' },
                { id: 'salary_advances', label: 'Advances & Loans Ledger', icon: CreditCard, desc: 'Advances disbursed to employees' },
                { id: 'staff_expenses', label: 'Staff Expenditure Audit', icon: BarChart3, desc: 'Accumulated staff expenses ledger' }
              ].map(rep => {
                const IconComp = rep.icon;
                const isActive = selectedReportType === rep.id;
                return (
                  <button
                    key={rep.id}
                    onClick={() => { setSelectedReportType(rep.id); }}
                    className={`w-full text-left p-3 rounded-xl transition-all border flex items-start space-x-3
                      ${isActive 
                        ? 'bg-[#4F46E5]/10 border-[#4F46E5]/30 text-[#4F46E5] dark:text-indigo-400' 
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                    <IconComp size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wide leading-tight">{t(rep.label)}</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wide">{t(rep.desc)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* REPORT VIEWPORT & FILTER SECTION */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* REPORT FILTERING OPTIONS */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-md">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
                
                {/* Year Selection */}
                {['monthly_payroll', 'pending_salary', 'salary_advances', 'staff_expenses'].includes(selectedReportType) && (
                  <div className="space-y-1">
                    <label className="text-slate-400 block uppercase font-bold tracking-wider">{t("Select Payroll Year")}</label>
                    <select
                      value={reportFilters.year}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, year: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      {[2025, 2026, 2027, 2028].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Month Selection */}
                {['monthly_payroll', 'pending_salary', 'salary_advances', 'staff_expenses'].includes(selectedReportType) && (
                  <div className="space-y-1">
                    <label className="text-slate-400 block uppercase font-bold tracking-wider">{t("Select Payroll Month")}</label>
                    <select
                      value={reportFilters.month}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, month: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                        <option key={m} value={m}>{t(m)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Extra Filter for Payment Status Report */}
                {selectedReportType === 'payment_status' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-slate-400 block uppercase font-bold tracking-wider">{t("Disbursement Status")}</label>
                      <select
                        value={reportFilters.status}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      >
                        <option value="">{t("All Statuses")}</option>
                        <option value="Paid">{t("Fully Paid")}</option>
                        <option value="Partial">{t("Partial Payments")}</option>
                        <option value="Unpaid">{t("Unpaid / Deferred")}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 block uppercase font-bold tracking-wider">{t("Payment Method")}</label>
                      <select
                        value={reportFilters.paymentMethod}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      >
                        <option value="">{t("All Methods")}</option>
                        <option value="Cash">{t("Cash Handout")}</option>
                        <option value="Bank Transfer">{t("Bank Transfer")}</option>
                        <option value="Check">{t("Check")}</option>
                        <option value="Mobile Wallet">{t("EasyPaisa/JazzCash")}</option>
                      </select>
                    </div>
                  </>
                )}

              </div>
            </div>

            {/* REPORT VIEWPORT TABLE */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/80 shadow-md">
              <div id="reports-print-area" className="space-y-6">
                
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="print:hidden">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      {selectedReportType.replace(/_/g, ' ')}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {t("Period:")} {t(reportFilters.month)} {reportFilters.year} {t("• Records:")} {reportData.length}
                    </p>
                  </div>
                  <p className="hidden print:block text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {t("Records")}: {reportData.length}
                  </p>
                  {getReportTotal() !== null && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">{t("Accumulated Total Sum")}</span>
                      <span className="font-mono font-black text-sm text-[#4F46E5] dark:text-indigo-400">
                        {t("Rs.")} {getReportTotal().toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {reportsLoading ? (
                  <div className="py-20 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs font-bold uppercase tracking-widest">{t("Loading Report Ledgers...")}</span>
                  </div>
                ) : reportData.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
                    <span className="text-xs font-black uppercase tracking-wider">{t("No payroll logs matching the search filters found.")}</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-150 dark:border-slate-800/60 text-xs font-semibold">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 border-b border-slate-150 dark:border-slate-800">
                        <tr>
                          {Object.keys(reportData[0]).map(header => (
                            <th key={header} className={`py-2.5 px-3 ${header.includes('(Rs.)') || header.includes('Basic') || header.includes('Payout') ? 'text-right' : 'text-left'}`}>
                              {t(header)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {reportData.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                            {Object.entries(row).map(([key, val], cIdx) => (
                              <td key={cIdx} className={`py-2.5 px-3 ${key.includes('(Rs.)') || key.includes('Basic') || key.includes('Payout') ? 'text-right font-mono font-bold' : ''}`}>
                                {key.includes('(Rs.)') || key.includes('Basic') || key.includes('Payout') ? (
                                  `Rs. ${Number(val).toLocaleString()}`
                                ) : key === 'Status' || key === 'Payment Status' ? (
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    val === 'Paid' || val === 'Active' ? 'bg-emerald-500/10 text-emerald-500' :
                                    val === 'Partial' ? 'bg-amber-500/10 text-amber-500' :
                                    'bg-rose-500/10 text-rose-500'
                                  }`}>
                                    {val}
                                  </span>
                                ) : (
                                  val
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

      {/* ==================================== MODAL: ADD / EDIT EMPLOYEE ==================================== */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-hidden animate-fade-in my-8 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-[#4F46E5] text-white">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight dark:text-white">
                    {modalMode === 'add' ? t("Register New Mandi Employee") : t("Edit Employee Registration File")}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {modalMode === 'add' ? t("Enter employee contract details") : t("Update contract and personal details")}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAddEditModal(false)} className="p-1.5 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            {employeeModalAlert && (
              <div className="px-6 pt-4">
                <DialogAlert alert={employeeModalAlert} onDismiss={() => setEmployeeModalAlert(null)} />
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleEmployeeSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-bold uppercase tracking-wide">
              {/* Personal Information Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-indigo-500 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                  {t("👤 Personal Identification & Profile Info")}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Full Name")} <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={employeeFormData.name}
                      onChange={handleFormChange}
                      placeholder={t("e.g. Raheel Muhammad")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Father Name")}</label>
                    <input
                      type="text"
                      name="fatherName"
                      value={employeeFormData.fatherName}
                      onChange={handleFormChange}
                      placeholder={t("Father's full name")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("CNIC Card Number")}</label>
                    <input
                      type="text"
                      name="cnic"
                      value={employeeFormData.cnic}
                      onChange={handleFormChange}
                      placeholder={t("37405-XXXXXXX-X")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Primary Mobile")} <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="phone"
                      required
                      value={employeeFormData.phone}
                      onChange={handleFormChange}
                      placeholder="e.g. 03001234567"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5] font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Alternate Mobile")}</label>
                    <input
                      type="text"
                      name="alternatePhone"
                      value={employeeFormData.alternatePhone}
                      onChange={handleFormChange}
                      placeholder={t("Secondary contact phone")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5] font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Email ID")}</label>
                    <input
                      type="email"
                      name="email"
                      value={employeeFormData.email}
                      onChange={handleFormChange}
                      placeholder={t("email@mandi.com")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5] font-mono text-slate-600 dark:text-slate-300 lowercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-slate-400 block">{t("Address Details")}</label>
                    <input
                      type="text"
                      name="address"
                      value={employeeFormData.address}
                      onChange={handleFormChange}
                      placeholder={t("Full resident address")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("City Location")}</label>
                    <input
                      type="text"
                      name="city"
                      value={employeeFormData.city}
                      onChange={handleFormChange}
                      placeholder={t("Rawalpindi / Sargodha")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Profile Image URL")}</label>
                    <input
                      type="text"
                      name="photo"
                      value={employeeFormData.photo}
                      onChange={handleFormChange}
                      placeholder={t("https://images.unsplash.com/... or upload link")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Reference By")} ({t("Optional")})</label>
                    <input
                      type="text"
                      name="referenceBy"
                      value={employeeFormData.referenceBy || ''}
                      onChange={handleFormChange}
                      placeholder={t("e.g. Malik Ahmad / Munshi")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Initial Status")}</label>
                    <select
                      name="status"
                      value={employeeFormData.status}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                    >
                      <option value="Active">{t("Active / On duty")}</option>
                      <option value="Inactive">{t("Inactive / Suspended")}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Employment Contract Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-indigo-500 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                  {t("💼 Official Position & Salary Contract details")}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Designation Position")} <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="designation"
                      required
                      value={employeeFormData.designation}
                      onChange={handleFormChange}
                      placeholder={t("e.g. Weighbridge Clerk, Driver, Munshi")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Department Team")}</label>
                    <input
                      type="text"
                      name="department"
                      value={employeeFormData.department}
                      onChange={handleFormChange}
                      placeholder={t("Weighing, Accounting, Loading")}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Official Joining Date")} <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      name="joiningDate"
                      required
                      value={employeeFormData.joiningDate}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Salary Payment Cycle")} <span className="text-rose-500">*</span></label>
                    <select
                      name="salaryType"
                      value={employeeFormData.salaryType}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="Monthly">{t("Monthly Cycle")}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Basic Contract Salary")} <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">{t("Rs.")}</span>
                      <input
                        type="number"
                        name="basicSalary"
                        required
                        value={employeeFormData.basicSalary}
                        onChange={handleFormChange}
                        placeholder="e.g. 35000"
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5] font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block">{t("Opening Advance Balance")}</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">{t("Rs.")}</span>
                      <input
                        type="number"
                        name="openingAdvance"
                        value={employeeFormData.openingAdvance}
                        onChange={handleFormChange}
                        placeholder={t("Pending loan/advance if any")}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#4F46E5] font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Notes & Extra Details")}</label>
                  <textarea
                    name="notes"
                    value={employeeFormData.notes}
                    onChange={handleFormChange}
                    placeholder={t("Provide details about emergency contact, medical info, previous employers, or references...")}
                    rows="3"
                    className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-[#4F46E5] normal-case"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-5 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all font-black text-xs uppercase"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={employeeSubmitting}
                  className="px-6 py-3 bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl transition-all shadow-lg shadow-indigo-500/15 font-black text-xs uppercase flex items-center space-x-2 cursor-pointer"
                >
                  {employeeSubmitting ? (
                    <>
                      <SpokeSpinner size={16} color="#FFFFFF" />
                      <span>{t("Saving...")}</span>
                    </>
                  ) : (
                    <span>{t("Save employee file")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================== MODAL: PROCESS SALARY PAYMENT ==================================== */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-hidden animate-fade-in my-8 max-h-[95vh] flex flex-col">
            
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
                  <DollarSign size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight dark:text-white">{t("Process Salary Payment")}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {t("Disburse monthly salary to")} {selectedEmployee?.name}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowSalaryModal(false)} className="p-1.5 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            {salaryModalAlert && (
              <div className="px-6 pt-4">
                <DialogAlert alert={salaryModalAlert} onDismiss={() => setSalaryModalAlert(null)} />
              </div>
            )}

            <form onSubmit={handleSalarySubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs font-bold uppercase tracking-wide">
              
              {/* Year & Month Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Salary Year")} <span className="text-rose-500">*</span></label>
                  <select
                    value={salaryFormData.year}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                  >
                    {[2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Salary Month")} <span className="text-rose-500">*</span></label>
                  <select
                    value={salaryFormData.month}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, month: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                      <option key={m} value={m}>{t(m)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Basic Salary, Bonus, Allowance */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Basic Contract Salary")} <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    value={salaryFormData.basicSalary}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, basicSalary: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Bonus / Reward")}</label>
                  <input
                    type="number"
                    value={salaryFormData.bonus}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, bonus: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Allowances")}</label>
                  <input
                    type="number"
                    value={salaryFormData.allowance}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, allowance: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-emerald-500"
                  />
                </div>
              </div>

              {/* Overtime, Advance Deduction, Other Deductions */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Overtime Pay")}</label>
                  <input
                    type="number"
                    value={salaryFormData.overtime}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, overtime: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Advance Deduction")}</label>
                  <input
                    type="number"
                    value={salaryFormData.advanceDeduction}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, advanceDeduction: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-rose-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Other Deductions")}</label>
                  <input
                    type="number"
                    value={salaryFormData.otherDeductions}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, otherDeductions: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-rose-500"
                  />
                </div>
              </div>

              {/* Dynamic Calculated Net Salary Display */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">{t("Net Take-Home Salary Calculation Formula")}</span>
                  <span className="text-[10px] text-indigo-500 italic lowercase tracking-wider">{t("Basic + Bonus + Allowance + Overtime - Advance - Other Deductions")}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">{t("Calculated Salary")}</span>
                  <span className="font-mono font-black text-lg text-emerald-500">{t("Rs.")} {computedNetSalary().toLocaleString()}</span>
                </div>
              </div>

              {/* Payment details */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Payment Date")} <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    value={salaryFormData.paymentDate}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Payment Method")} <span className="text-rose-500">*</span></label>
                  <select
                    value={salaryFormData.paymentMethod}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                  >
                    {(() => {
                      const activeSettingMethods = (settingPaymentMethods || [])
                        .filter(m => m.status === 'Active' || !m.status)
                        .map(m => m.name);
                      
                      let methodsList = activeSettingMethods.length > 0
                        ? Array.from(new Set(activeSettingMethods))
                        : ['Cash'];

                      if (salaryFormData.paymentMethod && !methodsList.includes(salaryFormData.paymentMethod)) {
                        methodsList = [...methodsList, salaryFormData.paymentMethod];
                      }

                      return methodsList.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ));
                    })()}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{t("Payment Status")} <span className="text-rose-500">*</span></label>
                  <select
                    value={salaryFormData.paymentStatus}
                    onChange={(e) => setSalaryFormData(prev => ({ ...prev, paymentStatus: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                  >
                    <option value="Paid">{t("Mark as Fully Paid")}</option>
                    <option value="Partial">{t("Mark as Partial Payment")}</option>
                    <option value="Unpaid">{t("Unpaid / Deferred")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block">{t("Remarks & Audit Logs")}</label>
                <input
                  type="text"
                  value={salaryFormData.remarks}
                  onChange={(e) => setSalaryFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder={t("e.g. Cleared pending advance and credited Eid Bonus")}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none normal-case"
                />
              </div>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 leading-normal normal-case font-medium text-[10.5px]">
                💡 <b>{t("MANDATORY AUTOMATIC EXPENSE FLOW:")}</b> {t("Marking this salary payment as")} <b>{t("Paid")}</b> {t("or")} <b>{t("Partial")}</b> {t("will immediately register a general expense with category")} <b>{t("Salary")}</b> {t("(including net salary payout + advance deducted) to update")} <b>{t("Mandi Expenses")}</b> {t("in Dashboard stats and Profit & Loss calculations.")}
              </div>

              <div className="border-t border-slate-100 dark:border-[#1E293B] pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSalaryModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 rounded-xl transition-all font-black text-xs uppercase"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={salarySubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md shadow-emerald-500/10 font-black text-xs uppercase flex items-center space-x-2 cursor-pointer"
                >
                  {salarySubmitting ? (
                    <>
                      <SpokeSpinner size={16} color="#FFFFFF" />
                      <span>{t("Processing...")}</span>
                    </>
                  ) : (
                    <span>{t("Confirm & Process Payment")}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ==================================== MODAL: RECORD SALARY ADVANCE ==================================== */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-hidden animate-fade-in flex flex-col">
            
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-600 text-white">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight dark:text-white">{t("Record Salary Advance")}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {t("Disburse emergency advance to")} {selectedEmployee?.name}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAdvanceModal(false)} className="p-1.5 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            {advanceModalAlert && (
              <div className="px-6 pt-4">
                <DialogAlert alert={advanceModalAlert} onDismiss={() => setAdvanceModalAlert(null)} />
              </div>
            )}

            <form onSubmit={handleAdvanceSubmit} className="p-6 space-y-4 text-xs font-bold uppercase tracking-wide">
              
              <div className="space-y-1">
                <label className="text-slate-400 block">{t("Advance Amount")} <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2 text-slate-400 font-bold">{t("Rs.")}</span>
                  <input
                    type="number"
                    required
                    value={advanceFormData.amount}
                    onChange={(e) => setAdvanceFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="e.g. 5000"
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block">{t("Disbursement Date")} <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  required
                  value={advanceFormData.date}
                  onChange={(e) => setAdvanceFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block">{t("Reason for Loan / Advance")}</label>
                <input
                  type="text"
                  value={advanceFormData.reason}
                  onChange={(e) => setAdvanceFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={t("e.g. Domestic medical expense, family travel")}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none normal-case"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block">{t("Office Remarks")}</label>
                <input
                  type="text"
                  value={advanceFormData.remarks}
                  onChange={(e) => setAdvanceFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder={t("Add details about repayment or installments...")}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none normal-case"
                />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 rounded-xl transition-all font-black text-xs uppercase"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={advanceSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md shadow-amber-500/10 font-black text-xs uppercase flex items-center space-x-2 cursor-pointer"
                >
                  {advanceSubmitting ? (
                    <>
                      <SpokeSpinner size={16} color="#FFFFFF" />
                      <span>{t("Recording...")}</span>
                    </>
                  ) : (
                    <span>{t("Confirm Advance")}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
