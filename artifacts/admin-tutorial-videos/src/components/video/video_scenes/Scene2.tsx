import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneFrame, AppHeader, Cursor } from '../PhoneFrame';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 3000),  // Phone appears, New Announcement
      setTimeout(() => setPhase(2), 6000),  // Typing
      setTimeout(() => setPhase(3), 9000),  // Toggle Email
      setTimeout(() => setPhase(4), 12000), // Publish
      setTimeout(() => setPhase(5), 15000), // Player view + Notifications
      setTimeout(() => setPhase(6), 20000), // Summary
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
        <h1 className="text-6xl font-display font-bold text-white">Email Announcements</h1>
      </motion.div>

      <div className="flex items-center justify-between w-full max-w-6xl px-12">
        <div className="w-1/2 pr-12">
          {phase >= 1 && phase < 6 && (
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-4xl font-display font-bold text-white mb-6 leading-tight">
                Important news? <br/><span className="text-accent">Double the reach.</span>
              </h2>
              
              <div className="space-y-4">
                <Step text="Draft Announcement" active={phase >= 1 && phase < 3} done={phase >= 3} />
                <Step text="Toggle 'Send via Email'" active={phase === 3} done={phase > 3} />
                <Step text="Publish" active={phase === 4} done={phase > 4} />
                <Step text="App & Email delivered" active={phase >= 5} done={false} />
              </div>
            </motion.div>
          )}

          {phase >= 6 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-20">
              <h1 className="text-5xl font-display font-bold text-white leading-tight">
                Reach everyone, <br/>everywhere.
              </h1>
            </motion.div>
          )}
        </div>

        <div className="w-1/2 flex justify-center">
          {phase >= 1 && (
            <PhoneFrame>
              {phase < 5 ? (
                <div className="h-full bg-slate-900">
                  <AppHeader title="New Announcement" showBack={true} />
                  
                  <div className="p-4 space-y-4 mt-2">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase font-mono">TITLE</label>
                      <div className="h-12 bg-slate-800 rounded-lg border border-slate-700 px-3 flex items-center">
                        <span className="text-white text-sm">Tournament Fees Due</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase font-mono">MESSAGE</label>
                      <div className="h-24 bg-slate-800 rounded-lg border border-slate-700 px-3 py-3">
                        {phase >= 2 && (
                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-300 text-sm">
                            Please pay your fees by Friday.
                          </motion.span>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                        <div>
                          <p className="text-white font-bold text-sm">Send via Email</p>
                          <p className="text-slate-400 text-xs">Also send to registered emails</p>
                        </div>
                        <motion.div 
                          className={`w-12 h-6 rounded-full p-1 flex items-center transition-colors ${phase >= 3 ? 'bg-accent' : 'bg-slate-700'}`}
                        >
                          <motion.div 
                            className="w-4 h-4 bg-white rounded-full shadow-sm"
                            animate={{ x: phase >= 3 ? 24 : 0 }}
                          />
                        </motion.div>
                      </div>
                    </div>
                    
                    <motion.div 
                      className="h-12 w-full bg-accent rounded-lg flex items-center justify-center mt-6"
                      animate={{ scale: phase === 4 ? 0.95 : 1 }}
                    >
                      <span className="text-white font-bold">Publish</span>
                    </motion.div>
                  </div>

                  {phase < 5 && (
                    <Cursor 
                      x={phase === 1 ? 150 : phase === 2 ? 100 : phase === 3 ? 260 : phase === 4 ? 160 : 160}
                      y={phase === 1 ? 200 : phase === 2 ? 150 : phase === 3 ? 360 : phase === 4 ? 460 : 460}
                      active={phase === 3 || phase === 4}
                    />
                  )}
                </div>
              ) : (
                <div className="h-full bg-slate-900 relative">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=600')] bg-cover bg-center opacity-20"></div>
                  
                  {/* Email Notification */}
                  <motion.div 
                    className="absolute top-4 left-2 right-2 bg-slate-100 rounded-xl shadow-2xl p-4 z-20"
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', damping: 20, delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-white text-[10px]">M</div>
                      <span className="text-slate-500 text-xs">Mail • just now</span>
                    </div>
                    <h4 className="text-slate-900 font-bold text-sm">HK Masters: Tournament Fees</h4>
                    <p className="text-slate-600 text-xs mt-1 line-clamp-1">Please pay your fees by Friday...</p>
                  </motion.div>

                  {/* App Notification */}
                  <motion.div 
                    className="absolute top-28 left-2 right-2 bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 z-10"
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', damping: 20, delay: 0.8 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-accent rounded flex items-center justify-center text-white text-[10px]">HK</div>
                      <span className="text-slate-300 text-xs">HK Masters • just now</span>
                    </div>
                    <h4 className="text-white font-bold text-sm">Tournament Fees Due</h4>
                    <p className="text-slate-400 text-xs mt-1">Tap to view announcement</p>
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