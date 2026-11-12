import React, { type ReactNode } from "react";
import { ArrowUp } from "lucide-react";

/** Shared desktop rows; natural pitch/bench/roster order on phones. */
export function LineupBoardLayout({ pitch, count, bench, available, publication, published = false }: {
  pitch: ReactNode;
  count: ReactNode;
  bench: ReactNode;
  available: ReactNode;
  publication?: ReactNode;
  published?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-[380px_minmax(0,1fr)]" data-testid="lineup-panel-grid">
      <p className="flex max-w-[380px] w-full mx-auto items-center justify-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground lg:col-start-1 lg:row-start-1">
        <ArrowUp className="w-3 h-3" />Attacking
      </p>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2" data-testid="layout-pitch">{pitch}</div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-3">{count}</div>
      <div className="min-w-0 [&>section]:h-full lg:col-start-1 lg:row-start-4" data-testid="layout-bench">{bench}</div>
      <div
        className={`min-w-0 rounded-2xl lg:col-start-2 lg:row-start-2 ${published ? "self-start" : "lg:[contain:size] lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:focus-visible:outline-2 lg:focus-visible:outline-primary lg:outline-offset-2 [&>section]:min-h-full"}`}
        role="region" aria-label={published ? "Published lineup information" : "Available players"}
        tabIndex={published ? undefined : 0}
        data-testid="layout-available"
      >{available}</div>
      {publication && <div className="min-w-0 [&>section]:h-full lg:col-start-2 lg:row-start-4" data-testid="layout-publication">{publication}</div>}
    </div>
  );
}
