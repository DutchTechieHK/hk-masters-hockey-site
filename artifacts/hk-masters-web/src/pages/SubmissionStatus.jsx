import { useState } from "react";
import { format, parseISO } from "date-fns";
import { API_BASE } from "../utils/api";

const STATUS_CONFIG = {
  pending: {
    label: "Under review",
    description: "Your submission is being reviewed by the admin team.",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
    icon: (
      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  approved: {
    label: "Approved",
    description: "Your submission has been approved and published to the Journal.",
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-800",
    icon: (
      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  declined: {
    label: "Not accepted",
    description: "Your submission was not accepted for publication.",
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-800",
    icon: (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
};

const CONTENT_TYPE_LABEL = {
  article: "Article",
  photo: "Photos",
  both: "Article + Photos",
};

function SubmissionCard({ submission }) {
  const config = STATUS_CONFIG[submission.status] || STATUS_CONFIG.pending;

  return (
    <div className={`rounded-2xl border ${config.border} ${config.bg} p-6`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1 truncate">
            {submission.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1 bg-white/70 border border-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
              {CONTENT_TYPE_LABEL[submission.contentType] || submission.contentType}
            </span>
            <span>Submitted {format(parseISO(submission.createdAt), "d MMM yyyy")}</span>
            {submission.reviewedAt && (
              <span>· Reviewed {format(parseISO(submission.reviewedAt), "d MMM yyyy")}</span>
            )}
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${config.badge}`}>
          {config.icon}
          {config.label}
        </span>
      </div>

      <p className="mt-3 text-sm text-gray-600">{config.description}</p>

      {submission.adminNote && (
        <div className="mt-4 p-4 bg-white/60 border border-gray-200 rounded-xl">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Note from the team</p>
          <p className="text-sm text-gray-700 leading-relaxed">{submission.adminNote}</p>
        </div>
      )}

      {submission.status === "approved" && (
        <div className="mt-4">
          <a
            href={`${import.meta.env.BASE_URL}journal/${submission.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#006B3C] hover:text-green-800 transition-colors"
          >
            View in Journal &rarr;
          </a>
        </div>
      )}
    </div>
  );
}

export default function SubmissionStatus() {
  const [email, setEmail] = useState("");
  const [submissions, setSubmissions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setSubmissions(null);
    setSearched(false);

    try {
      const res = await fetch(`${API_BASE}/api/contributions/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        throw new Error("Something went wrong. Please try again.");
      }
      const data = await res.json();
      setSubmissions(data);
      setSearched(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#006B3C]/10 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-[#006B3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Check your submission</h1>
          <p className="text-gray-500 text-base max-w-md mx-auto">
            Enter the email address you used when submitting to see the status of your contribution.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Your email address
          </label>
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C] transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="bg-[#006B3C] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {loading ? "Checking…" : "Check"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </form>

        {searched && submissions !== null && (
          <div>
            {submissions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-700 font-semibold mb-1">No submissions found</p>
                <p className="text-sm text-gray-500">
                  We couldn't find any submissions for that email address. Make sure you're using the same email you submitted with.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 px-1">
                  {submissions.length === 1
                    ? "Found 1 submission"
                    : `Found ${submissions.length} submissions`}
                </p>
                {submissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
