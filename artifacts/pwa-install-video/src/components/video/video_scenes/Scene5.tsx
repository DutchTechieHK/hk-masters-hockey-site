import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
      setTimeout(() => setPhase(4), 6000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-dark)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5 }}
    >
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="bg-[var(--color-primary)] p-6 rounded-3xl shadow-2xl mb-10 border-4 border-white/10"
        >
          <img 
            src={`${import.meta.env.BASE_URL}logo.png`} 
            alt="HK Masters Logo"
            className="w-32 h-auto"
          />
        </motion.div>
        
        <div className="overflow-hidden">
          <motion.h1 
            className="text-[6vw] font-bold text-[var(--color-accent)] uppercase tracking-wide text-center"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ y: '100%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            See you in Rotterdam!
          </motion.h1>
        </div>
      </div>
    </motion.div>
  );
}
