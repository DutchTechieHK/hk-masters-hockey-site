import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneFrame, AppHeader, Cursor } from '../PhoneFrame';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 3000),  // Phone appears, Admin Panel
      setTimeout(() => setPhase(2), 5000),  // Tap Announcements
      setTimeout(() => setPhase(3), 7000),  // Tap New Announcement
      setTimeout(() => setPhase(4), 9000),  // Typing
      setTimeout(() => setPhase(5), 13000), // Hit Publish
      setTimeout(() => setPhase(6), 16000), // Player View Switch
      setTimeout(() => setPhase(7), 18000), // Notification appears
      setTimeout(() => setPhase(8), 21000), // Summary text
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

      {/* Main Content Layout */}
      <div className="flex items-center justify-between w-full max-w-6xl px-12">
        {/* Left Side: Narration Text */}
        <div className="w-1/2 pr-12">
          {phase >= 1 && phase < 8 && (
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-4xl font-display font-bold text-white mb-6 leading-tight">
                Keep the squad <br/><span className="text-accent">in the loop.</span>
              </h2>
              
              <div className="space-y-4">
                <Step text="Open Admin Panel" active={phase >= 1} done={phase > 1} />
                <Step text="Tap Announcements" active={phase >= 2 && phase < 4} done={phase >= 4} />
                <Step text="Write & Publish" active={phase >= 4 && phase < 6} done={phase >= 6} />
                <Step text="Players notified instantly" active={phase >= 6} done={false} />
              </div>
            </motion.div>
          )}

          {phase >= 8 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-20">
              <h1 className="text-5xl font-display font-bold text-white leading-tight">
                Instant updates <br/>for your team.
              </h1>
            </motion.div>
          )}
        </div>

        {/* Right Side: Phone Mockup */}
        <div className="w-1/2 flex justify-center">
          {phase >= 1 && (
            <PhoneFrame>
              {phase < 6 ? (
                // Admin View
                <div className="h-full bg-slate-900">
                  <AppHeader title={phase < 3 ? "Admin Dashboard" : "New Announcement"} showBack={phase >= 3} />
                  
                  <div className="p-4 space-y-4">
                    {phase < 3 && (
                      <>
                        <div className="h-24 bg-slate-800 rounded-xl p-4 flex flex-col justify-center">
                          <div className="w-8 h-8 rounded-full bg-accent/20 mb-2"></div>
                          <div className="h-4 w-32 bg-slate-700 rounded"></div>
                        </div>
                        <motion.div 
                          className="h-16 bg-slate-800 rounded-xl p-4 flex items-center shadow-lg border border-slate-700"
                          animate={{ scale: phase === 2 ? 0.95 : 1, borderColor: phase === 2 ? '#0ea5e9' : '#334155' }}
                        >
                          <div className="flex-1 h-4 bg-slate-600 rounded"></div>
                        </motion.div>
                      </>
                    )}

                    {phase >= 3 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <label className="text-xs text-slate-400 uppercase font-mono">TITLE</label>
                          <div className="h-12 bg-slate-800 rounded-lg border border-slate-700 px-3 flex items-center">
                            {phase >= 4 && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white text-sm">Training moved to 7pm!</motion.span>}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-slate-400 uppercase font-mono">MESSAGE</label>
                          <div className="h-32 bg-slate-800 rounded-lg border border-slate-700 px-3 py-3">
                            {phase >= 4 && (
                              <motion.span 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                transition={{ delay: 0.5 }}
                                className="text-slate-300 text-sm"
                              >
                                Pitch is wet. Meet at the turf at 7pm sharp. Don't be late!
                              </motion.span>
                            )}
                          </div>
                        </div>
                        
                        <motion.div 
                          className="h-12 w-full bg-accent rounded-lg flex items-center justify-center mt-8"
                          animate={{ scale: phase === 5 ? 0.95 : 1 }}
                        >
                          <span className="text-white font-bold">Publish</span>
                        </motion.div>
                      </motion.div>
                    )}
                  </div>

                  {/* Cursor */}
                  {phase < 6 && (
                    <Cursor 
                      x={phase === 1 ? 50 : phase === 2 ? 150 : phase === 3 ? 200 : phase === 4 ? 100 : phase === 5 ? 160 : 160}
                      y={phase === 1 ? 400 : phase === 2 ? 200 : phase === 3 ? 50 : phase === 4 ? 150 : phase === 5 ? 450 : 450}
                      active={phase === 2 || phase === 3 || phase === 5}
                    />
                  )}
                </div>
              ) : (
                // Player View
                <div className="h-full bg-slate-900 relative">
                  <AppHeader title="HK Masters" />
                  <div className="p-4 space-y-4 opacity-50">
                    <div className="h-32 bg-slate-800 rounded-xl"></div>
                    <div className="h-20 bg-slate-800 rounded-xl"></div>
                    <div className="h-20 bg-slate-800 rounded-xl"></div>
                  </div>

                  {/* Notification Drop */}
                  {phase >= 7 && (
                    <motion.div 
                      className="absolute top-4 left-2 right-2 bg-slate-800 border-l-4 border-accent rounded-lg shadow-2xl p-4"
                      initial={{ y: -100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: 'spring', damping: 20 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded bg-accent/20 flex items-center justify-center text-accent font-bold">!</div>
                        <div>
                          <h4 className="text-white font-bold text-sm">Training moved to 7pm!</h4>
                          <p className="text-slate-400 text-xs mt-1">Pitch is wet. Meet at the turf at 7pm sharp...</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
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