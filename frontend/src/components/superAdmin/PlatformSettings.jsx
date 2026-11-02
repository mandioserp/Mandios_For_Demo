import { useState, useEffect, useCallback } from 'react';
import { 
  Settings, Download, Server, Database, Megaphone, Trash2,
  ShieldCheck, Save, RefreshCw
} from 'lucide-react';
import api from '../../utils/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import ChangePassword from '../settings/ChangePassword.jsx';

export default function PlatformSettings({ onShowToast }) {
  const { t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('settings'); // 'settings' | 'telemetry' | 'backup' | 'announcements' | 'password'
  const [settings, setSettings] = useState({
    platformName: 'MandiOS Cloud ERP',
    supportEmail: 'support@mandios.com',
    supportPhone: '03001234567',
    maintenanceMode: false,
    defaultTrialDays: 30,
    allowSelfRegistration: false,
  });
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('50% Off This Month');
  const [announcementMessage, setAnnouncementMessage] = useState('Get 50% off your MandiOS subscription this month. Contact us today to claim this offer.');
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [removingAnnouncementId, setRemovingAnnouncementId] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/super-admin/settings');
      if (res.data) setSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/super-admin/system-health');
      if (res.data) setTelemetry(res.data);
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSettings();
      fetchTelemetry();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchSettings, fetchTelemetry]);

  useEffect(() => {
    if (activeSubTab !== 'announcements') return;
    api.get('/super-admin/announcements')
      .then((res) => setAnnouncements(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAnnouncements([]));
  }, [activeSubTab]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/super-admin/settings', settings);
      if (onShowToast) onShowToast(t('Global settings updated successfully!'), 'success');
    } catch {
      if (onShowToast) onShowToast(t('Failed to update settings.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadFullBackup = async () => {
    setDownloadingBackup(true);
    try {
      const response = await api.get('/super-admin/backup/export-all', { responseType: 'blob' });
      const contentDisposition = response.headers['content-disposition'] || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || `mandios_full_backup_${Date.now()}.json`;
      const downloadUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      if (onShowToast) onShowToast(t('Full database backup downloaded successfully.'), 'success');
    } catch (err) {
      if (onShowToast) onShowToast(t(err.response?.status === 401 ? 'Your Super Admin session has expired. Please log in again.' : 'Failed to download database backup.'), 'error');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handlePublishAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;
    setPublishingAnnouncement(true);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      const response = await api.post('/super-admin/announcements', {
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        type: 'success',
        targetAudience: 'All',
        expiresAt
      });
      setAnnouncements((current) => [response.data, ...current]);
      if (onShowToast) onShowToast(t('Announcement published on the login page.'), 'success');
    } catch {
      if (onShowToast) onShowToast(t('Failed to publish announcement.'), 'error');
    } finally {
      setPublishingAnnouncement(false);
    }
  };

  const handleRemoveAnnouncement = async (announcementId) => {
    if (!announcementId || !window.confirm(t('Remove this announcement from the login page?'))) return;
    setRemovingAnnouncementId(announcementId);
    try {
      await api.delete(`/super-admin/announcements/${announcementId}`);
      setAnnouncements((current) => current.filter((announcement) => (announcement._id || announcement.id) !== announcementId));
      if (onShowToast) onShowToast(t('Announcement removed from the login page.'), 'success');
    } catch {
      if (onShowToast) onShowToast(t('Failed to remove announcement.'), 'error');
    } finally {
      setRemovingAnnouncementId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Tabs */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            {t('Platform Configuration & System Health')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Control global application parameters, system telemetry, and database snapshots')}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex items-center gap-1">
          <button
            onClick={() => setActiveSubTab('settings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'settings' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('Global Settings')}
          </button>
          <button
            onClick={() => setActiveSubTab('telemetry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'telemetry' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('System Telemetry')}
          </button>
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'backup' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('Database Backup')}
          </button>
          <button
            onClick={() => setActiveSubTab('announcements')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'announcements'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('Announcements')}
          </button>
          <button
            onClick={() => setActiveSubTab('password')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'password' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('Change Password')}
          </button>
        </div>
      </div>

      {/* VIEW 1: GLOBAL SETTINGS FORM */}
      {activeSubTab === 'settings' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('Platform Name')}
              </label>
              <input
                type="text"
                value={settings.platformName || ''}
                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('Support Email Address')}
                </label>
                <input
                  type="email"
                  value={settings.supportEmail || ''}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('Support Phone / WhatsApp')}
                </label>
                <input
                  type="text"
                  value={settings.supportPhone || ''}
                  onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('Default Trial Period (Days)')}
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.defaultTrialDays || 30}
                onChange={(e) => setSettings({ ...settings, defaultTrialDays: Number(e.target.value) })}
                className="w-full sm:w-48 px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.maintenanceMode)}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{t('Maintenance Mode')}</div>
                  <div className="text-[11px] text-slate-500">{t('Only Super Admins can access the platform when enabled')}</div>
                </div>
              </label>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? t('Saving Changes...') : t('Save Configuration')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 2: SYSTEM TELEMETRY */}
      {activeSubTab === 'telemetry' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {t('System Status')}: {t(telemetry?.status || 'Operational')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('Uptime')}: {telemetry?.server?.uptime || t('N/A')} • {t('Node')}: {telemetry?.server?.nodeVersion}
                </p>
              </div>
            </div>
            <button
              onClick={fetchTelemetry}
              className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Database Record Counts */}
          {telemetry?.counts && (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                {t('Total Database Storage Records')}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Object.entries(telemetry.counts).map(([key, val]) => (
                  <div key={key} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: DATABASE BACKUP */}
      {activeSubTab === 'backup' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{t('Full Database Snapshot Export')}</h3>
              <p className="text-xs text-slate-500">{t('Download a full JSON archive of all tenant collections and platform records.')}</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>{t('Full Multi-Tenant Complete Backup')}</span>
            </div>
            <p>{t('Includes businesses, users, stock entries, sales, invoices, ledgers, payments, expenses, trucks, and audit trails.')}</p>
          </div>

          <button
            onClick={handleDownloadFullBackup}
            disabled={downloadingBackup}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {downloadingBackup ? t('Preparing Backup...') : t('Download Full JSON Backup')}
          </button>
        </div>
      )}

      {activeSubTab === 'announcements' && (
        <form onSubmit={handlePublishAnnouncement} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{t('Publish Login Announcement')}</h3>
              <p className="text-xs text-slate-500">{t('This announcement will appear to users on the login page until the end of this month.')}</p>
            </div>
          </div>
          <input
            type="text"
            value={announcementTitle}
            onChange={(e) => setAnnouncementTitle(e.target.value)}
            maxLength={100}
            required
            className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold dark:text-white"
            placeholder={t('Announcement title')}
          />
          <textarea
            value={announcementMessage}
            onChange={(e) => setAnnouncementMessage(e.target.value)}
            rows={4}
            maxLength={500}
            required
            className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white resize-y"
            placeholder={t('Write your offer here...')}
          />
          <button
            type="submit"
            disabled={publishingAnnouncement || !announcementTitle.trim() || !announcementMessage.trim()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2"
          >
            <Megaphone className="w-4 h-4" />
            {publishingAnnouncement ? t('Publishing...') : t('Publish Offer')}
          </button>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('Published Announcements')}</h4>
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-500">{t('No announcements published.')}</p>
            ) : (
              announcements.map((announcement) => {
                const announcementId = announcement._id || announcement.id;
                return (
                  <div key={announcementId} className="flex items-start justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{announcement.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{announcement.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAnnouncement(announcementId)}
                      disabled={removingAnnouncementId === announcementId}
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:hover:bg-rose-950/30"
                      title={t('Remove announcement')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {removingAnnouncementId === announcementId ? t('Removing...') : t('Remove')}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </form>
      )}

      {/* VIEW 4: CHANGE PASSWORD */}
      {activeSubTab === 'password' && (
        <ChangePassword showToast={onShowToast} />
      )}
    </div>
  );
}
