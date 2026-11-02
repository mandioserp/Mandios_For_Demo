import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { apiBaseUrl } from '../../utils/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

export default function NetworkStatusBanner() {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnectedAlert, setShowReconnectedAlert] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnectedAlert(true);
        const timer = setTimeout(() => {
          setShowReconnectedAlert(false);
        }, 4000);
        return () => clearTimeout(timer);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowReconnectedAlert(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const handleManualRetry = async () => {
    setIsChecking(true);
    try {
      const apiOrigin = apiBaseUrl.replace(/\/api\/?$/, '');
      await fetch(`${apiOrigin}/health`, { method: 'HEAD', cache: 'no-store', credentials: 'include' });
      setIsOnline(true);
      setShowReconnectedAlert(true);
      setTimeout(() => setShowReconnectedAlert(false), 4000);
    } catch {
      if (navigator.onLine) {
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    } finally {
      setIsChecking(false);
    }
  };

  // If connected back online temporarily after being offline
  if (showReconnectedAlert && isOnline) {
    return (
      <div 
        role="status" 
        aria-live="polite" 
        className="fixed top-0 inset-x-0 z-[9999] bg-emerald-600 text-white py-2.5 px-4 shadow-lg flex items-center justify-between text-xs font-semibold animate-in slide-in-from-top duration-300"
      >
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <Wifi size={18} className="text-emerald-100 animate-pulse" />
          <span>
            <strong>{t('Connection Restored!')}</strong> {t('You are back online. All features and data sync are active.')}
          </span>
        </div>
      </div>
    );
  }

  // If offline
  if (!isOnline) {
    return (
      <div 
        role="alert" 
        aria-live="assertive" 
        className="fixed top-0 inset-x-0 z-[9999] bg-gradient-to-r from-rose-600 via-red-600 to-amber-700 text-white py-3 px-4 shadow-2xl animate-in slide-in-from-top duration-300 border-b border-white/20"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-black/20 rounded-lg flex items-center justify-center animate-pulse">
              <WifiOff size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                <span>⚠️ {t('Network Connection Lost')}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/20">
                  {t('Offline Mode')}
                </span>
              </p>
              <p className="text-rose-100 text-xs font-normal">
                {t('Internet signals are dropped or unavailable. Changes may not sync until connection returns.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleManualRetry}
              disabled={isChecking}
              className="px-3.5 py-1.5 bg-white text-rose-700 font-bold rounded-lg shadow-sm hover:bg-rose-50 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
            >
              <RefreshCw size={13} className={isChecking ? 'animate-spin' : ''} />
              <span>{isChecking ? t('Checking...') : t('Check Connection')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
