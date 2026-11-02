import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export default function DialogAlert({ alert, onDismiss, className = '' }) {
  const { t } = useLanguage();
  if (!alert) return null;

  const type = alert.type || 'error';
  const message = typeof alert === 'string' ? alert : alert.message;

  const isError = type === 'error' || type === 'danger';
  const isWarning = type === 'warning';
  const isSuccess = type === 'success';

  const bgColor = isError
    ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
    : isWarning
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
    : isSuccess
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
    : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300';

  const iconColor = isError
    ? 'text-rose-600 dark:text-rose-400'
    : isWarning
    ? 'text-amber-600 dark:text-amber-400'
    : isSuccess
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-blue-600 dark:text-blue-400';

  return (
    <div
      role="alert"
      className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm ${bgColor} ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 shrink-0 ${iconColor}`}>
          {isError ? (
            <AlertCircle size={16} />
          ) : isWarning ? (
            <AlertTriangle size={16} />
          ) : isSuccess ? (
            <CheckCircle2 size={16} />
          ) : (
            <Info size={16} />
          )}
        </div>
        <div className="leading-snug">
          {alert.title && <div className="font-bold mb-0.5 text-xs">{t(alert.title)}</div>}
          <div className="font-medium text-[11px] break-words">{t(message)}</div>
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
