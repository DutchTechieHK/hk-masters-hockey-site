import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneFrame, Cursor } from '../PhoneFrame';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 3000),   // Announcements page appears
      setTimeout(() => setPhase(2), 5500),   // Cursor moves to "New announcement"
      setTimeout(() => setPhase(3), 7000),   // Modal opens
      setTimeout(() => setPhase(4), 9500),   // Text typed in
      setTimeout(() => setPhase(5), 13500),  // Click "Post"
      setTimeout(() => setPhase(6), 15000),  // Modal closes, card appears
      setTimeout(() => setPhase(7), 18000),  // Push notification drops down
      setTimeout(() => setPhase(8), 21000),  // Summary
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center w-full h-full"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* Intro Title */}
      <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-50 w-full"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={phase < 1 ? { opacity: 1, scale: 1 } : { opacity: 0, y: -50 }}
        transition={{ duration: 0.8 }}>
        <h2 className="text-accent font-mono text-xl mb-4 tracking-widest">CHAPTER 1</h2>
        <h1 className="text-6xl font-display font-bold text-white">In-App Announcements</h1>
      </motion.div>

      <div className="flex items-center justify-between w-full max-w-6xl px-12">
        {/* Left: Steps */}
        <div className="w-1/2 pr-12">
          {phase >= 1 && phase < 8 && (
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-4xl font-display font-bold text-white mb-6 leading-tight">
                Keep the squad <br /><span className="text-accent">in the loop.</span>
              </h2>
              <div className="space-y-4">
                <Step text="Open Announcements" active={phase === 1} done={phase > 1} />
                <Step text='Click "New announcement"' active={phase === 2} done={phase > 2} />
                <Step text="Write title & message" active={phase >= 3 && phase < 5} done={phase >= 5} />
                <Step text='Tap "Post"' active={phase === 5} done={phase > 5} />
                <Step text="Players notified instantly" active={phase >= 6} done={false} />
              </div>
            </motion.div>
          )}
          {phase >= 8 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-20">
              <h1 className="text-5xl font-display font-bold text-white leading-tight">
                Instant updates<br />for your whole team.
              </h1>
            </motion.div>
          )}
        </div>

        {/* Right: Phone */}
        <div className="w-1/2 flex justify-center">
          {phase >= 1 && (
            <PhoneFrame>
              {/* Override inner bg to light */}
              <div className="h-full flex flex-col bg-gray-50 relative overflow-hidden">

                {/* Top nav bar — matches real app's primary blue */}
                <div className="bg-indigo-900 px-3 py-2 flex items-center gap-2 shrink-0">
                  <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center border border-white/20">
                    <span className="text-white text-[8px] font-bold">HK</span>
                  </div>
                  <span className="text-white font-bold text-[10px]">HK Masters</span>
                  <span className="text-white/50 text-[9px] ml-auto">Announcements</span>
                </div>

                {/* Page content */}
                <div className="flex-1 overflow-hidden p-2.5 space-y-2">

                  {/* Tabs — matches real app: "In-app feed" | "Email players" */}
                  <div className="flex gap-0.5 bg-gray-100 border border-gray-200 rounded-xl p-0.5">
                    <div className="flex-1 flex items-center justify-center gap-1 bg-white rounded-lg px-1.5 py-1.5 shadow-sm">
                      <span className="text-[8px] font-semibold text-gray-800">📢 In-app feed</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-[8px] text-gray-400">✉️ Email players</span>
                    </div>
                  </div>

                  {/* "New announcement" button — top right, matches real PageLayout action */}
                  <div className="flex justify-end">
                    <motion.div
                      className="bg-indigo-700 text-white text-[8px] font-bold px-2 py-1.5 rounded-lg flex items-center gap-1 shadow"
                      animate={{ scale: phase === 2 ? 0.88 : 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      <span className="text-base leading-none" style={{ lineHeight: 1 }}>+</span>
                      <span>New announcement</span>
                    </motion.div>
                  </div>

                  {/* Announcement card — appears after posting */}
                  <AnimatePresence>
                    {phase >= 6 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm"
                      >
                        <div className="text-[10px] font-bold text-gray-900 mb-0.5">Training moved to 7pm!</div>
                        <div className="text-[8px] text-gray-600 leading-relaxed">Pitch is wet. Meet at the turf at 7pm sharp.</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[7px] text-gray-400">Just now · All squads</span>
                          <div className="flex gap-1 text-gray-400 text-[9px]">
                            <span>📌</span><span>✏️</span><span>🗑️</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Modal overlay */}
                <AnimatePresence>
                  {phase >= 3 && phase < 6 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/40 flex items-end justify-center z-20 pb-4"
                    >
                      <motion.div
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 30, opacity: 0 }}
                        className="bg-white rounded-2xl shadow-2xl w-full mx-2 p-3.5 space-y-2.5"
                      >
                        <div className="text-[11px] font-bold text-gray-900 border-b border-gray-100 pb-2">New announcement</div>

                        {/* Title field */}
                        <div className="space-y-1">
                          <div className="text-[8px] font-semibold text-gray-700">Title</div>
                          <div className="h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 flex items-center">
                            {phase >= 4 && (
                              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-900 text-[9px]">
                                Training moved to 7pm!
                              </motion.span>
                            )}
                          </div>
                        </div>

                        {/* Message field */}
                        <div className="space-y-1">
                          <div className="text-[8px] font-semibold text-gray-700">Message</div>
                          <div className="h-12 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                            {phase >= 4 && (
                              <motion.span
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                                className="text-gray-700 text-[8px] leading-relaxed"
                              >
                                Pitch is wet. Meet at the turf at 7pm sharp. Don't be late!
                              </motion.span>
                            )}
                          </div>
                        </div>

                        {/* Visible to */}
                        <div className="space-y-1">
                          <div className="text-[8px] font-semibold text-gray-700">Visible to</div>
                          <div className="h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 flex items-center justify-between">
                            <span className="text-gray-600 text-[8px]">All squads</span>
                            <span className="text-gray-400 text-[8px]">▾</span>
                          </div>
                        </div>

                        {/* Send push notification checkbox */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-3.5 h-3.5 rounded border-2 border-indigo-600 bg-indigo-600 flex items-center justify-center shrink-0">
                            <span className="text-white text-[7px] font-bold">✓</span>
                          </div>
                          <span className="text-[8px] text-gray-700">Send push notification to players</span>
                        </div>

                        {/* Post button */}
                        <motion.div
                          className="h-8 bg-indigo-700 rounded-lg flex items-center justify-center shadow"
                          animate={{ scale: phase === 5 ? 0.94 : 1 }}
                          transition={{ duration: 0.1 }}
                        >
                          <span className="text-white text-[10px] font-bold">Post</span>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Push notification banner */}
                <AnimatePresence>
                  {phase >= 7 && (
                    <motion.div
                      initial={{ y: -70, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: 'spring', damping: 18, stiffness: 200 }}
                      className="absolute top-11 left-2 right-2 bg-indigo-900 border border-indigo-700 rounded-xl p-2.5 shadow-2xl z-30"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-4 h-4 bg-white/10 rounded border border-white/20 flex items-center justify-center shrink-0">
                          <span className="text-white text-[7px] font-bold">HK</span>
                        </div>
                        <span className="text-white/60 text-[8px]">HK Masters · just now</span>
                      </div>
                      <div className="text-white text-[9px] font-bold">Training moved to 7pm!</div>
                      <div className="text-white/60 text-[8px] mt-0.5">Pitch is wet. Meet at the turf at 7pm sharp...</div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Cursor */}
                {phase >= 1 && phase < 6 && (
                  <Cursor
                    x={phase === 1 ? 140 : phase === 2 ? 200 : phase === 3 ? 150 : phase === 4 ? 120 : 150}
                    y={phase === 1 ? 100 : phase === 2 ? 88 : phase === 3 ? 260 : phase === 4 ? 200 : 300}
                    active={phase === 2 || phase === 5}
                  />
                )}
              </div>
            </PhoneFrame>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const Step = ({ text, active, done }: { text: string; active: boolean; done: boolean }) => (
  <motion.div
    className={`flex items-center gap-4 ${active ? 'opacity-100' : done ? 'opacity-50' : 'opacity-30'}`}
    animate={{ x: active ? 10 : 0 }}
  >
    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${active ? 'border-accent text-accent' : done ? 'border-success text-success bg-success/10' : 'border-slate-600 text-slate-600'}`}>
      {done ? '✓' : '•'}
    </div>
    <span className={`text-xl ${active ? 'text-white font-bold' : 'text-slate-400'}`}>{text}</span>
  </motion.div>
);
