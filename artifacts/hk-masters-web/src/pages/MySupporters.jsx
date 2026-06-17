import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { API_BASE } from "../utils/api";
import { getPlayerToken, fetchMe } from "../lib/playerAuth";

function formatHKD(n) {
  if (n == null) return "—";
  return `HK$${Number(n).toLocaleString()}`;
}

function formatDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatMethod(m) {
  if (!m) return "—";
  return m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_STYLES = {
  received:  "bg-emerald-100 text-emerald-800",
  confirmed: "bg-blue-100 text-blue-800",
  pending:   "bg-amber-100 text-amber-800",
};

export default function MySupporters() {
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState(null);
  const [supporters, setSupporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) { setLocation("/login"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [me, res] = await Promise.all([
          fetchMe(),
          fetch(`${API_BASE}/api/player-auth/my-supporters`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (cancelled) return;
        if (!me) { setLocation("/login"); return; }
        if (!res.ok) throw new Error("Could not load your supporters.");
        const data = await res.json();
        setPlayer(me);
        setSupporters(data.supporters || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load your supporters.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">Loading your supporters…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-green-700 underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const totalPledged  = supporters.reduce((s, d) => s + (d.amountPledged  || 0), 0);
  const totalReceived = supporters.reduce((s, d) => s + (d.amountReceived || 0), 0);

  return (
    <div className="min-h-[80vh] bg-gray-50 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">

        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-green-700 hover:underline">← Back to dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">My supporters</h1>
          {player?.teamName && (
            <p className="mt-1 text-sm text-gray-600">{player.name} · {player.teamName}</p>
          )}
        </div>

        {supporters.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <p className="text-4xl mb-3">🤝</p>
            <p className="text-gray-700 font-medium text-lg">No supporters yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Share your fundraising page and encourage friends and family to pledge — they'll appear here once logged.
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Total pledged</p>
                <p className="text-3xl font-bold text-gray-900">{formatHKD(totalPledged)}</p>
                <p className="mt-1 text-xs text-gray-400">{supporters.length} supporter{supporters.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Received</p>
                <p className="text-3xl font-bold text-emerald-700">{formatHKD(totalReceived)}</p>
                <p className="mt-1 text-xs text-gray-400">confirmed payments</p>
              </div>
            </div>

            {/* Supporter table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Supporter</th>
                    <th className="text-right px-4 py-3 font-semibold">Pledged</th>
                    <th className="text-right px-4 py-3 font-semibold">Received</th>
                    <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Method</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {supporters.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{d.donorName}</span>
                        {d.notes && (
                          <span className="block text-xs text-gray-400 mt-0.5">{d.notes}</span>
                        )}
                        <span className="block text-xs text-gray-400 sm:hidden">{formatMethod(d.paymentMethod)}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                        {formatHKD(d.amountPledged)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                        {d.amountReceived > 0 ? formatHKD(d.amountReceived) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {formatMethod(d.paymentMethod)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[d.status] || STATUS_STYLES.pending}`}>
                          {d.status === "received" ? "Received ✓" : d.status === "confirmed" ? "Confirmed" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">{formatHKD(totalPledged)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">{formatHKD(totalReceived)}</td>
                    <td className="hidden sm:table-cell" />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="mt-4 text-xs text-gray-400 text-center">
              Amounts shown in HKD. Payment confirmation is handled by the team admin.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
