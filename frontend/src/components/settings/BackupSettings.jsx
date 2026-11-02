/*
import React, { useState } from 'react';
import api from '../../utils/api.js';
import { Database, Download, CloudLightning, ShieldAlert } from 'lucide-react';
*/

export default function BackupSettings({ showToast }) {
  /*
  const [backingUp, setBackingUp] = useState(false);
  const [backupSchedule, setBackupSchedule] = useState('Weekly');

  const triggerBackupDownload = async () => {
    setBackingUp(true);
    try {
      // Fetch datasets across all core collections
      const [
        products,
        customers,
        suppliers,
        sales,
        payments,
        stocks,
        ledgers,
        business,
        rules
      ] = await Promise.all([
        api.get('/products').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/suppliers').catch(() => ({ data: [] })),
        api.get('/sales').catch(() => ({ data: [] })),
        api.get('/payments').catch(() => ({ data: [] })),
        api.get('/stocks').catch(() => ({ data: [] })),
        api.get('/ledgers').catch(() => ({ data: [] })),
        api.get('/settings/business').catch(() => ({ data: {} })),
        // api.get('/settings/commission-rules').catch(() => ({ data: [] }))
        Promise.resolve({ data: [] })
      ]);

      const backupData = {
        meta: {
          generatedAt: new Date().toISOString(),
          version: '1.0.0',
          system: 'Mandi Brokerage MERN Stack'
        },
        payload: {
          products: products.data,
          customers: customers.data,
          suppliers: suppliers.data,
          sales: sales.data,
          payments: payments.data,
          stocks: stocks.data,
          ledgers: ledgers.data,
          businessSettings: business.data,
          commissionRules: rules.data || []
        }
      };

      // Trigger standard web browser JSON download
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      
      const fileTimestamp = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('download', `mandi_db_backup_${fileTimestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast('Database backup compiled and downloaded successfully!');
    } catch (err) {
      showToast('Backup execution failed. Check system console.', 'error');
    } finally {
      setBackingUp(false);
    }
  };
  */

  return (
    <div className="p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl">
      <p className="text-xs text-slate-400 italic">System backups module is currently disabled.</p>
    </div>
  );
}

export function backupSettingsHelper() {}

