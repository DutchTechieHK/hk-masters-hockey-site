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
      setTimeout(() => setPhase(5), 8500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06 }}
      transition={{ duration: 1.5 }}
    >
      <div className="absolute inset-0">
        <motion.img
          src={`${import.meta.env.BASE_URL}bg-rotterdam.png`}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 60%', transformOrigin: 'center 60%' }}
          initial={{ scale: 1 }}
          animate={{ scale: 1.08 }}
          transition={{ duration: 10, ease: 'linear' }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(22,48,93,0.85) 0%, rgba(22,48,93,0.75) 40%, rgba(22,48,93,0.92) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10,20,40,0.65) 100%)' }} />
      </div>

      <motion.div className="absolute inset-0 z-20 bg-black pointer-events-none" initial={{ opacity: 0 }} animate={phase >= 5 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 1.5, ease: 'easeInOut' }} />

      <div className="relative z-10 flex flex-col items-center text-center px-6 sm:px-12">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="bg-white rounded-2xl mb-6 sm:mb-10"
          style={{ padding: '10px 14px', boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12)' }}
        >
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="HK Masters Logo" className="h-16 sm:h-24 w-auto object-contain" />
        </motion.div>

        <div className="overflow-hidden mb-2">
          <motion.p
            className="text-[3.5vw] sm:text-[1.8vw] font-semibold uppercase tracking-[0.4em]"
            style={{ fontFamily: 'var(--iv-font-display)', color: 'var(--iv-accent)' }}
            initial={{ y: '110%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '110%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          >
            Hockey For Life
          </motion.p>
        </div>

        <div className="overflow-hidden mb-4 sm:mb-6">
          <motion.h1
            className="text-[7.5vw] sm:text-[5.5vw] font-bold uppercase tracking-wide text-center leading-tight"
            style={{ fontFamily: 'var(--iv-font-display)', color: 'var(--iv-accent)' }}
            initial={{ y: '110%' }}
            animate={phase >= 3 ? { y: 0 } : { y: '110%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            See you in Rotterdam!
          </motion.h1>
        </div>

        <motion.p
          className="text-[3.5vw] sm:text-[2vw] text-white/70 max-w-[80vw] sm:max-w-[36vw]"
          initial={{ opacity: 0, y: 15 }}
          animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.7 }}
        >
          You&rsquo;re all set — tap your new home screen icon to get started.
        </motion.p>

        <motion.div
          className="mt-6 sm:mt-8 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--iv-accent)' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(242,232,213,0.4)' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(242,232,213,0.4)' }} />
        </motion.div>
      </div>
    </motion.div>
  );
}
