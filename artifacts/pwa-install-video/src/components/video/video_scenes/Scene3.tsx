import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PlusSquare } from 'lucide-react';

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
        <motion.div 
          className="relative w-[300px] h-[600px] bg-white rounded-[3rem] border-8 border-gray-800 overflow-hidden shadow-2xl flex flex-col justify-end"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {phase < 3 && (
            <div className="absolute inset-x-0 bottom-0 bg-gray-100 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-3/4 p-4 z-10 flex flex-col">
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
              
              <div className="flex space-x-4 mb-6 px-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-sm"></div>
                    <div className="w-10 h-2 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
                <div className="h-12 border-b border-gray-100 flex items-center px-4">
                  <div className="w-5 h-5 bg-gray-200 rounded mr-3"></div>
                  <div className="w-24 h-3 bg-gray-200 rounded"></div>
                </div>
                <div className="h-12 border-b border-gray-100 flex items-center px-4">
                  <div className="w-5 h-5 bg-gray-200 rounded mr-3"></div>
                  <div className="w-32 h-3 bg-gray-200 rounded"></div>
                </div>
                <motion.div 
                  className="h-12 flex items-center px-4 relative overflow-hidden"
                  animate={phase >= 2 ? { backgroundColor: '#F3F4F6' } : {}}
                >
                  <PlusSquare className="w-5 h-5 text-gray-500 mr-3" />
                  <span className="text-sm text-gray-800 font-medium">Add to Home Screen</span>
                  {phase >= 2 && (
                    <motion.div 
                      className="absolute inset-0 bg-gray-200"
                      initial={{ scaleX: 0, transformOrigin: 'left' }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.4 }}
                      style={{ opacity: 0.5, zIndex: -1 }}
                    />
                  )}
                </motion.div>
              </div>
            </div>
          )}

          {phase >= 3 && (
            <motion.div 
              className="absolute inset-0 bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="absolute top-12 px-4 w-full flex flex-wrap gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="w-14 h-14 bg-gray-800 rounded-2xl"></div>
                ))}
                
                {phase >= 4 && (
                  <motion.div 
                    className="w-14 h-14 bg-[var(--color-primary)] rounded-2xl flex items-center justify-center overflow-hidden"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <img src={`${import.meta.env.BASE_URL}logo.png`} className="w-full h-full object-cover" />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>

        <div className="w-1/2">
          <motion.h2 
            className="text-[4.5vw] font-bold text-[var(--color-accent)] leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8 }}
          >
            Tap 'Add to Home Screen'
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
