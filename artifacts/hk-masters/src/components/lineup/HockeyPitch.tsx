import { forwardRef, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Portrait field hockey pitch (91.4m x 55m). Our goal is at the bottom; we attack upward.
 * Children are positioned with normalized 0..100 percentages over the playing surface.
 */
export const PITCH_W = 55;
export const PITCH_H = 91.4;

function Circle({ top }: { top: boolean }) {
  // Shooting circle: 14.63m quarter arcs from each post joined by a 3.66m straight; dashed line 5m outside.
  const gy = top ? 0 : PITCH_H;
  const s = top ? 1 : -1;
  const sweep = top ? 0 : 1;
  const d = (r: number) =>
    `M${25.67 - r} ${gy} A${r} ${r} 0 0 ${sweep} 25.67 ${gy + s * r} L29.33 ${gy + s * r} A${r} ${r} 0 0 ${sweep} ${29.33 + r} ${gy}`;
  return (
    <g>
      <path d={d(14.63)} fill="hsl(205 70% 30% / 0.35)" stroke="currentColor" strokeWidth={0.32} />
      <path d={d(19.63)} fill="none" stroke="currentColor" strokeWidth={0.28} strokeDasharray="1.1 1.1" opacity={0.85} />
      <circle cx={27.5} cy={top ? 6.475 : PITCH_H - 6.475} r={0.32} fill="currentColor" />
      <line x1={25.67} x2={29.33} y1={gy} y2={gy} stroke="hsl(48 96% 70%)" strokeWidth={1.3} />
    </g>
  );
}

export function HockeyPitchMarkings() {
  const bands = Array.from({ length: 8 }, (_, i) => i);
  return (
    <svg viewBox={`0 0 ${PITCH_W} ${PITCH_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full text-white/90 pointer-events-none" aria-hidden>
      <rect x={0} y={0} width={PITCH_W} height={PITCH_H} fill="hsl(208 62% 34%)" />
      {bands.map((i) => i % 2 === 0 && (
        <rect key={i} x={0} y={(PITCH_H / 8) * i} width={PITCH_W} height={PITCH_H / 8} fill="hsl(208 62% 38%)" />
      ))}
      <rect x={0.16} y={0.16} width={PITCH_W - 0.32} height={PITCH_H - 0.32} fill="none" stroke="currentColor" strokeWidth={0.32} />
      <line x1={0} x2={PITCH_W} y1={PITCH_H / 2} y2={PITCH_H / 2} stroke="currentColor" strokeWidth={0.32} />
      <line x1={0} x2={PITCH_W} y1={22.9} y2={22.9} stroke="currentColor" strokeWidth={0.32} />
      <line x1={0} x2={PITCH_W} y1={PITCH_H - 22.9} y2={PITCH_H - 22.9} stroke="currentColor" strokeWidth={0.32} />
      <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={0.3} fill="currentColor" />
      {/* 5m and 10m corner/side marks */}
      {[5, 10].map((m) => (
        <g key={m} stroke="currentColor" strokeWidth={0.3}>
          <line x1={m} x2={m} y1={0} y2={0.9} />
          <line x1={PITCH_W - m} x2={PITCH_W - m} y1={0} y2={0.9} />
          <line x1={m} x2={m} y1={PITCH_H} y2={PITCH_H - 0.9} />
          <line x1={PITCH_W - m} x2={PITCH_W - m} y1={PITCH_H} y2={PITCH_H - 0.9} />
        </g>
      ))}
      <Circle top />
      <Circle top={false} />
    </svg>
  );
}

type PitchProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode; maxWidth?: number };

export const HockeyPitch = forwardRef<HTMLDivElement, PitchProps>(function HockeyPitch({ children, className, maxWidth = 380, style, ...rest }, ref) {
  return (
    <div className="mx-auto w-full rounded-[18px] bg-[hsl(208_55%_22%)] p-2.5 shadow-[0_18px_40px_-20px_hsl(219_57%_20%/0.6)]" style={{ maxWidth }}>
      <div
        ref={ref}
        className={cn("relative w-full overflow-visible select-none", className)}
        style={{ aspectRatio: `${PITCH_W} / ${PITCH_H}`, ...style }}
        {...rest}
      >
        <HockeyPitchMarkings />
        {children}
      </div>
    </div>
  );
});
