import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneFrame, Cursor } from '../PhoneFrame';

// Chapter 3: Quick Polls
// Real app: Polls page (separate nav item, BarChart2 icon).
// "New poll" button opens a modal with: Title, Description, Audience (All/MO40/MO50/both),
// Allow multiple checkbox, Deadline datetime, and up to 5 Options.
// Submit button: "Create poll".
// Poll list shows progress bars per option + "Show voters & non-responders".

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 3000),   // Polls page appears
      setTimeout(() => setPhase(2), 5500),   // Cursor clicks "New poll"
      setTimeout(() => setPhase(3), 7000),   // Modal opens, fill in question
      setTimeout(() => setPhase(4), 10000),  // Options filled, deadline set
      setTimeout(() => setPhase(5), 14000),  // Click "Create poll"
      setTimeout(() => setPhase(6), 15500),  // Modal closes, poll card appears with bars
      setTimeout(() => setPhase(7), 20000),  // Results animate in
      setTimeout(() => setPhase(8), 25000),  // Summary
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
        <h2 className="text-accent font-mono text-xl mb-4 tracking-widest">CHAPTER 3</h2>
        <h1 className="text-6xl font-display font-bold text-white">Quick Polls</h1>
      </motion.div>

      <div className="flex items-center justify-between w-full max-w-6xl px-12">
        {/* Left: Steps */}
        <div className="w-1/2 pr-12">
          {phase >= 1 && phase < 8 && (
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-4xl font-display font-bold text-white mb-6 leading-tight">
                Stop the <span className="text-accent">chat spam.</span><br />Get clear answers.
              </h2>
              <div className="space-y-4">
                <Step text="Open Polls" active={phase === 1} done={phase > 1} />
                <Step text='Click "New poll"' active={phase === 2} done={phase > 2} />
                <Step text="Add question, options & deadline" active={phase >= 3 && phase < 5} done={phase >= 5} />
                <Step text='Click "Create poll"' active={phase === 5} done={phase > 5} />
                <Step text="See live results" active={phase >= 6} done={false} />
              </div>
            </motion.div>
          )}
          {phase >= 8 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-20">
              <h1 className="text-5xl font-display font-bold text-white leading-tight">
                Fast answers,<br />zero friction.
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
                  <span className="text-white/50 text-[9px] ml-auto">Polls</span>
                </div>

                {/* Page content */}
                <div className="flex-1 overflow-hidden p-2.5 space-y-2">

                  {/* Page header row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-gray-900">Polls</div>
                      <div className="text-[7px] text-gray-500">Create scheduling polls & collect responses</div>
                    </div>
                    <motion.div
                      className="bg-indigo-700 text-white text-[8px] font-bold px-2 py-1.5 rounded-lg flex items-center gap-1 shadow"
                      animate={{ scale: phase === 2 ? 0.88 : 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      <span className="text-base leading-none" style={{ lineHeight: 1 }}>+</span>
                      <span>New poll</span>
                    </motion.div>
                  </div>

                  {/* Poll card — appears after creation */}
                  <AnimatePresence>
                    {phase >= 6 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-2"
                      >
                        {/* Poll header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[7px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">All players</span>
                            </div>
                            <div className="text-[9px] font-bold text-gray-900">Can you make training on Friday?</div>
                            <div className="text-[7px] text-gray-400 mt-0.5">Deadline: Fri 20 Jun · 12 votes</div>
                          </div>
                          <div className="flex gap-1 text-gray-400 text-[9px] shrink-0">
                            <span>✉</span><span>🔒</span><span>🗑️</span>
                          </div>
                        </div>

                        {/* Results bars — animated */}
                        <div className="space-y-1.5">
                          <div>
                            <div className="flex justify-between text-[7px] mb-0.5">
                              <span className="text-gray-800 font-medium">Yes</span>
                              <span className="text-gray-500">9 (75%)</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-indigo-600 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: phase >= 7 ? '75%' : '10%' }}
                                transition={{ duration: 1, delay: 0.3 }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[7px] mb-0.5">
                              <span className="text-gray-800 font-medium">No</span>
                              <span className="text-gray-500">3 (25%)</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-indigo-300 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: phase >= 7 ? '25%' : '10%' }}
                                transition={{ duration: 1, delay: 0.5 }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="text-[7px] text-gray-400 flex items-center gap-1">
                          <span>▾</span> Show voters &amp; non-responders
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Create poll modal */}
                <AnimatePresence>
                  {phase >= 3 && phase < 6 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/40 flex items-end justify-center z-20 pb-4"
                    >
                      <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        className="bg-white rounded-2xl shadow-2xl w-full mx-2 p-3.5 space-y-2.5"
                      >
                        <div className="text-[11px] font-bold text-gray-900 border-b border-gray-100 pb-2">New poll</div>

                        {/* Title */}
                        <div className="space-y-1">
                          <div className="text-[8px] font-semibold text-gray-700">Title</div>
                          <div className="h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 flex items-center">
                            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-900 text-[8px]">
                              Can you make training on Friday?
                            </motion.span>
                          </div>
                        </div>

                        {/* Audience */}
                        <div className="space-y-1">
                          <div className="text-[8px] font-semibold text-gray-700">Audience</div>
                          <div className="flex gap-1">
                            <div className="flex-1 bg-indigo-700 text-white text-[7px] font-semibold rounded-md py-1 text-center">All players</div>
                            <div className="flex-1 bg-white border border-gray-200 text-gray-400 text-[7px] rounded-md py-1 text-center">MO40</div>
                            <div className="flex-1 bg-white border border-gray-200 text-gray-400 text-[7px] rounded-md py-1 text-center">MO50</div>
                          </div>
                        </div>

                        {/* Options */}
                        <div className="space-y-1">
                          <div className="text-[8px] font-semibold text-gray-700">Options</div>
                          <AnimatePresence>
                            {phase >= 4 ? (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                                <div className="h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 flex items-center">
                                  <span className="text-gray-900 text-[8px]">Yes</span>
                                </div>
                                <div className="h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 flex items-center">
                                  <span className="text-gray-900 text-[8px]">No</span>
                                </div>
                                <div className="h-6 border border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                                  <span className="text-gray-400 text-[7px]">+ Add option</span>
                                </div>
                              </motion.div>
                            ) : (
                              <div className="space-y-1">
                                <div className="h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 flex items-center" />
                                <div className="h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 flex items-center" />
                              </div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Deadline */}
                        <div className="space-y-1">
                          <div className="text-[8px] font-semibold text-gray-700">Deadline <span className="font-normal text-gray-400">(optional)</span></div>
                          <div className="h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 flex items-center">
                            {phase >= 4 && (
                              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-gray-700 text-[8px]">
                                2026-06-20T23:59
                              </motion.span>
                            )}
                          </div>
                        </div>

                        {/* Create poll button */}
                        <motion.div
                          className="h-8 bg-indigo-700 rounded-lg flex items-center justify-center shadow"
                          animate={{ scale: phase === 5 ? 0.94 : 1 }}
                          transition={{ duration: 0.1 }}
                        >
                          <span className="text-white text-[10px] font-bold">Create poll</span>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Cursor */}
                {phase >= 1 && phase < 6 && (
                  <Cursor
                    x={phase === 1 ? 150 : phase === 2 ? 220 : phase === 3 ? 130 : phase === 4 ? 130 : 150}
                    y={phase === 1 ? 100 : phase === 2 ? 94 : phase === 3 ? 190 : phase === 4 ? 280 : 360}
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
