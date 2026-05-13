import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

        <motion.div
          className="relative w-[300px] h-[580px] bg-gray-900 rounded-[3rem] border-8 border-gray-700 overflow-hidden shadow-2xl flex flex-col"
          initial={{ x: 100, opacity: 0 }}
          animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          {/* Chrome address bar */}
          <div className="h-14 bg-white flex items-center px-3 gap-2 shrink-0">
            <div className="flex-1 h-7 bg-gray-100 rounded-full flex items-center px-3 gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-24 h-2 bg-gray-300 rounded" />
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
              ))}
            </div>
          </div>

          {/* Web content or home screen */}
          <AnimatePresence mode="wait">
            {phase < 4 ? (
              <motion.div
                key="browser"
                className="flex-1 bg-white p-4 overflow-hidden"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-full h-32 bg-[var(--color-bg-dark)] rounded-xl mb-3 flex items-center justify-center">
                  <img src={`${import.meta.env.BASE_URL}logo.png`} className="h-14 opacity-60" alt="" />
                </div>
                <div className="w-3/4 h-4 bg-gray-200 rounded mb-2" />
                <div className="w-1/2 h-3 bg-gray-100 rounded mb-4" />
                <div className="space-y-2">
                  <div className="w-full h-2.5 bg-gray-100 rounded" />
                  <div className="w-full h-2.5 bg-gray-100 rounded" />
                  <div className="w-5/6 h-2.5 bg-gray-100 rounded" />
                </div>

                {/* Install banner slides up */}
                <AnimatePresence>
                  {phase >= 2 && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl p-4 flex items-center gap-3 shadow-2xl"
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-[var(--color-primary)] flex items-center justify-center">
                        <img src={`${import.meta.env.BASE_URL}logo.png`} className="w-8 h-8" alt="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-semibold truncate">Add HK Masters</div>
                        <div className="text-gray-400 text-[10px]">hkmastershockey.com</div>
                      </div>
                      <motion.div
                        className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg shrink-0"
                        animate={phase >= 3 ? { scale: [1, 0.88, 1.05, 1], backgroundColor: ['#3B82F6', '#2563EB', '#2563EB'] } : {}}
                        transition={{ duration: 0.4 }}
                      >
                        INSTALL
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              /* Home screen after install */
              <motion.div
                key="homescreen"
                className="flex-1 bg-gray-800 p-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="grid grid-cols-4 gap-4 mb-4">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-xl bg-gray-600/50" />
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
                  <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] border-2 border-[var(--color-accent)]/60 flex items-center justify-center shadow-lg shadow-black/40">
                    <img src={`${import.meta.env.BASE_URL}pwa-192.png`} className="w-10 h-10" alt="" />
                  </div>
                  <span className="text-white text-[10px] font-medium drop-shadow">HK Masters</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
