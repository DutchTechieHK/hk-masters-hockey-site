import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[var(--color-primary)]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex w-full max-w-6xl items-center justify-between px-20">
        <div className="w-1/2">
          <motion.h2 
            className="text-[4.5vw] font-bold text-[var(--color-accent)] leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, y: 50 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.8 }}
          >
            On Android
          </motion.h2>
          <motion.p 
            className="text-[2.5vw] text-white/80 mt-4"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            Tap Install in Chrome
          </motion.p>
        </div>

        <motion.div 
          className="relative w-[300px] h-[600px] bg-white rounded-[3rem] border-8 border-gray-800 overflow-hidden shadow-2xl flex flex-col"
          initial={{ x: 100, opacity: 0 }}
          animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 pt-4">
            <div className="w-6 h-6 rounded-full bg-gray-200"></div>
            <div className="flex-1 mx-4 h-8 bg-gray-100 rounded-full flex items-center px-3">
              <div className="w-4 h-4 bg-gray-300 rounded-full mr-2"></div>
              <div className="w-20 h-2 bg-gray-300 rounded"></div>
            </div>
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
            </div>
          </div>
          
          <div className="flex-1 bg-white p-4">
            <div className="w-full h-40 bg-[var(--color-bg-dark)] rounded-xl mb-4 flex items-center justify-center">
              <img src={`${import.meta.env.BASE_URL}logo.png`} className="h-16 opacity-50" />
            </div>
            <div className="w-3/4 h-6 bg-gray-200 rounded mb-2"></div>
            <div className="w-1/2 h-4 bg-gray-100 rounded mb-6"></div>
            
            <div className="space-y-3">
              <div className="w-full h-3 bg-gray-100 rounded"></div>
              <div className="w-full h-3 bg-gray-100 rounded"></div>
              <div className="w-5/6 h-3 bg-gray-100 rounded"></div>
            </div>
          </div>

          {phase >= 2 && (
            <motion.div 
              className="absolute bottom-6 left-4 right-4 bg-gray-900 rounded-lg p-4 flex items-center shadow-lg"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <img src={`${import.meta.env.BASE_URL}logo.png`} className="w-10 h-10 rounded-md mr-3" />
              <div className="flex-1">
                <div className="text-white text-sm font-medium">Add HK Masters</div>
              </div>
              <motion.button 
                className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded"
                animate={phase >= 3 ? { scale: [1, 0.9, 1.1, 1], backgroundColor: '#2563EB' } : {}}
                transition={{ duration: 0.5 }}
              >
                INSTALL
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
