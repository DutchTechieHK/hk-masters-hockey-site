import { useState, useEffect } from "react";
import { API_BASE } from "../utils/api";

const FUNDRAISING_GOAL = 200000;

function formatHKD(amount) {
  if (amount >= 1000) {
    const k = amount / 1000;
    return `HK$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `HK$${amount.toLocaleString("en-HK")}`;
}

export default function FundraisingThermometer({ goal = FUNDRAISING_GOAL }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/fundraising/summary`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const totalPledged = summary?.totalPledged ?? 0;
  const totalReceived = summary?.totalReceived ?? 0;
  const percentage = Math.min(100, Math.round((totalPledged / goal) * 100));
  const receivedPercentage = Math.min(100, Math.round((totalReceived / goal) * 100));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 text-lg">Fundraising Progress</h3>
        {!loading && !error && (
          <span className="text-sm font-semibold text-[#006B3C]">{percentage}% to goal</span>
        )}
      </div>

      {loading ? (
        <div className="h-8 bg-gray-100 rounded-full animate-pulse my-4" />
      ) : error ? (
        <p className="text-sm text-gray-400 my-4">Unable to load fundraising data.</p>
      ) : (
        <>
          <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden my-4">
            {receivedPercentage > 0 && (
              <div
                className="absolute inset-y-0 left-0 bg-[#006B3C] rounded-full transition-all duration-700"
                style={{ width: `${receivedPercentage}%` }}
              />
            )}
            {percentage > receivedPercentage && (
              <div
                className="absolute inset-y-0 left-0 bg-[#006B3C]/30 rounded-full transition-all duration-700"
                style={{ width: `${percentage}%` }}
              />
            )}
            {percentage > 0 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
                {percentage}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-extrabold text-[#006B3C]">{formatHKD(totalPledged)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total pledged</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-gray-700">{formatHKD(totalReceived)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Received</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-gray-400">{formatHKD(goal)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Goal</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-[#006B3C]" />
              Received
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-[#006B3C]/30" />
              Pledged
            </span>
          </div>
        </>
      )}
    </div>
  );
}
