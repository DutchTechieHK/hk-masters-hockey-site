import { useEffect, useState } from "react";
import { useParams, useSearch } from "wouter";
import { API_BASE } from "../utils/api";

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full bg-green-600 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function Poll() {
  const { pollId } = useParams();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("t") || "";

  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;
    (async () => {
      try {
        const url = token
          ? `${API_BASE}/api/polls/vote/${pollId}?t=${encodeURIComponent(token)}`
          : `${API_BASE}/api/polls/vote/${pollId}`;
        const res = await fetch(url);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `Failed to load poll (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setPoll(data);
          setVoted(data.hasVoted);
          if (data.hasVoted) {
            setSelected(data.options.filter(o => o.voted).map(o => o.id));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pollId, token]);

  const toggleOption = (id) => {
    if (isClosed) return;
    if (!token) return;
    if (poll?.allowMultiple) {
      setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelected([id]);
    }
  };

  const handleSubmit = async () => {
    if (!token) { setSubmitError("Your personal voting link is required. Please use the link from your email."); return; }
    if (selected.length === 0) { setSubmitError("Please select an option before voting."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API_BASE}/api/polls/vote/${pollId}?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to submit vote");
      setPoll(data);
      setVoted(true);
    } catch (err) {
      setSubmitError(err.message || "Could not submit vote");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">Loading poll…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🗳️</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Poll unavailable</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!poll) return null;

  const isClosed = !!poll.closedAt || (poll.deadline && new Date() > new Date(poll.deadline));
  const totalVotes = poll.options.reduce((sum, o) => sum + (o.voteCount ?? 0), 0);
  const showResults = voted || isClosed;
  const noToken = !token;

  return (
    <div className="min-h-[80vh] bg-gray-50 px-4 py-10">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-br from-[#1E3A6E] to-[#2a4f9a] text-white rounded-2xl p-6 mb-6 shadow">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wide text-blue-200">HK Masters Hockey · Poll</span>
          </div>
          <h1 className="text-2xl font-bold leading-snug">{poll.title}</h1>
          {poll.description && (
            <p className="mt-2 text-blue-100 text-sm leading-relaxed">{poll.description}</p>
          )}
          {poll.deadline && !isClosed && (
            <p className="mt-3 text-xs text-blue-200">
              ⏰ Closes {new Date(poll.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          {isClosed && (
            <span className="mt-3 inline-block text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">Poll closed</span>
          )}
        </div>

        {/* No-token notice */}
        {noToken && !isClosed && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Personal link required.</strong> To vote, please use the link sent to your email — it contains your unique token.
            You can view results below.
          </div>
        )}

        {/* Greeting */}
        {poll.playerName && !voted && !isClosed && (
          <p className="text-gray-700 mb-4 text-sm">
            Hi <strong>{poll.playerName}</strong>! {poll.allowMultiple ? "Select all that apply." : "Pick one option."}
          </p>
        )}
        {voted && poll.playerName && (
          <p className="text-gray-700 mb-4 text-sm">
            Thanks, <strong>{poll.playerName}</strong>! Your vote has been recorded. You can change it by selecting a different option.
          </p>
        )}

        {/* Options */}
        <div className="space-y-3 mb-6">
          {poll.options.map((opt) => {
            const isSelected = selected.includes(opt.id);
            const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
            return (
              <div key={opt.id}>
                <button
                  onClick={() => toggleOption(opt.id)}
                  disabled={isClosed || (!token && !voted)}
                  className={`w-full text-left rounded-xl border-2 px-5 py-4 transition-all focus:outline-none
                    ${isSelected
                      ? "border-[#1E3A6E] bg-[#1E3A6E]/5"
                      : "border-gray-200 bg-white hover:border-[#1E3A6E]/40"
                    }
                    ${(isClosed || (!token && !voted)) ? "cursor-default" : "cursor-pointer"}
                  `}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                        ${isSelected ? "border-[#1E3A6E] bg-[#1E3A6E]" : "border-gray-300"}
                      `}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="font-medium text-gray-900">{opt.label}</span>
                    </div>
                    {showResults && (
                      <span className="text-sm font-semibold text-gray-600 shrink-0">{pct}%</span>
                    )}
                  </div>
                  {showResults && (
                    <div className="mt-3">
                      <ProgressBar value={opt.voteCount} max={totalVotes} />
                      <p className="text-xs text-gray-500 mt-1">{opt.voteCount} vote{opt.voteCount !== 1 ? "s" : ""}</p>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Submit */}
        {!isClosed && !noToken && (
          <div>
            {submitError && (
              <p className="mb-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2">{submitError}</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || selected.length === 0}
              className="w-full py-3 rounded-xl bg-[#1E3A6E] text-white font-semibold text-base hover:bg-[#162d58] transition disabled:opacity-50"
            >
              {submitting ? "Submitting…" : voted ? "Update my vote" : "Submit vote"}
            </button>
          </div>
        )}

        {/* Total */}
        {showResults && (
          <p className="mt-5 text-center text-sm text-gray-500">
            {totalVotes} response{totalVotes !== 1 ? "s" : ""} total
          </p>
        )}

        <div className="mt-8 text-center">
          <a href={`${window.location.origin.includes("replit") ? "" : ""}/`} className="text-sm text-gray-400 hover:text-gray-600">HK Masters Hockey 2026</a>
        </div>
      </div>
    </div>
  );
}
