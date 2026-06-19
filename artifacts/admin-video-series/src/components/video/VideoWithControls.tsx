import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Repeat, Volume2, VolumeX, X } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const PROGRESS_TICK_MS = 60;

const SCENE_LABELS: Record<string, string> = {
  chapter1: 'In-App',
  chapter2: 'Email',
  chapter3: 'Polls',
};

const EXPORT_OPTIONS = [
  { label: 'Full Video', subtitle: 'All 3 chapters', urlSuffix: '', duration: '~80s' },
  { label: 'Chapter 1', subtitle: 'In-App announcements', urlSuffix: 'clip1', duration: '~25s' },
  { label: 'Chapter 2', subtitle: 'Email campaigns', urlSuffix: 'clip2', duration: '~25s' },
  { label: 'Chapter 3', subtitle: 'Polls & surveys', urlSuffix: 'clip3', duration: '~30s' },
];

function buildExportUrl(suffix: string): string {
  const base = import.meta.env.BASE_URL as string;
  if (!suffix) return window.location.origin + base;
  const normalised = base.endsWith('/') ? base : base + '/';
  return window.location.origin + normalised + suffix;
}

function ExportPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-black/80 backdrop-blur-md border-b border-white/10 px-5 py-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-white font-semibold text-sm tracking-wide">Download MP4</span>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          aria-label="Close export panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-white/40 text-xs mb-4 leading-relaxed">
        Opens in a new window — the video plays once and records automatically.
        When it finishes, use the browser&apos;s download prompt to save the MP4.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {EXPORT_OPTIONS.map(({ label, subtitle, urlSuffix, duration }) => {
          const url = buildExportUrl(urlSuffix);
          return (
            <a
              key={urlSuffix}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg px-3 py-2.5 transition-colors group"
            >
              <Download className="w-4 h-4 text-white/50 group-hover:text-white/80 mt-0.5 shrink-0 transition-colors" />
              <div className="min-w-0">
                <div className="text-white text-sm font-medium leading-tight">{label}</div>
                <div className="text-white/40 text-xs mt-0.5">{subtitle}</div>
                <div className="text-white/25 text-xs font-mono mt-1">{duration}</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

interface ControlBarProps {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  muted: boolean;
  exportOpen: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onToggleLock: () => void;
  onToggleMute: () => void;
  onToggleExport: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
}

function ProgressSegments({
  sceneKeys,
  activeIndex,
  activeDuration,
  tick,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed(performance.now() - start);
    }, PROGRESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;

  return (
    <div className="flex-1 flex items-center gap-2">
      {sceneKeys.map((key, i) => {
        const isActive = i === activeIndex;
        const fill = isActive ? progress * 100 : 0;
        const label = SCENE_LABELS[key] ?? `Scene ${i + 1}`;
        return (
          <button
            key={key}
            onClick={() => onJumpTo(i)}
            className="flex-1 flex flex-col items-center gap-1 group"
            aria-label={`Jump to ${label}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <span className={`text-xs font-mono transition-colors ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
              {label}
            </span>
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden cursor-pointer group-hover:h-4 group-hover:bg-white/25 transition-all relative min-h-[12px]">
              <div
                className="absolute inset-y-0 left-0 bg-white/90 rounded-full transition-[width] duration-100"
                style={{ width: `${fill}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ControlBar({
  visible, collapsed, locked, muted, exportOpen, sceneKeys, activeIndex, activeDuration, tick,
  onToggleLock, onToggleMute, onToggleExport, onJumpTo, onToggleCollapsed,
}: ControlBarProps) {
  return (
    <div
      className={`flex items-center gap-3 bg-black/50 backdrop-blur-sm px-5 py-4 transition-all duration-200 ease-out ${
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <button
        onClick={onToggleLock}
        className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 ${
          locked
            ? 'text-white bg-white/15 hover:bg-white/25'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        title={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-pressed={locked}
      >
        <Repeat className="w-8 h-8" />
      </button>

      <button
        onClick={onToggleMute}
        className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 ${
          muted
            ? 'text-white/60 hover:text-white hover:bg-white/10'
            : 'text-white bg-white/15 hover:bg-white/25'
        }`}
        title={muted ? 'Unmute audio' : 'Mute audio'}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={!muted}
      >
        {muted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
      </button>

      <button
        onClick={onToggleExport}
        className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 ${
          exportOpen
            ? 'text-white bg-white/15 hover:bg-white/25'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        title="Download MP4"
        aria-label="Download MP4"
        aria-pressed={exportOpen}
      >
        <Download className="w-8 h-8" />
      </button>

      <div className="w-px self-stretch bg-white/15" aria-hidden="true" />

      <ProgressSegments
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        tick={tick}
        onJumpTo={onJumpTo}
      />

      <div className="text-xl text-white/60 font-mono tabular-nums shrink-0">
        {activeIndex + 1}/{sceneKeys.length}
      </div>

      <button
        onClick={onToggleCollapsed}
        className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
        title={collapsed ? 'Show controls' : 'Hide controls'}
        aria-label={collapsed ? 'Show controls' : 'Hide controls'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}
      </button>
    </div>
  );
}

export default function VideoWithControls({
  sceneDurations = SCENE_DURATIONS,
}: {
  sceneDurations?: Record<string, number>;
} = {}) {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  // Standalone viewing tabs (opened from the admin Tutorials page) pass
  // `?view=1` to opt into the control bar. Export/recording URLs omit it so the
  // captured MP4 stays chrome-free.
  const wantsControls =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('view');
  const showControls = isIframed || wantsControls;

  const {
    sceneKeys, activeIndex, locked, mountKey, tick,
    durations, activeDuration, onSceneChange, jumpTo, toggleLock,
  } = useSceneControls(sceneDurations);

  const [muted, setMuted] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);

  const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    if (collapsed) setTapPinned(true);
  }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed(c => {
      if (!c) { setHovering(false); setTapPinned(false); }
      return !c;
    });
  }, []);
  const handleToggleExport = useCallback(() => {
    setExportOpen(o => !o);
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const sensor = sensorRef.current;
      if (sensor && !sensor.contains(e.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [collapsed, tapPinned]);

  const barVisible = !collapsed || hovering || tapPinned;

  if (!showControls) return <VideoTemplate durations={sceneDurations} />;

  return (
    <div className="relative w-full h-screen">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        muted={muted}
        onSceneChange={onSceneChange}
      />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '35%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="flex-1 w-full" aria-hidden="true" />
        {exportOpen && barVisible && (
          <ExportPanel onClose={() => setExportOpen(false)} />
        )}
        <ControlBar
          visible={barVisible}
          collapsed={collapsed}
          locked={locked}
          muted={muted}
          exportOpen={exportOpen}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          tick={tick}
          onToggleLock={toggleLock}
          onToggleMute={() => setMuted(m => !m)}
          onToggleExport={handleToggleExport}
          onJumpTo={jumpTo}
          onToggleCollapsed={handleToggleCollapsed}
        />
      </div>
    </div>
  );
}
