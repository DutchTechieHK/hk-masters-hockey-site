import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Scene1 } from './Scene1';
import { Scene2 } from './Scene2';
import { Scene3 } from './Scene3';
import { Scene4 } from './Scene4';
import { Scene5 } from './Scene5';

const SCENES = [Scene1, Scene2, Scene3, Scene4, Scene5];
const DURATIONS = [10000, 8000, 9000, 9000, 10000];

export default function InstallVideoPlayer() {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setScene(prev => (prev + 1) % SCENES.length);
    }, DURATIONS[scene]);
    return () => clearTimeout(timer);
  }, [scene]);

  const SceneComponent = SCENES[scene];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{
        aspectRatio: '16 / 9',
        '--iv-primary': '#1E3A6E',
        '--iv-bg-dark': '#16305D',
        '--iv-accent': '#F2E8D5',
        '--iv-font-display': "'Plus Jakarta Sans', sans-serif",
      } as React.CSSProperties}
    >
      <AnimatePresence mode="popLayout">
        <SceneComponent key={scene} />
      </AnimatePresence>
    </div>
  );
}
