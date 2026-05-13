import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
      setTimeout(() => setPhase(4), 7000), // begin exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-dark)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative z-10 flex flex-col items-center">
        <motion.img 
          src={`${import.meta.env.BASE_URL}logo.png`} 
          alt="HK Masters Logo"
          className="w-48 h-auto mb-12 drop-shadow-2xl"
          initial={{ scale: 0, rotate: -15, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 0, rotate: -15, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
        
        <div className="overflow-hidden">
          <motion.h1 
            className="text-[5vw] font-bold text-[var(--color-accent)] uppercase tracking-wide"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ y: '100%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            Get the app on your phone
          </motion.h1>
        </div>
      </div>
    </motion.div>
  );
}
