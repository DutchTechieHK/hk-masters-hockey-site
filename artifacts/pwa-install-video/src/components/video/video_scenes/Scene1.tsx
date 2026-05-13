import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2400),
      setTimeout(() => setPhase(4), 4000),
      setTimeout(() => setPhase(5), 9000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-dark)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative z-10 flex flex-col items-center text-center px-12">
        <motion.img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="HK Masters Logo"
          className="w-40 h-auto mb-10"
          style={{ filter: 'brightness(0) invert(1) drop-shadow(0 0 16px rgba(242,232,213,0.6))' }}
          initial={{ scale: 0, rotate: -15, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 0, rotate: -15, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />

        <div className="overflow-hidden mb-3">
          <motion.p
            className="text-[2vw] font-semibold text-[var(--color-accent)] uppercase tracking-[0.4em]"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ y: '110%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '110%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          >
            Hockey For Life
          </motion.p>
        </div>

        <div className="overflow-hidden mb-8">
          <motion.h1
            className="text-[4.5vw] font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ y: '110%' }}
            animate={phase >= 3 ? { y: 0 } : { y: '110%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            Get the app on your phone
          </motion.h1>
        </div>

        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          {['iOS', 'Android'].map((label, i) => (
            <motion.div
              key={label}
              className="px-5 py-2 rounded-full border border-[var(--color-accent)]/40 text-[var(--color-accent)] text-[1.4vw] font-medium"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={phase >= 4 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ delay: i * 0.15, type: 'spring', stiffness: 300, damping: 22 }}
            >
              {label}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
