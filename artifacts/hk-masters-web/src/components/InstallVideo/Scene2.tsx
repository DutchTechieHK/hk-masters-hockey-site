import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share } from 'lucide-react';
import { PhoneFrame } from './PhoneFrame';

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
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'var(--iv-bg-dark)', clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ clipPath: 'circle(0% at 50% 50%)' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex w-full max-w-6xl items-center justify-between px-20">
        <div className="w-1/2">
          <motion.div
            className="inline-flex items-center gap-2 mb-5 px-3 py-1 rounded-full text-[1.1vw] font-medium"
            style={{ border: '1px solid rgba(242,232,213,0.3)', color: 'rgba(242,232,213,0.7)', background: 'rgba(242,232,213,0.06)' }}
            initial={{ opacity: 0, x: -20 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.6 }}
          >
            <span className="w-5 h-5 rounded-full text-[0.9vw] font-bold flex items-center justify-center" style={{ background: 'var(--iv-accent)', color: 'var(--iv-bg-dark)' }}>1</span>
            iOS
          </motion.div>

          <motion.h2
            className="text-[4.5vw] font-bold leading-tight"
            style={{ fontFamily: 'var(--iv-font-display)', color: 'var(--iv-accent)' }}
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
            Tap the{' '}
            <span className="inline-flex items-center gap-1 text-[#007AFF] font-semibold">
              <Share className="inline w-[2vw] h-[2vw]" /> Share
            </span>{' '}
            icon
          </motion.p>

          <motion.div
            className="mt-8 text-[1.4vw]"
            style={{ color: 'rgba(242,232,213,0.4)' }}
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            Tap it at the bottom of Safari
          </motion.div>
        </div>

        <motion.div
          initial={{ y: 100, opacity: 0, rotate: 5 }}
          animate={phase >= 1 ? { y: 0, opacity: 1, rotate: 0 } : { y: 100, opacity: 0, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <PhoneFrame variant="ios">
            <div className="flex items-center justify-between px-6 pt-12 pb-2 bg-white">
              <span className="text-[10px] font-semibold text-black">9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 border border-black/50 rounded-sm relative">
                  <div className="absolute inset-0.5 right-1 bg-black/80 rounded-sm" />
                  <div className="absolute right-[-3px] top-1/2 -translate-y-1/2 w-0.5 h-1.5 bg-black/50 rounded-r" />
                </div>
              </div>
            </div>
            <div className="bg-[#F2F2F7] px-3 py-2 flex items-center gap-2 border-b border-gray-200">
              <div className="flex-1 bg-white rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-[10px] text-gray-500 truncate">hkmastershockey.com</span>
              </div>
            </div>
            <div className="flex-1 bg-white p-3 overflow-hidden">
              <div className="w-full h-28 bg-[#1E3A6E] rounded-xl mb-3 flex items-center justify-center">
                <img src={`${import.meta.env.BASE_URL}logo.png`} className="h-12" style={{ filter: 'brightness(0) invert(1)', opacity: 0.85 }} alt="" />
              </div>
              <div className="w-3/4 h-3 bg-gray-200 rounded mb-2" />
              <div className="w-full h-2.5 bg-gray-100 rounded mb-1.5" />
              <div className="w-full h-2.5 bg-gray-100 rounded mb-1.5" />
              <div className="w-5/6 h-2.5 bg-gray-100 rounded mb-3" />
              <div className="flex gap-2">
                <div className="w-16 h-8 bg-[#1E3A6E] rounded-lg" />
                <div className="w-20 h-8 bg-gray-100 rounded-lg" />
              </div>
            </div>
            <div className="h-[72px] bg-[#F2F2F7] border-t border-gray-300 flex items-center justify-around px-4 shrink-0">
              <svg className="w-6 h-6 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <div className="relative flex items-center justify-center">
                <motion.div animate={phase >= 3 ? { scale: [1, 0.82, 1.15, 1] } : {}} transition={{ duration: 0.45, ease: 'easeInOut' }}>
                  <Share className="w-6 h-6 text-[#007AFF]" />
                </motion.div>
                {phase >= 3 && (
                  <motion.div className="absolute inset-0 rounded-full bg-[#007AFF]" initial={{ scale: 0.5, opacity: 0.5 }} animate={{ scale: 2.8, opacity: 0 }} transition={{ duration: 0.7 }} />
                )}
              </div>
              <svg className="w-6 h-6 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <svg className="w-6 h-6 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="7" width="13" height="13" rx="2" strokeWidth={1.8} />
                <path d="M7 7V5a2 2 0 012-2h10a2 2 0 012 2v11a2 2 0 01-2 2h-2" strokeWidth={1.8} />
              </svg>
            </div>
          </PhoneFrame>
        </motion.div>
      </div>
    </motion.div>
  );
}
