import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PlusSquare } from 'lucide-react';
import { PhoneFrame } from '../PhoneFrame';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 5500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-dark)]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex w-full max-w-6xl items-center justify-between px-20">
        {/* Left: phone */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <PhoneFrame variant="ios">
            {/* Show share sheet until phase 3, then home screen */}
            {phase < 3 ? (
              <div className="relative w-full h-full bg-white flex flex-col">
                {/* Status bar */}
                <div className="flex items-center justify-between px-6 pt-12 pb-2 bg-white shrink-0">
                  <span className="text-[10px] font-semibold text-black">9:41</span>
                </div>
                {/* Faded webpage behind sheet */}
                <div className="flex-1 bg-gray-50 p-3 opacity-30 overflow-hidden">
                  <div className="w-full h-28 bg-[var(--color-bg-dark)] rounded-xl mb-3" />
                  <div className="w-3/4 h-3 bg-gray-300 rounded mb-2" />
                  <div className="w-full h-2.5 bg-gray-200 rounded mb-1.5" />
                  <div className="w-5/6 h-2.5 bg-gray-200 rounded" />
                </div>

                {/* Share sheet overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-[#F2F2F7] rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.18)] z-10">
                  {/* Drag handle */}
                  <div className="w-10 h-1 bg-gray-400/50 rounded-full mx-auto mt-3 mb-4" />

                  {/* App row */}
                  <div className="flex gap-4 px-5 mb-4 overflow-hidden">
                    {['Message', 'Mail', 'Notes', 'Copy'].map((label, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                          ['bg-green-500', 'bg-blue-500', 'bg-yellow-400', 'bg-gray-400'][i]
                        }`}>
                          <div className="w-6 h-6 bg-white/30 rounded" />
                        </div>
                        <span className="text-[9px] text-gray-600">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action list */}
                  <div className="mx-4 bg-white rounded-2xl overflow-hidden shadow-sm mb-3">
                    {[
                      { icon: '🔖', label: 'Add Bookmark' },
                      { icon: '📋', label: 'Copy Link' },
                    ].map(({ icon, label }) => (
                      <div key={label} className="h-11 border-b border-gray-100 flex items-center px-4 gap-3">
                        <span className="text-base">{icon}</span>
                        <span className="text-[11px] text-gray-700">{label}</span>
                      </div>
                    ))}

                    {/* "Add to Home Screen" — highlighted row */}
                    <motion.div
                      className="h-11 flex items-center px-4 gap-3 relative overflow-hidden"
                      animate={phase >= 2 ? { backgroundColor: '#E5E7EB' } : {}}
                    >
                      <PlusSquare className="w-4 h-4 text-gray-600 shrink-0" />
                      <span className="text-[11px] text-gray-800 font-semibold">Add to Home Screen</span>
                      {phase >= 2 && (
                        <motion.div
                          className="absolute inset-0 bg-blue-100"
                          initial={{ scaleX: 0, transformOrigin: 'left' }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.35 }}
                          style={{ zIndex: -1, opacity: 0.6 }}
                        />
                      )}
                    </motion.div>
                  </div>

                  {/* Cancel */}
                  <div className="mx-4 bg-white rounded-2xl overflow-hidden shadow-sm mb-5">
                    <div className="h-11 flex items-center justify-center">
                      <span className="text-[12px] font-semibold text-[#007AFF]">Cancel</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Home screen after install */
              <motion.div
                className="w-full h-full"
                style={{
                  background: 'linear-gradient(160deg, #1a3a6b 0%, #0d2445 60%, #071629 100%)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Status bar */}
                <div className="flex items-center justify-between px-6 pt-12 pb-2">
                  <span className="text-[10px] font-semibold text-white">9:41</span>
                </div>

                {/* App grid */}
                <div className="px-5 pt-6">
                  <div className="flex flex-wrap gap-3">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="w-[52px] h-[52px] flex flex-col items-center gap-1">
                        <div
                          className="w-12 h-12 rounded-2xl"
                          style={{ background: 'rgba(255,255,255,0.08)' }}
                        />
                        <div className="w-10 h-1.5 bg-white/20 rounded" />
                      </div>
                    ))}

                    {/* HK Masters icon popping in */}
                    {phase >= 4 && (
                      <motion.div
                        className="flex flex-col items-center gap-1"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 18 }}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)] border-2 border-[var(--color-accent)]/60 flex items-center justify-center shadow-lg shadow-black/50 overflow-hidden">
                          <img
                            src={`${import.meta.env.BASE_URL}pwa-192.png`}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        </div>
                        <span className="text-white text-[9px] font-medium drop-shadow text-center leading-tight">HK Masters</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </PhoneFrame>
        </motion.div>

        {/* Right: instruction text */}
        <div className="w-1/2">
          {/* Step badge */}
          <motion.div
            className="inline-flex items-center gap-2 mb-5 px-3 py-1 rounded-full border border-[var(--color-accent)]/30 text-[var(--color-accent)]/70 text-[1.1vw] font-medium"
            style={{ background: 'rgba(242,232,213,0.06)' }}
            initial={{ opacity: 0, x: 20 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ duration: 0.6 }}
          >
            <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-[var(--color-bg-dark)] text-[0.9vw] font-bold flex items-center justify-center">2</span>
            iOS
          </motion.div>

          <motion.h2
            className="text-[4.5vw] font-bold text-[var(--color-accent)] leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8 }}
          >
            Tap 'Add to<br />Home Screen'
          </motion.h2>

          <motion.p
            className="text-[2.5vw] text-white/80 mt-4"
            initial={{ opacity: 0, x: 30 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8 }}
          >
            Appears just like a native app
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
