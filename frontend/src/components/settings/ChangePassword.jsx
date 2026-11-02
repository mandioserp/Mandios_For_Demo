import { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';
import api from '../../utils/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import SpokeSpinner from '../common/SpokeSpinner.jsx';

export default function ChangePassword({ showToast }) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation checks
    if (!currentPassword.trim()) {
      setError(t('Please enter your current (previous) password.'));
      return;
    }

    if (!newPassword.trim()) {
      setError(t('Please enter your new password.'));
      return;
    }

    if (newPassword.trim().length < 6) {
      setError(t('New password must be at least 6 characters long.'));
      return;
    }

    if (!confirmPassword.trim()) {
      setError(t('Please confirm your new password in the third field.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('New password and confirm password do not match. Please ensure both fields are identical.'));
      return;
    }

    if (currentPassword === newPassword) {
      setError(t('New password cannot be the same as your previous password. Please choose a different password.'));
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim()
      });

      const successMsg = response.data?.message || t('Password changed successfully!');
      setSuccess(successMsg);
      showToast?.(successMsg, 'success');

      // Clear input fields on success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || t('Failed to change password.');
      setError(errorMsg);
      showToast?.(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const isMismatch = newPassword && confirmPassword && newPassword !== confirmPassword;

  return (
    <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-lg max-w-2xl animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center space-x-3.5 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-[#4F46E5] dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
          <KeyRound size={22} />
        </div>
        <div>
          <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
            {t('Change Account Password')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('Update your admin credentials securely. All 3 verification steps are required.')}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mt-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3 animate-shake">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="mt-5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-3 animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-bold">{success}</p>
            <p className="text-[11px] opacity-80 mt-0.5">{t('Please remember your new password for subsequent logins.')}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Field 1: Previous/Current Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>{t('1. Previous / Current Password')}</span>
            <span className="text-[10px] text-rose-500 font-bold">{t('* Required')}</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock size={16} />
            </div>
            <input
              id="admin-current-password-input"
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('Enter your current password...')}
              required
              className="w-full pl-10 pr-11 py-3 bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-[#4F46E5] dark:focus:border-indigo-400 font-medium transition-all"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title={t(showCurrent ? 'Hide password' : 'Show password')}
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            {t('Enter your existing account password to verify your administrative authority.')}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80"></div>

        {/* Field 2: New Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>{t('2. New Password')}</span>
            <span className="text-[10px] text-slate-400">{t('Min. 6 characters')}</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <KeyRound size={16} />
            </div>
            <input
              id="admin-new-password-input"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('Enter new password (min 6 characters)...')}
              required
              minLength={6}
              className="w-full pl-10 pr-11 py-3 bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-[#4F46E5] dark:focus:border-indigo-400 font-medium transition-all"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title={t(showNew ? 'Hide password' : 'Show password')}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {newPassword && newPassword.length < 6 && (
            <p className="text-[10px] text-amber-500 font-semibold">
              {t('Password is too short (minimum 6 characters required).')}
            </p>
          )}
        </div>

        {/* Field 3: Confirm New Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>{t('3. Confirm New Password')}</span>
            {isMatch && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={12} /> {t('Passwords Match')}
              </span>
            )}
            {isMismatch && (
              <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                <AlertCircle size={12} /> {t('Does Not Match')}
              </span>
            )}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <ShieldCheck size={16} />
            </div>
            <input
              id="admin-confirm-password-input"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('Re-type your new password...')}
              required
              className={`w-full pl-10 pr-11 py-3 bg-[#F8FAFC] dark:bg-[#0F172A] border rounded-xl text-xs outline-none font-medium transition-all ${
                isMismatch 
                  ? 'border-rose-400 focus:border-rose-500' 
                  : isMatch 
                    ? 'border-emerald-400 focus:border-emerald-500' 
                    : 'border-slate-200 dark:border-slate-800 focus:border-[#4F46E5] dark:focus:border-indigo-400'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title={t(showConfirm ? 'Hide password' : 'Show password')}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            {t('Re-enter your new password to verify accuracy and avoid typos.')}
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-4 flex justify-end">
          <button
            id="admin-change-password-submit-btn"
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword || isMismatch}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <SpokeSpinner size={16} color="#FFFFFF" />
                <span>{t('UPDATING PASSWORD...')}</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>{t('UPDATE PASSWORD')}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
