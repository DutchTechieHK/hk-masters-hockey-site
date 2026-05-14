import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneFrame } from '../PhoneFrame';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2200),
      setTimeout(() => setPhase(3), 4500),
      setTimeout(() => setPhase(4), 6500),
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
        {/* Left: instruction text */}
        <div className="w-1/2">
          {/* Step badge */}
          <motion.div
            className="inline-flex items-center gap-2 mb-5 px-3 py-1 rounded-full border border-[var(--color-accent)]/30 text-[var(--color-accent)]/70 text-[1.1vw] font-medium"
            style={{ background: 'rgba(242,232,213,0.06)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
          >
            <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-[var(--color-bg-dark)] text-[0.9vw] font-bold flex items-center justify-center">1</span>
            Android
          </motion.div>

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
            className="text-[2.2vw] text-white/80 mt-4"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            Tap <strong>Install</strong> in Chrome
          </motion.p>

          <motion.p
            className="text-[1.8vw] text-[var(--color-accent)]/80 mt-3"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
          >
            App icon added to home screen
          </motion.p>
        </div>

        {/* Right: Android phone mockup */}
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <PhoneFrame variant="android">
            <div className="w-full h-full flex flex-col bg-white">
              {/* Android status bar */}
              <div className="flex items-center justify-between px-4 pt-8 pb-1 bg-white shrink-0">
                <span className="text-[10px] font-medium text-black">9:41</span>
                <div className="flex items-center gap-1">
                  <div className="flex gap-0.5">
                    {[3, 4, 4, 4].map((h, i) => (
                      <div key={i} className="w-0.5 bg-black/70 rounded-sm" style={{ height: h }} />
                    ))}
                  </div>
                  <svg className="w-3 h-3 text-black/70" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" fill="none" />
                  </svg>
                </div>
              </div>

              {/* Chrome address bar */}
              <div className="bg-white px-2 py-1.5 flex items-center gap-2 border-b border-gray-200 shrink-0">
                <div className="flex-1 h-8 bg-gray-100 rounded-full flex items-center px-3 gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-[9px] text-gray-500 truncate">hkmastershockey.com</span>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1 h-1 bg-gray-400 rounded-full" />
                  ))}
                </div>
              </div>

              {/* Web content / home screen */}
              <AnimatePresence mode="wait">
                {phase < 4 ? (
                  <motion.div
                    key="browser"
                    className="flex-1 bg-white p-3 overflow-hidden relative"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="w-full h-24 bg-white rounded-xl mb-3 flex items-center justify-center">
                      <img
                        src={`${import.meta.env.BASE_URL}logo.png`}
                        className="h-10 object-contain"
                        alt=""
                      />
                    </div>
                    <div className="w-3/4 h-3 bg-gray-200 rounded mb-2" />
                    <div className="w-1/2 h-2.5 bg-gray-100 rounded mb-3" />
                    <div className="space-y-1.5">
                      <div className="w-full h-2 bg-gray-100 rounded" />
                      <div className="w-full h-2 bg-gray-100 rounded" />
                      <div className="w-5/6 h-2 bg-gray-100 rounded" />
                    </div>

                    {/* Chrome install banner slides up */}
                    <AnimatePresence>
                      {phase >= 2 && (
                        <motion.div
                          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-gray-200 p-4 flex items-center gap-3 shadow-2xl"
                          initial={{ y: '100%' }}
                          animate={{ y: 0 }}
                          exit={{ y: '100%' }}
                          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        >
                          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white flex items-center justify-center p-1">
                            <img
                              src={`${import.meta.env.BASE_URL}logo.png`}
                              className="w-full h-full object-contain"
                              alt=""
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-900 text-[11px] font-semibold truncate">Add HK Masters</div>
                            <div className="text-gray-400 text-[9px]">hkmastershockey.com</div>
                          </div>
                          <motion.div
                            className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg shrink-0"
                            animate={
                              phase >= 3
                                ? { scale: [1, 0.88, 1.06, 1], backgroundColor: ['#2563EB', '#1D4ED8', '#1D4ED8'] }
                                : {}
                            }
                            transition={{ duration: 0.4 }}
                          >
                            INSTALL
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  /* Android home screen after install */
                  <motion.div
                    key="homescreen"
                    className="flex-1 p-4"
                    style={{
                      background: 'linear-gradient(160deg, #1a3a6b 0%, #0d2445 60%, #071629 100%)',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className="w-11 h-11 rounded-xl bg-white/10" />
                        </div>
                      ))}
                    </div>
                    {/* HK Masters icon dropping in */}
                    <motion.div
                      className="flex flex-col items-center gap-1 mx-auto w-fit"
                      initial={{ y: -80, opacity: 0, scale: 0.6 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 }}
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] border-2 border-[var(--color-accent)]/60 flex items-center justify-center shadow-lg shadow-black/50 overflow-hidden">
                        <img
                          src={`${import.meta.env.BASE_URL}pwa-192.png`}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      </div>
                      <span className="text-white text-[9px] font-medium drop-shadow">HK Masters</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Android nav bar */}
              <div className="h-10 bg-white border-t border-gray-100 flex items-center justify-around px-6 shrink-0">
                <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <div className="w-4 h-4 rounded-sm border-2 border-gray-400" />
                <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
              </div>
            </div>
          </PhoneFrame>
        </motion.div>
      </div>
    </motion.div>
  );
}
