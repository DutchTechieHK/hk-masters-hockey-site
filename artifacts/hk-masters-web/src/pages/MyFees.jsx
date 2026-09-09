import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { API_BASE } from "../utils/api";
import { getPlayerToken, fetchMe } from "../lib/playerAuth";

function formatHkd(n) {
  if (n == null) return "—";
  return `HK$${Number(n).toFixed(2)}`;
}

function formatEur(n) {
  if (n == null) return "—";
  return `€${Number(n).toFixed(2)}`;
}

function formatDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function MyFees() {
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) { setLocation("/login"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [me, feesRes] = await Promise.all([
          fetchMe(),
          fetch(`${API_BASE}/api/player-auth/my-fees`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (cancelled) return;
        if (!me) { setLocation("/login"); return; }
        if (!feesRes.ok) throw new Error("Could not load your fees.");
        const fees = await feesRes.json();
        setPlayer(me);
        setData(fees);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load your fees.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">Loading your fees…</p>
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

  const { seasonName, amountDue, amountPaid, balance, feePaid, payments, archive } = data;
  const hasInfo = amountDue != null || amountPaid > 0;

  return (
    <div className="min-h-[80vh] bg-gray-50 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-green-700 hover:underline">← Back to dashboard</Link>
           <h1 className="mt-2 text-3xl font-bold text-gray-900">{seasonName} fees</h1>
          {player?.teamName && <p className="mt-1 text-sm text-gray-600">{player.name} · {player.teamName}</p>}
        </div>

        {!hasInfo ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-3xl mb-2">💳</p>
            <p className="text-gray-700 font-medium">Your fee details haven't been set up yet.</p>
             <p className="mt-2 text-sm text-gray-500">A team admin will add your 2026/27 membership fee shortly.</p>
          </div>
        ) : (
          <div className={`rounded-2xl shadow-sm border p-6 sm:p-8 ${
            feePaid
              ? "bg-emerald-50 border-emerald-200"
              : balance && balance > 0
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-gray-100"
          }`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {feePaid ? "Fully paid" : balance != null && balance > 0 ? "Outstanding balance" : "Amount paid so far"}
                </p>
                <p className={`mt-1 text-4xl font-bold ${
                  feePaid ? "text-emerald-700" : balance && balance > 0 ? "text-amber-800" : "text-gray-900"
                }`}>
                   {feePaid ? formatHkd(amountDue ?? amountPaid) : formatHkd(balance ?? amountPaid)}
                </p>
                {feePaid && <p className="mt-2 text-sm text-emerald-700">Thanks — you're all square. ✅</p>}
              </div>
              <div className="text-right text-sm text-gray-700 space-y-1">
                {amountDue != null && (
                   <p><span className="text-gray-500">Total due:</span> <span className="font-semibold">{formatHkd(amountDue)}</span></p>
                )}
                 <p><span className="text-gray-500">Paid:</span> <span className="font-semibold">{formatHkd(amountPaid)}</span></p>
                {balance != null && (
                   <p><span className="text-gray-500">Balance:</span> <span className="font-semibold">{formatHkd(balance)}</span></p>
                )}
              </div>
            </div>
            {!feePaid && balance != null && balance > 0 && (
              <p className="mt-4 text-sm text-amber-900 bg-amber-100/60 rounded-lg p-3">
                Please arrange payment with the team treasurer. Online payment isn't available in the app — talk to your team admin for bank details.
              </p>
            )}
          </div>
        )}

        <div className="mt-8">
           <h2 className="text-lg font-semibold text-gray-900 mb-3">{seasonName} payment history</h2>
          {payments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-sm text-gray-500 text-center">
              No payments recorded yet.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Date</th>
                    <th className="text-right px-4 py-2 font-semibold">Amount</th>
                    <th className="text-left px-4 py-2 font-semibold">Method</th>
                    <th className="text-left px-4 py-2 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-gray-700">{formatDate(p.paymentDate)}</td>
                       <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatHkd(p.amount)}</td>
                      <td className="px-4 py-3 text-gray-600">{p.method || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-semibold text-gray-900">{archive.seasonName} archive</h2>
          <p className="mt-1 text-sm text-gray-500">These archived tournament payments do not count toward your 2026/27 membership balance.</p>
          <div className="mt-3 grid grid-cols-3 gap-3 rounded-xl border border-gray-100 bg-white p-4 text-sm">
            <div><span className="block text-gray-500">Due</span><strong>{formatEur(archive.amountDue)}</strong></div>
            <div><span className="block text-gray-500">Paid</span><strong>{formatEur(archive.amountPaid)}</strong></div>
            <div><span className="block text-gray-500">Balance</span><strong>{formatEur(archive.balance)}</strong></div>
          </div>
          <div className="mt-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
            {archive.payments.length === 0 ? (
              <p className="p-6 text-sm text-gray-500 text-center">No archived Rotterdam payments recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Date</th>
                    <th className="text-right px-4 py-2 font-semibold">Amount</th>
                    <th className="text-left px-4 py-2 font-semibold">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {archive.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 text-gray-700">{formatDate(payment.paymentDate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatEur(payment.amount)}</td>
                      <td className="px-4 py-3 text-gray-600">{payment.method || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
