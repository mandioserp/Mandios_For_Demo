import React, { useState, useEffect } from 'react';
// import CommissionSettings from './CommissionSettings.jsx';
// import ProductDefaultSettings from './ProductDefaultSettings.jsx';
import UnitManagement from './UnitManagement.jsx';
// import ChargeManagement from './ChargeManagement.jsx';
import ExpenseCategories from './ExpenseCategories.jsx';
import PaymentMethods from './PaymentMethods.jsx';
import InvoiceSettings from './InvoiceSettings.jsx';
import ChangePassword from './ChangePassword.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
// import BackupSettings from './BackupSettings.jsx';

import {
  Scale,
  Tag,
  CreditCard,
  FileText,
  KeyRound,
} from 'lucide-react';

export default function SettingsContainer({ tab, showToast }) {
  const { t } = useLanguage();
  const [activeSettingTab, setActiveSettingTab] = useState('units');

  useEffect(() => {
    if (tab && tab.includes('_')) {
      const sub = tab.substring(tab.indexOf('_') + 1);
      setActiveSettingTab(sub);
    } else {
      setActiveSettingTab('units');
    }
  }, [tab]);

  const settingTabs = [
    { id: 'units', name: 'Unit Management', icon: Scale },
    { id: 'expenses', name: 'Expense Categories', icon: Tag },
    { id: 'payments', name: 'Payment Methods', icon: CreditCard },
    { id: 'invoice', name: 'Invoice Layout', icon: FileText },
    { id: 'password', name: 'Change Password', icon: KeyRound },
  ];

  const renderActiveComponent = () => {
    switch (activeSettingTab) {
      case 'units':
        return <UnitManagement showToast={showToast} />;
      case 'expenses':
        return <ExpenseCategories showToast={showToast} />;
      case 'payments':
        return <PaymentMethods showToast={showToast} />;
      case 'invoice':
        return <InvoiceSettings showToast={showToast} />;
      case 'password':
      case 'security':
        return <ChangePassword showToast={showToast} />;
      default:
        return <UnitManagement showToast={showToast} />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-fade-in text-slate-800 dark:text-slate-100">
      
      {/* Left sidebar nav within the Settings Panel */}
      <div className="w-full lg:w-64 shrink-0 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">{t('Settings Panels')}</h2>
          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{t('Configure system-wide parameters.')}</p>
        </div>

        <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1.5 pb-3 lg:pb-0 scrollbar-none">
          {settingTabs.map(tab => {
            const Icon = tab.icon;
            const isSelected = activeSettingTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSettingTab(tab.id)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-left text-xs font-bold uppercase tracking-wider transition-all duration-150 shrink-0 border-l-4 ${
                  isSelected
                    ? 'bg-[#4F46E5]/10 text-[#4F46E5] dark:text-indigo-400 border-[#4F46E5] opacity-100'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 border-transparent opacity-85'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-[#4F46E5] dark:text-indigo-400' : 'opacity-70'} />
                <span>{t(tab.name)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Setting Subview Area */}
      <div className="flex-1 min-w-0">
        {renderActiveComponent()}
      </div>

    </div>
  );
}
