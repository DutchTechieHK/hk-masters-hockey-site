import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1400),
      setTimeout(() => setPhase(3), 2800),
      setTimeout(() => setPhase(4), 4600),
      setTimeout(() => setPhase(5), 9200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-dark)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06 }}
      transition={{ duration: 1.5 }}
    >
      <div className="relative z-10 flex flex-col items-center text-center px-12">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="bg-[var(--color-primary)] p-5 rounded-3xl shadow-2xl mb-10 border-4 border-white/10"
        >
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="HK Masters Logo"
            className="w-28 h-auto"
          />
        </motion.div>

        <div className="overflow-hidden mb-2">
          <motion.p
            className="text-[1.8vw] font-semibold text-[var(--color-accent)] uppercase tracking-[0.4em]"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ y: '110%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '110%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          >
            Hockey For Life
          </motion.p>
        </div>

        <div className="overflow-hidden mb-6">
          <motion.h1
            className="text-[5.5vw] font-bold text-[var(--color-accent)] uppercase tracking-wide text-center leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ y: '110%' }}
            animate={phase >= 3 ? { y: 0 } : { y: '110%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            See you in Rotterdam!
          </motion.h1>
        </div>

        <motion.p
          className="text-[2vw] text-white/70 max-w-[36vw]"
          initial={{ opacity: 0, y: 15 }}
          animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.7 }}
        >
          You&rsquo;re all set &mdash; tap your new home screen icon to get started.
        </motion.p>

        <motion.div
          className="mt-8 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]/40" />
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]/40" />
        </motion.div>
      </div>
    </motion.div>
  );
}
