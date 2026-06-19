import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneFrame, Cursor } from '../PhoneFrame';

// Chapter 2: Email Players
// The real app has a dedicated "Email players" TAB on the Announcements page.
// There is NO "Send via Email" toggle on the announcement form.
// Flow: click "Email players" tab → fill Audience / Subject / Message → click "Send to X players" → confirm → sent.

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 3000),   // Announcements page, "In-app feed" active
      setTimeout(() => setPhase(2), 5500),   // Click "Email players" tab
      setTimeout(() => setPhase(3), 7000),   // Email composer appears
      setTimeout(() => setPhase(4), 10000),  // Subject + message filled in
      setTimeout(() => setPhase(5), 14000),  // Click "Send to 48 players"
      setTimeout(() => setPhase(6), 15500),  // Confirm modal
      setTimeout(() => setPhase(7), 17500),  // Toast: Email sent
      setTimeout(() => setPhase(8), 20000),  // Summary
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
        <h2 className="text-accent font-mono text-xl mb-4 tracking-widest">CHAPTER 2</h2>
        <h1 className="text-6xl font-display font-bold text-white">Email Players</h1>
      </motion.div>

      <div className="flex items-center justify-between w-full max-w-6xl px-12">
        {/* Left: Steps */}
        <div className="w-1/2 pr-12">
          {phase >= 1 && phase < 8 && (
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-4xl font-display font-bold text-white mb-6 leading-tight">
                Important news?<br /><span className="text-accent">Reach their inbox.</span>
              </h2>
              <div className="space-y-4">
                <Step text="Go to Announcements" active={phase === 1} done={phase > 1} />
                <Step text='Click "Email players" tab' active={phase === 2} done={phase > 2} />
                <Step text="Choose audience & write message" active={phase >= 3 && phase < 5} done={phase >= 5} />
                <Step text='Click "Send to players"' active={phase === 5 || phase === 6} done={phase > 6} />
                <Step text="Email delivered to all" active={phase >= 7} done={false} />
              </div>
            </motion.div>
          )}
          {phase >= 8 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-20">
              <h1 className="text-5xl font-display font-bold text-white leading-tight">
                Reach everyone,<br />everywhere.
              </h1>
            </motion.div>
          )}
        </div>

        {/* Right: Phone */}
        <div className="w-1/2 flex justify-center">
          {phase >= 1 && (
            <PhoneFrame>
              <div className="h-full flex flex-col bg-gray-50 relative overflow-hidden">

                {/* Top nav bar */}
                <div className="bg-indigo-900 px-3 py-2 flex items-center gap-2 shrink-0">
                  <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center border border-white/20">
                    <span className="text-white text-[8px] font-bold">HK</span>
                  </div>
                  <span className="text-white font-bold text-[10px]">HK Masters</span>
                  <span className="text-white/50 text-[9px] ml-auto">Announcements</span>
                </div>

                {/* Page content */}
                <div className="flex-1 overflow-hidden p-2.5 space-y-2">

                  {/* Tabs */}
                  <div className="flex gap-0.5 bg-gray-100 border border-gray-200 rounded-xl p-0.5">
                    <div className={`flex-1 flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 ${phase < 2 ? 'bg-white shadow-sm' : ''}`}>
                      <span className={`text-[8px] font-semibold ${phase < 2 ? 'text-gray-800' : 'text-gray-400'}`}>📢 In-app feed</span>
                    </div>
                    <motion.div
                      className={`flex-1 flex items-center justify-center rounded-lg px-1.5 py-1.5 ${phase >= 2 ? 'bg-white shadow-sm' : ''}`}
                      animate={{ scale: phase === 2 ? 0.93 : 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      <span className={`text-[8px] font-semibold ${phase >= 2 ? 'text-gray-800' : 'text-gray-400'}`}>✉️ Email players</span>
                    </motion.div>
                  </div>

                  {/* Email composer — shows once Email players tab is active */}
                  <AnimatePresence>
                    {phase >= 3 && phase < 7 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-white rounded-xl border border-gray-200 p-3 space-y-2.5 shadow-sm"
                      >
                        <div className="text-[9px] font-bold text-gray-700 flex items-center gap-1">
                          <span>✉</span> Compose email
                        </div>

                        {/* Audience selector — real app: "All players" | "By squad" | "Individuals" */}
                        <div className="space-y-1">
                          <div className="text-[7px] font-semibold text-gray-600 uppercase tracking-wide">Audience</div>
                          <div className="flex gap-1">
                            <div className="flex-1 bg-indigo-700 text-white text-[7px] font-semibold rounded-md py-1 text-center">All players</div>
                            <div className="flex-1 bg-white border border-gray-200 text-gray-500 text-[7px] rounded-md py-1 text-center">By squad</div>
                            <div className="flex-1 bg-white border border-gray-200 text-gray-500 text-[7px] rounded-md py-1 text-center">Individuals</div>
                          </div>
                        </div>

                        {/* Subject */}
                        <div className="space-y-1">
                          <div className="text-[7px] font-semibold text-gray-600 uppercase tracking-wide">Subject</div>
                          <div className="h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 flex items-center">
                            {phase >= 4 && (
                              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-900 text-[8px]">
                                Tournament fees due Friday
                              </motion.span>
                            )}
                          </div>
                        </div>

                        {/* Message */}
                        <div className="space-y-1">
                          <div className="text-[7px] font-semibold text-gray-600 uppercase tracking-wide">Message</div>
                          <div className="h-14 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                            {phase >= 4 && (
                              <motion.span
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                                className="text-gray-700 text-[8px] leading-relaxed"
                              >
                                Hi all, please pay your tournament fees by end of Friday. Contact the admin team if you have any questions.
                              </motion.span>
                            )}
                          </div>
                        </div>

                        {/* Recipients preview */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                          <span className="text-[7px] text-gray-500">👥 48 recipients</span>
                        </div>

                        {/* Send button */}
                        <motion.div
                          className="h-8 bg-indigo-700 rounded-lg flex items-center justify-center gap-1 shadow"
                          animate={{ scale: phase === 5 ? 0.93 : 1 }}
                          transition={{ duration: 0.1 }}
                        >
                          <span className="text-white text-[8px] font-bold">✉ Send to 48 players</span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Confirmation modal */}
                <AnimatePresence>
                  {phase === 6 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center px-4 z-20"
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-2xl p-4 w-full shadow-2xl space-y-3"
                      >
                        <div className="text-[11px] font-bold text-gray-900">Send emails?</div>
                        <div className="text-[8px] text-gray-600 space-y-1">
                          <div><span className="font-semibold">Subject:</span> Tournament fees due Friday</div>
                          <div><span className="font-semibold">Recipients:</span> 48 players</div>
                          <div className="text-amber-600 text-[7px] mt-1">⚠ This cannot be undone.</div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <div className="flex-1 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-gray-600 text-[8px] font-medium">Cancel</span>
                          </div>
                          <div className="flex-1 h-7 bg-indigo-700 rounded-lg flex items-center justify-center shadow">
                            <span className="text-white text-[8px] font-bold">Send emails</span>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success toast */}
                <AnimatePresence>
                  {phase >= 7 && phase < 8 && (
                    <motion.div
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 20, opacity: 0 }}
                      className="absolute bottom-6 left-3 right-3 bg-gray-900 text-white rounded-xl px-3 py-2.5 shadow-2xl z-30 flex items-center gap-2"
                    >
                      <span className="text-green-400 text-sm">✓</span>
                      <span className="text-[9px] font-semibold">Email sent to 48 players</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Cursor */}
                {phase >= 1 && phase <= 5 && (
                  <Cursor
                    x={phase <= 1 ? 140 : phase === 2 ? 195 : phase === 3 ? 150 : phase === 4 ? 130 : 150}
                    y={phase <= 1 ? 80 : phase === 2 ? 62 : phase === 3 ? 180 : phase === 4 ? 200 : 310}
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
