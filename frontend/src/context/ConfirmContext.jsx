import { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, X, Trash2, CheckCircle2 } from 'lucide-react';
import { useLanguage } from './LanguageContext.jsx';

const ConfirmContext = createContext();

export function ConfirmProvider({ children }) {
  const { t } = useLanguage();
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger', // 'danger' | 'warning' | 'info'
    resolver: null,
  });

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title: options?.title || 'Confirm Action',
        message: typeof options === 'string' ? options : (options?.message || 'Are you sure you want to proceed?'),
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        type: options?.type || 'danger',
        resolver: resolve,
      });
    });
  }, []);

  const handleClose = (value) => {
    if (modalState.resolver) {
      modalState.resolver(value);
    }
    setModalState((prev) => ({ ...prev, isOpen: false, resolver: null }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 transform transition-all scale-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  modalState.type === 'danger' 
                    ? 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20' 
                    : modalState.type === 'warning'
                    ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20'
                }`}>
                  {modalState.type === 'danger' ? (
                    <Trash2 size={22} />
                  ) : modalState.type === 'warning' ? (
                    <AlertTriangle size={22} />
                  ) : (
                    <CheckCircle2 size={22} />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {t(modalState.title)}
                  </h3>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                    {t('Confirmation Required')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleClose(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {t(modalState.message)}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                {t(modalState.cancelText)}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 ${
                  modalState.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                    : modalState.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                }`}
              >
                {t(modalState.confirmText)}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
