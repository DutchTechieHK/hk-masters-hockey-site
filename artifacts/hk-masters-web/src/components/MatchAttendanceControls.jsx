import { useState } from "react";

const OPTIONS = [
  { key: "yes", label: "Going", emoji: "✅", on: "bg-emerald-600 text-white border-emerald-600", off: "text-emerald-700 border-emerald-300 hover:bg-emerald-50" },
  { key: "maybe", label: "Maybe", emoji: "🤔", on: "bg-amber-500 text-white border-amber-500", off: "text-amber-700 border-amber-300 hover:bg-amber-50" },
  { key: "no", label: "Not going", emoji: "❌", on: "bg-rose-600 text-white border-rose-600", off: "text-rose-700 border-rose-300 hover:bg-rose-50" },
];

export default function MatchAttendanceControls({ attendance, saving, error, onSubmit }) {
  const [reasonStatus, setReasonStatus] = useState(null);
  const [note, setNote] = useState("");

  async function submit(status, reason = null) {
    const saved = await onSubmit(status, reason);
    if (saved) setReasonStatus(null);
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-700 mb-2">Can you play?</p>
      <div className="flex gap-2 flex-wrap">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={saving}
            aria-pressed={attendance.myRsvp === option.key}
            onClick={() => {
              if (option.key === "yes") {
                setReasonStatus(null);
                void submit("yes");
              } else {
                setNote(attendance.myRsvp === option.key ? attendance.myNote ?? "" : "");
                setReasonStatus(option.key);
              }
            }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition disabled:opacity-50 ${
              attendance.myRsvp === option.key ? option.on : `bg-white ${option.off}`
            }`}
          >
            {option.emoji} {option.label}
          </button>
        ))}
      </div>
      {reasonStatus && (
        <div className="mt-3">
          <label htmlFor={`match-reason-${attendance.matchId}`} className="block text-xs font-semibold text-gray-700 mb-1">
            Reason required
          </label>
          <textarea
            id={`match-reason-${attendance.matchId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={reasonStatus === "maybe" ? "Please tell us why you are unsure" : "Please tell us why you can't attend"}
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none"
          />
          <div className="flex items-center gap-3 mt-2">
            <button type="button" disabled={saving || !note.trim()} onClick={() => void submit(reasonStatus, note.trim())}
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-[#006B3C] text-white disabled:opacity-50">
              Confirm {reasonStatus === "maybe" ? "Maybe" : "Not going"}
            </button>
            <button type="button" className="text-xs text-gray-500" onClick={() => setReasonStatus(null)}>Cancel</button>
          </div>
        </div>
      )}
      {!reasonStatus && attendance.myNote && (
        <p className="mt-2 text-xs text-gray-600">
          Your reason: {attendance.myNote}{" "}
          <button type="button" className="underline" onClick={() => { setNote(attendance.myNote); setReasonStatus(attendance.myRsvp); }}>Edit</button>
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        {attendance.rsvpCounts?.yes ?? 0} going · {attendance.rsvpCounts?.maybe ?? 0} maybe · {attendance.rsvpCounts?.no ?? 0} no
      </p>
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}