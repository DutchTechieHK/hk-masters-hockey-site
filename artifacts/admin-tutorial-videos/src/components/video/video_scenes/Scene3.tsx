import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneFrame, AppHeader, Cursor } from '../PhoneFrame';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 3000),  // Admin Panel Polls
      setTimeout(() => setPhase(2), 7000),  // Type Question
      setTimeout(() => setPhase(3), 10000), // Add Options
      setTimeout(() => setPhase(4), 14000), // Player view votes
      setTimeout(() => setPhase(5), 19000), // Admin view results
      setTimeout(() => setPhase(6), 24000), // Summary
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
        <div className="w-1/2 pr-12">
          {phase >= 1 && phase < 6 && (
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-4xl font-display font-bold text-white mb-6 leading-tight">
                Stop the <span className="text-accent">chat spam.</span> <br/>Get clear answers.
              </h2>
              
              <div className="space-y-4">
                <Step text="Create New Poll" active={phase >= 1 && phase < 3} done={phase >= 3} />
                <Step text="Add Options" active={phase === 3} done={phase > 3} />
                <Step text="Players vote instantly" active={phase === 4} done={phase > 4} />
                <Step text="See live results" active={phase === 5} done={false} />
              </div>
            </motion.div>
          )}

          {phase >= 6 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-20">
              <h1 className="text-5xl font-display font-bold text-white leading-tight">
                Fast answers, <br/>zero friction.
              </h1>
            </motion.div>
          )}
        </div>

        <div className="w-1/2 flex justify-center">
          {phase >= 1 && (
            <PhoneFrame>
              {phase < 4 ? (
                <div className="h-full bg-slate-900">
                  <AppHeader title="New Poll" showBack={true} />
                  
                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase font-mono">QUESTION</label>
                      <div className="h-16 bg-slate-800 rounded-lg border border-slate-700 px-3 py-2">
                        {phase >= 2 && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white text-sm">Can you make training on Friday?</motion.span>}
                      </div>
                    </div>
                    
                    {phase >= 3 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        <label className="text-xs text-slate-400 uppercase font-mono">OPTIONS</label>
                        <div className="h-10 bg-slate-800 rounded border border-slate-700 px-3 flex items-center text-white text-sm">Yes</div>
                        <div className="h-10 bg-slate-800 rounded border border-slate-700 px-3 flex items-center text-white text-sm">No</div>
                        <div className="h-10 bg-slate-800/50 border border-dashed border-slate-600 rounded flex items-center justify-center text-slate-400 text-sm">
                          + Add Option
                        </div>
                      </motion.div>
                    )}
                    
                    <motion.div 
                      className={`h-12 w-full bg-accent rounded-lg flex items-center justify-center mt-8 ${phase >= 3 ? 'opacity-100' : 'opacity-30'}`}
                    >
                      <span className="text-white font-bold">Create Poll</span>
                    </motion.div>
                  </div>

                  <Cursor 
                    x={phase === 1 ? 150 : phase === 2 ? 100 : phase === 3 ? 160 : 160}
                    y={phase === 1 ? 200 : phase === 2 ? 150 : phase === 3 ? 420 : 420}
                    active={phase === 3}
                  />
                </div>
              ) : phase === 4 ? (
                // Player View Voting
                <div className="h-full bg-slate-900 p-4">
                  <AppHeader title="Polls" />
                  <motion.div 
                    className="mt-6 bg-slate-800 rounded-xl p-5 border border-slate-700"
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  >
                    <h3 className="text-white font-bold text-lg mb-4">Can you make training on Friday?</h3>
                    <div className="space-y-3">
                      <motion.div 
                        className="h-12 rounded-lg border border-accent bg-accent/10 flex items-center px-4 relative overflow-hidden"
                        initial={{ scale: 1 }} animate={{ scale: 1.02 }} transition={{ delay: 1 }}
                      >
                        <div className="w-4 h-4 rounded-full border-2 border-accent mr-3 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-accent"></div>
                        </div>
                        <span className="text-white font-medium relative z-10">Yes</span>
                      </motion.div>
                      <div className="h-12 rounded-lg border border-slate-700 bg-slate-800/50 flex items-center px-4">
                        <div className="w-4 h-4 rounded-full border-2 border-slate-500 mr-3"></div>
                        <span className="text-slate-300 font-medium">No</span>
                      </div>
                    </div>
                  </motion.div>
                  
                  <Cursor x={100} y={200} active={true} />
                </div>
              ) : (
                // Admin View Results
                <div className="h-full bg-slate-900 p-4">
                  <AppHeader title="Live Results" showBack={true} />
                  <motion.div 
                    className="mt-6 bg-slate-800 rounded-xl p-5 border border-slate-700"
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  >
                    <h3 className="text-white font-bold mb-6">Can you make training on Friday?</h3>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-white font-medium">Yes</span>
                          <span className="text-accent font-bold">12</span>
                        </div>
                        <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-accent" initial={{ width: 0 }} animate={{ width: '75%' }} transition={{ duration: 1, delay: 0.5 }} />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-white font-medium">No</span>
                          <span className="text-slate-400 font-bold">4</span>
                        </div>
                        <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-slate-500" initial={{ width: 0 }} animate={{ width: '25%' }} transition={{ duration: 1, delay: 0.7 }} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </PhoneFrame>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const Step = ({ text, active, done }: { text: string, active: boolean, done: boolean }) => (
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