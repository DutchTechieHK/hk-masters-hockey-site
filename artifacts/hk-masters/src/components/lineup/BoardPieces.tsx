import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import type { LineupPlacement, LineupPerson } from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { hkFull } from "@/lib/staff-utils";

export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
export type Snap = { name: string; shirtNumber: number | null; position: string | null; status: LineupPerson["status"] };
export const surname = (name: string) => { const parts = name.trim().split(/\s+/); return parts.length > 1 ? parts.slice(1).join(" ") : name; };

export function SaveStatus({ state, dirty, error, updatedAt }: { state: SaveState; dirty: boolean; error: string | null; updatedAt: string | null }) {
  let tone = "text-muted-foreground";
  let text = updatedAt ? `Saved ${hkFull(updatedAt)}` : "No saved draft yet";
  if (state === "saving") { text = "Saving…"; }
  else if (state === "conflict") { tone = "text-amber-800"; text = "Not saved: newer version exists"; }
  else if (state === "error") { tone = "text-destructive"; text = error ?? "Save failed. Your board is kept."; }
  else if (dirty) { tone = "text-amber-800"; text = "Unsaved changes"; }
  else if (state === "saved") { tone = "text-emerald-700"; text = "Draft saved"; }
  return (
    <p className={cn("text-xs font-medium min-w-0 leading-tight", tone)} role="status" aria-live="polite" data-testid="status-save">
      {dirty && state !== "saving" && <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle" />}
      {text}
      {error && state !== "error" && <span className="block text-destructive">{error}</span>}
    </p>
  );
}

export function Marker({ p, snap, status, issue, selected, editable, dragging, onPointerDown, onClick, onKeyDown }: {
  p: LineupPlacement; snap?: Snap; status: LineupPerson["status"]; issue?: string; selected: boolean; editable: boolean; dragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void; onClick: () => void; onKeyDown: (e: ReactKeyboardEvent) => void;
}) {
  const name = snap?.name ?? `Player ${p.playerId}`;
  const maybe = status === "maybe";
  const label = `${name}${snap?.shirtNumber != null ? `, number ${snap.shirtNumber}` : ""}${maybe ? ", provisional" : ""}${issue ? `, needs review: ${issue}` : ""}`;
  const inner = (
    <>
      <span className={cn(
        "relative w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm shadow-md transition-transform",
        issue ? "bg-white text-destructive ring-2 ring-destructive" : "bg-[hsl(40_60%_96%)] text-primary",
        maybe && !issue && "ring-2 ring-amber-400 ring-offset-1 ring-offset-transparent outline outline-2 outline-dashed outline-amber-300 outline-offset-2",
        selected && "scale-110 ring-[3px] ring-[hsl(75_90%_60%)]",
      )}>
        {snap?.shirtNumber ?? surname(name).slice(0, 2).toUpperCase()}
        {maybe && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-[9px] text-amber-950 flex items-center justify-center font-sans">?</span>}
        {issue && <AlertTriangle className="absolute -top-1.5 -right-1.5 w-4 h-4 text-destructive fill-white" />}
      </span>
      <span className="mt-0.5 max-w-[5.5rem] rounded bg-[hsl(219_57%_14%/0.82)] px-1 py-px text-[10px] leading-tight font-semibold text-white text-center break-words">{name}</span>
    </>
  );
  const cls = cn("absolute -translate-x-1/2 -translate-y-[22px] flex flex-col items-center min-w-11 min-h-11 outline-none", dragging && "opacity-30", selected ? "z-20" : "z-10");
  const style = { left: `${p.x}%`, top: `${p.y}%` };
  if (!editable) return <div data-marker className={cls} style={style} aria-label={label} data-testid={`marker-${p.playerId}`}>{inner}</div>;
  return (
    <button type="button" data-marker className={cn(cls, "touch-none focus-visible:[&>span:first-child]:ring-4 focus-visible:[&>span:first-child]:ring-white")} style={style}
      aria-label={label} aria-pressed={selected} onPointerDown={onPointerDown} onClick={(e) => { e.stopPropagation(); onClick(); }} onKeyDown={onKeyDown}
      data-testid={`marker-${p.playerId}`}>
      {inner}
    </button>
  );
}

export function Chip({ snap, status, issue, selected, editable, onPointerDown, onClick, testId, placedLabel }: {
  snap?: Snap; status: LineupPerson["status"]; issue?: string; selected: boolean; editable: boolean;
  onPointerDown: (e: ReactPointerEvent) => void; onClick: (e: ReactMouseEvent) => void; testId: string; placedLabel?: string;
}) {
  const maybe = status === "maybe";
  return (
    <button type="button" disabled={!editable} onPointerDown={(e) => { if (e.pointerType !== "touch") onPointerDown(e); }} onClick={onClick} aria-pressed={selected}
      className={cn("touch-pan-y inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 min-h-10 text-sm transition-all text-left",
        maybe ? "border-dashed border-amber-400 bg-amber-50" : "border-border bg-white",
        issue && "border-destructive bg-destructive/5",
        selected && "ring-2 ring-[hsl(75_90%_50%)] border-transparent bg-[hsl(75_90%_92%)] -translate-y-0.5 shadow",
        placedLabel && "opacity-60",
        editable ? "active:scale-95" : "cursor-default")}
      data-testid={testId}>
      {/* Touch drag handle: touch-none so vertical drags are not taken by page scroll; rest of the chip still scrolls and taps. */}
      <span onPointerDown={(e) => { if (e.pointerType === "touch") onPointerDown(e); }}
        title={editable ? "Drag to place" : undefined}
        className={cn("w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-mono text-xs font-bold", editable && "touch-none cursor-grab ring-2 ring-offset-1 ring-primary/20", maybe ? "bg-amber-400 text-amber-950" : "bg-primary text-primary-foreground")}>{snap?.shirtNumber ?? "–"}</span>
      <span className="min-w-0">
        <span className="block font-medium leading-tight">{snap?.name ?? "Unknown player"}</span>
        <span className="block text-[10px] text-muted-foreground leading-tight">{issue ?? (placedLabel ?? (snap?.position || "No position"))}{maybe && !issue ? " · Maybe" : ""}</span>
      </span>
    </button>
  );
}

export function PoolGroup({ title, tone, people, placedMap, selected, canEdit, issues, onSelect, onDrag }: {
  title: string; tone?: "maybe"; people: LineupPerson[]; placedMap: Map<number, LineupPlacement>; selected: number | null; canEdit: boolean;
  issues: Map<number, string>; onSelect: (id: number) => void; onDrag: (e: ReactPointerEvent, id: number) => void;
}) {
  if (!people.length) return null;
  return (
    <div className="mt-3">
      <h3 className={cn("text-[11px] font-bold uppercase tracking-[0.16em] mb-1.5", tone === "maybe" ? "text-amber-700" : "text-emerald-700")}>{title} · {people.length}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {people.map((p) => {
          const placed = placedMap.get(p.playerId);
          return (
            <li key={p.playerId}>
              <Chip snap={p} status={p.status} issue={issues.get(p.playerId)} selected={selected === p.playerId} editable={canEdit}
                placedLabel={placed ? (placed.area === "pitch" ? "On pitch" : "On bench") : undefined}
                onPointerDown={(e) => onDrag(e, p.playerId)} onClick={() => onSelect(p.playerId)} testId={`chip-pool-${p.playerId}`} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
