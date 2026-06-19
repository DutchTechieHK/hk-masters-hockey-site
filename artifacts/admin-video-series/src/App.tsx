import VideoWithControls from "@/components/video/VideoWithControls";

const CLIP_DURATIONS: Record<string, Record<string, number>> = {
  clip1: { chapter1: 25000 },
  clip2: { chapter2: 25000 },
  clip3: { chapter3: 30000 },
};

function getClipKey(): string | null {
  const path = window.location.pathname;
  for (const key of Object.keys(CLIP_DURATIONS)) {
    if (path.endsWith(`/${key}`)) return key;
  }
  return null;
}

export default function App() {
  const clipKey = getClipKey();
  const sceneDurations = clipKey ? CLIP_DURATIONS[clipKey] : undefined;
  return <VideoWithControls sceneDurations={sceneDurations} />;
}
