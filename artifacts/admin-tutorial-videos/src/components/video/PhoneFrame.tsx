import React from 'react';
import { motion } from 'framer-motion';

export const PhoneFrame = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
  return (
    <motion.div 
      className={`relative w-[320px] h-[650px] bg-secondary rounded-[40px] p-3 shadow-2xl border-4 border-slate-800 ${className}`}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative w-full h-full bg-slate-900 rounded-[28px] overflow-hidden flex flex-col">
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50">
          <div className="w-32 h-6 bg-slate-800 rounded-b-xl"></div>
        </div>
        
        {/* App Content */}
        <div className="flex-1 w-full h-full mt-6 bg-slate-900 relative">
          {children}
        </div>
      </div>
    </motion.div>
  );
};

export const AppHeader = ({ title, showBack = false }: { title: string, showBack?: boolean }) => (
  <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-900 z-10">
    {showBack && <div className="w-6 h-6 mr-2 flex items-center justify-center text-accent">←</div>}
    <h3 className="text-white font-display font-bold text-lg">{title}</h3>
  </div>
);

export const Cursor = ({ x, y, active }: { x: number | string, y: number | string, active: boolean }) => (
  <motion.div
    className="absolute z-50 pointer-events-none"
    animate={{ x, y, scale: active ? 0.8 : 1 }}
    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
  >
    <div className="w-8 h-8 rounded-full bg-white/30 border-2 border-white flex items-center justify-center shadow-lg">
      <div className={`w-3 h-3 rounded-full bg-white transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  </motion.div>
);