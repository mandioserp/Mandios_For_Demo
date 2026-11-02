import React from 'react';
import logo from '../assets/logo.png';
export default function Logo({ size = 'md', className = '', showText = true }) {
  const sizeClasses = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="bg-white p-1 rounded-xl shadow-md border border-emerald-500/20 shrink-0 flex items-center justify-center">
        <img
          src={logo}
          alt="Mandi OS logo"
          referrerPolicy="no-referrer"
          className={`${sizeClasses} object-contain rounded-lg`}
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-none">
            Mandi<span className="text-emerald-500">OS</span>
          </span>
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mt-1">
            ERP Commission Broker
          </span>
        </div>
      )}
    </div>
  );
}

