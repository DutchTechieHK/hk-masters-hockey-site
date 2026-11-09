import React, { useId, useState } from "react";

export function MatchGoingList({ attendance, loading, error, onRefresh, kind = "match" }) {
  return (
    <>
      <p className="mb-2 text-xs text-gray-600">{kind === "training" ? "Players marked Going or Maybe to training — not a confirmed attendance register." : "Players marked Going or Maybe — not a confirmed lineup."}</p>
      {loading ? <p role="status" className="text-sm text-gray-600">Loading who’s going…</p> : error ? (
        <div role="alert" className="text-sm text-rose-700">
          <p>{error}</p>
          <button type="button" className="mt-1 min-h-10 font-semibold underline" onClick={() => void onRefresh()}>Retry</button>
        </div>
      ) : (
        <div className="space-y-3">
          {[
            { label: "Going", players: attendance.goingPlayers, status: "going", empty: "No players have signed on yet." },
            { label: "Maybe", players: attendance.maybePlayers, status: "maybe", empty: "No players have replied Maybe." },
          ].map(({ label, players, status, empty }) => (
            <section key={status}>
              <h4 className="mb-1 text-sm font-semibold text-gray-800">{label} ({players.length})</h4>
              {players.length ? (
                <ul aria-label={`Players ${status} to this ${kind}`} className="grid gap-1 sm:grid-cols-2">
                  {players.map((player) => (
                    <li key={player.id} className="min-w-0 break-words rounded-lg bg-white px-3 py-2 text-sm text-gray-800">{player.name}</li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-600">{empty}</p>}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export default function MatchAttendanceSummary({ attendance, loading, error, onRefresh, kind = "match" }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const current = !loading && !error;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-500" role="status">
          {loading ? "Updating attendance…" : error ? "Attendance unavailable" : (
            <>{attendance.rsvpCounts.yes} going · {attendance.rsvpCounts.maybe} maybe · {attendance.rsvpCounts.no} no</>
          )}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(!open);
            if (!open) void onRefresh();
          }}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#006B3C] hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Who’s going{current ? ` (${attendance.rsvpCounts.yes})` : ""} · Maybe{current ? ` (${attendance.rsvpCounts.maybe})` : ""}
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      </div>
      {open && (
        <div id={panelId} className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3" aria-busy={loading}>
          <MatchGoingList attendance={attendance} loading={loading} error={error} onRefresh={onRefresh} kind={kind} />
        </div>
      )}
      {!open && error && (
        <p role="alert" className="mt-1 text-xs text-rose-700">
          {error} <button type="button" className="min-h-10 font-semibold underline" onClick={() => void onRefresh()}>Retry</button>
        </p>
      )}
    </div>
  );
}
