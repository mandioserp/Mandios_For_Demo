import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import SpokeSpinner from '../common/SpokeSpinner.jsx';

export default function InvoiceSettings({ showToast }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    companyLogo: '',
    header: '',
    footer: '',
    termsAndConditions: '',
    showCommissionDeduction: true,
    showAuxiliaryCharges: true,
    defaultDueDateDays: 15,
    paperSize: 'A4',
    invoicePrefix: 'INV',
    invoiceStartingNumber: 1001,
    signature: 'Authorized Signatory'
  });

  useEffect(() => {
    fetchInvoiceSettings();
  }, []);

  const fetchInvoiceSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/invoice');
      if (res.data) {
        setFormData({
          ...res.data,
          defaultDueDateDays: Number(res.data.defaultDueDateDays) || 15,
          paperSize: res.data.paperSize || 'A4',
          invoicePrefix: res.data.invoicePrefix || 'INV',
          invoiceStartingNumber: Number(res.data.invoiceStartingNumber) || 1001,
          signature: res.data.signature || 'Authorized Signatory'
        });
      }
    } catch (err) {
      showToast('Failed to load invoice layout settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'defaultDueDateDays' || name === 'invoiceStartingNumber' ? Number(value) : value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/invoice', formData);
      showToast('Invoice layout settings updated successfully!');
    } catch (err) {
      showToast('Failed to update invoice configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl animate-fade-in">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-lg space-y-6">
        <div>
          <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t('Invoice Sizing & Prints')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Configure standard parameters for generating bills, print slips, and billing cycles.')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Header */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Invoice Header Text')}</label>
            <input
              type="text"
              name="header"
              value={formData.header || ''}
              onChange={handleChange}
              placeholder="e.g. COMMISSION AGENT & WHOLESALE BROKER"
              className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl outline-none focus:border-[#4F46E5]"
            />
          </div>

          {/* Footer */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Invoice Footer Note')}</label>
            <input
              type="text"
              name="footer"
              value={formData.footer || ''}
              onChange={handleChange}
              placeholder="e.g. Thanks for buying! Cheques subject to realization."
              className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl outline-none focus:border-[#4F46E5]"
            />
          </div>

          {/* Terms & Conditions */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Terms & Conditions')}</label>
            <textarea
              name="termsAndConditions"
              value={formData.termsAndConditions || ''}
              onChange={handleChange}
              placeholder="Write detailed Mandi association guidelines or payment rules here..."
              rows="3"
              className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl outline-none resize-none focus:border-[#4F46E5]"
            />
          </div>

          {/* Invoice Logo URL */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Invoice Specific Brand Logo URL')}</label>
            <input
              type="text"
              name="companyLogo"
              value={formData.companyLogo || ''}
              onChange={handleChange}
              placeholder="e.g. https://domain.com/invoice-logo.png"
              className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl outline-none focus:border-[#4F46E5]"
            />
          </div>

          {/* Default Due Date days */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Default Billing Due Cycle (Days)')}</label>
            <input
              type="number"
              name="defaultDueDateDays"
              value={formData.defaultDueDateDays}
              onChange={handleChange}
              min="0"
              className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl outline-none focus:border-[#4F46E5]"
            />
          </div>

          {/* Invoice Layout Format (Paper Size) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Invoice Print Format')}</label>
            <select
              name="paperSize"
              value={formData.paperSize}
              onChange={handleChange}
              className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl outline-none focus:border-[#4F46E5] text-xs"
            >
              <option value="A4">{t('A4 (Standard Full Layout)')}</option>
              <option value="A5">{t('A5 (Compact Split Sheet)')}</option>
              <option value="Thermal 3-inch">{t('Thermal 3-inch (Receipt Slip)')}</option>
              <option value="Letter">{t('Letter size (Standard US)')}</option>
            </select>
          </div>

          {/* Invoice Prefix */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Invoice No. Prefix')}</label>
            <input
              type="text"
              name="invoicePrefix"
              value={formData.invoicePrefix}
              onChange={handleChange}
              placeholder="e.g. INV"
              className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl outline-none focus:border-[#4F46E5]"
            />
          </div>

          {/* Invoice Starting Serial */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Invoice Starting Serial No.')}</label>
            <input
              type="number"
              name="invoiceStartingNumber"
              value={formData.invoiceStartingNumber}
              onChange={handleChange}
              min="1"
              className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl outline-none focus:border-[#4F46E5]"
            />
          </div>

          {/* Signature text */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Authorized Signatory Text')}</label>
            <input
              type="text"
              name="signature"
              value={formData.signature}
              onChange={handleChange}
              placeholder="e.g. Authorized Signatory / Accountant"
              className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl outline-none focus:border-[#4F46E5]"
            />
          </div>

          {/* Print Toggles */}
          <div className="flex flex-col space-y-4 pt-6 md:pl-4 md:col-span-2">
            <div className="flex items-center space-x-2.5">
              <input
                type="checkbox"
                name="showCommissionDeduction"
                id="showCommissionDeduction"
                checked={!!formData.showCommissionDeduction}
                onChange={handleChange}
                className="w-4 h-4 text-[#4F46E5] border-slate-300 rounded focus:ring-[#4F46E5]"
              />
              <label htmlFor="showCommissionDeduction" className="font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                Print Commission Deductions explicitly on Slips
              </label>
            </div>

            <div className="flex items-center space-x-2.5">
              <input
                type="checkbox"
                name="showAuxiliaryCharges"
                id="showAuxiliaryCharges"
                checked={!!formData.showAuxiliaryCharges}
                onChange={handleChange}
                className="w-4 h-4 text-[#4F46E5] border-slate-300 rounded focus:ring-[#4F46E5]"
              />
              <label htmlFor="showAuxiliaryCharges" className="font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                Show detailed auxiliary itemized bills (Labor, Charity etc)
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center space-x-2 cursor-pointer"
          >
            {saving ? (
              <>
                <SpokeSpinner size={16} color="#FFFFFF" />
                <span>{t('UPDATING INVOICES...')}</span>
              </>
            ) : (
              <span>{t('SAVE INVOICE PRESETS')}</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
export async function getInvoiceSettingsHelper() {}
