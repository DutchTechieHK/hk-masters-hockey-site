import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS: Record<string, number> = {
  open: 10000,
  ios1: 8000,
  ios2: 9000,
  android: 9000,
  close: 10000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  open: Scene1,
  ios1: Scene2,
  ios2: Scene3,
  android: Scene4,
  close: Scene5,
};

const SCENE_LABELS: Record<string, string> = {
  open: 'Open',
  ios1: 'iOS 1',
  ios2: 'iOS 2',
  android: 'Android',
  close: 'Close',
};

const IS_DEV = import.meta.env.DEV;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey, currentScene, sceneKeys, jumpToScene } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center overflow-hidden relative"
      ref={(el) => {
        if (!el) return;
        const scale = Math.min(el.clientWidth / 1280, el.clientHeight / 720);
        el.style.setProperty('--canvas-scale', String(scale));
      }}
    >
    <div className="relative overflow-hidden bg-[var(--color-bg-dark)]"
      style={{ width: 1280, height: 720, maxWidth: '100vw', maxHeight: '100vh', transform: 'scale(var(--canvas-scale, 1))', transformOrigin: 'top left' }}
    >

      {/* Persistent Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div
          className="absolute top-0 left-0 w-[80vw] h-[80vw] rounded-full mix-blend-screen opacity-20 blur-[100px]"
          style={{ background: 'radial-gradient(circle, var(--color-primary), transparent)' }}
          animate={{
            x: ['-20%', '10%', '-20%'],
            y: ['-20%', '10%', '-20%'],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-[60vw] h-[60vw] rounded-full mix-blend-screen opacity-30 blur-[80px]"
          style={{ background: 'radial-gradient(circle, var(--color-primary), transparent)' }}
          animate={{
            x: ['20%', '-10%', '20%'],
            y: ['20%', '-10%', '20%'],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>

    {IS_DEV && (
      <div
        className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 z-50"
        style={{ pointerEvents: 'all' }}
      >
        {sceneKeys.map((key, index) => {
          const isActive = index === currentScene;
          const label = SCENE_LABELS[key] ?? key;
          return (
            <button
              key={key}
              onClick={() => jumpToScene(index)}
              title={`Jump to scene ${index + 1}: ${label}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
              }}
            >
              <div
                style={{
                  width: isActive ? 14 : 10,
                  height: isActive ? 14 : 10,
                  borderRadius: '50%',
                  background: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                  border: isActive ? '2px solid rgba(255,255,255,0.9)' : '2px solid rgba(255,255,255,0.2)',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 6px rgba(255,255,255,0.7)' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontFamily: 'monospace',
                  fontWeight: isActive ? 700 : 400,
                  transition: 'all 0.2s ease',
                  userSelect: 'none',
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    )}
    </div>
  );
}
