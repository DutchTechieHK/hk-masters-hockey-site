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
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0">
        <img
          src={`${import.meta.env.BASE_URL}bg-stadium.png`}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 30%' }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(22,48,93,0.82) 0%, rgba(22,48,93,0.72) 40%, rgba(22,48,93,0.90) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10,20,40,0.65) 100%)' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6 sm:px-12">
        <motion.div
          className="mb-6 sm:mb-10 rounded-2xl bg-white shadow-2xl flex items-center justify-center"
          style={{ padding: '10px 14px', boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12)' }}
          initial={{ scale: 0, rotate: -15, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 0, rotate: -15, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="HK Masters Logo" className="h-16 sm:h-28 w-auto object-contain" />
        </motion.div>

        <div className="overflow-hidden mb-2 sm:mb-3">
          <motion.p
            className="text-[3.5vw] sm:text-[2vw] font-semibold uppercase tracking-[0.4em]"
            style={{ fontFamily: 'var(--iv-font-display)', color: 'var(--iv-accent)' }}
            initial={{ y: '110%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '110%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          >
            Hockey For Life
          </motion.p>
        </div>

        <div className="overflow-hidden mb-6 sm:mb-8">
          <motion.h1
            className="text-[6.5vw] sm:text-[4.5vw] font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--iv-font-display)', textShadow: '0 2px 24px rgba(0,0,0,0.6)' }}
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
              className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-full text-[3vw] sm:text-[1.4vw] font-medium backdrop-blur-sm"
              style={{ border: '1px solid rgba(242,232,213,0.4)', color: 'var(--iv-accent)', background: 'rgba(242,232,213,0.08)' }}
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
