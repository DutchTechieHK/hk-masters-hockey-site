import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share } from 'lucide-react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-dark)]"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ clipPath: 'circle(0% at 50% 50%)' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex w-full max-w-6xl items-center justify-between px-20">
        <div className="w-1/2">
          <motion.h2 
            className="text-[4.5vw] font-bold text-[var(--color-accent)] leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, x: -50 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
            transition={{ duration: 0.8 }}
          >
            Open Safari
          </motion.h2>
          <motion.p 
            className="text-[2.5vw] text-white/80 mt-4"
            initial={{ opacity: 0, x: -30 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.8 }}
          >
            Tap the Share icon
          </motion.p>
        </div>

        <motion.div 
          className="relative w-[300px] h-[600px] bg-white rounded-[3rem] border-8 border-gray-800 overflow-hidden shadow-2xl flex flex-col justify-end"
          initial={{ y: 100, opacity: 0, rotate: 5 }}
          animate={phase >= 1 ? { y: 0, opacity: 1, rotate: 0 } : { y: 100, opacity: 0, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <div className="absolute top-0 w-full h-16 bg-gray-100 flex items-center justify-center border-b border-gray-200">
            <div className="w-1/2 h-6 bg-gray-300 rounded-full"></div>
          </div>
          
          <div className="flex-1 bg-white p-4 pt-20">
            <div className="w-3/4 h-8 bg-gray-200 rounded mb-4"></div>
            <div className="w-full h-40 bg-gray-100 rounded-xl mb-4"></div>
            <div className="w-full h-4 bg-gray-100 rounded mb-2"></div>
            <div className="w-5/6 h-4 bg-gray-100 rounded"></div>
          </div>

          <div className="h-20 bg-gray-50 border-t border-gray-200 flex items-center justify-around px-6">
            <div className="w-8 h-8 rounded-full bg-gray-300"></div>
            <div className="w-8 h-8 rounded-full bg-gray-300"></div>
            <div className="relative">
              <motion.div
                animate={phase >= 3 ? { scale: [1, 1.3, 1], color: '#3B82F6' } : {}}
                transition={{ duration: 0.5 }}
              >
                <Share className="w-8 h-8 text-[#007AFF]" />
              </motion.div>
              {phase >= 3 && (
                <motion.div 
                  className="absolute inset-0 bg-[#007AFF] rounded-full"
                  initial={{ scale: 0, opacity: 0.5 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 0.8 }}
                />
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-300"></div>
            <div className="w-8 h-8 rounded-full bg-gray-300"></div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
