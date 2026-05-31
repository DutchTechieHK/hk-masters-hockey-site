import { useEffect, useState } from "react";
import { API_BASE } from "../utils/api";

const PAYMENT_METHODS = [
  {
    id: "payme",
    label: "PayMe",
    sublabel: "HK app",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "wise",
    label: "Wise",
    sublabel: "International",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "bank_transfer",
    label: "Bank Transfer",
    sublabel: "Citibank HK",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
  },
];

function PaymentPanel({ method, guesserName }) {
  if (method === "payme") {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <p className="text-sm font-bold text-gray-900 mb-1">Pay via PayMe</p>
        <p className="text-xs text-gray-500 mb-4">
          Open the PayMe app and scan the QR code to send your <span className="font-semibold text-gray-700">HK$50</span> guess fee.
        </p>
        <img src="/payme-qr.jpg" alt="PayMe QR code" className="w-52 h-52 object-contain mx-auto rounded-xl" />
      </div>
    );
  }
  if (method === "wise") {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <p className="text-sm font-bold text-gray-900 mb-1">Pay via Wise</p>
        <p className="text-xs text-gray-500 mb-4">
          Scan the QR code in the Wise app to send <span className="font-semibold text-gray-700">HK$50</span>.
          Use your name as the reference.
        </p>
        <img src="/wise-qr.png" alt="Wise QR code" className="w-52 h-52 object-contain mx-auto rounded-xl" />
        <p className="text-xs text-gray-400 mt-4">Reference: <span className="font-semibold text-gray-600">{guesserName}</span></p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <p className="text-sm font-bold text-gray-900 mb-1 text-center">Bank Transfer Details</p>
      <p className="text-xs text-gray-500 mb-5 text-center">
        Transfer <span className="font-semibold text-gray-700">HK$50</span> to the account below.
      </p>
      <div className="space-y-2.5">
        {[
          ["Bank", "Citibank Hong Kong"],
          ["Account Name", "Rene Theil"],
          ["Bank Code", "250"],
          ["Branch Code", "390"],
          ["Account Number", "0046103724"],
          ["SWIFT / BIC", "CITIHKAXXXX"],
          ["Reference", "Hong Kong Masters Hockey"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
            <span className="text-xs font-semibold text-gray-500">{label}</span>
            <span className={`text-sm font-mono ${label === "Reference" ? "font-semibold text-[#1E3A6E]" : "text-gray-800"}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function useLegoJarStats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/lego-jar/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d))
      .catch(() => setError(true));
  }, []);

  return { stats, error };
}

export default function LegoJarSection() {
  const { stats, error } = useLegoJarStats();

  const [form, setForm] = useState({
    guesserName: "",
    guesserEmail: "",
    guessNumber: "",
    paymentMethod: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);

  const pricePerGuess = stats?.config?.pricePerGuess ?? 50;
  const totalGuesses = stats?.totalGuesses ?? 0;
  const totalRaised = stats?.totalRaised ?? 0;
  const currentRound = stats?.currentRound ?? null;
  const rounds = stats?.rounds ?? [];
  const pastRounds = rounds.filter((r) => r.endedAt !== null);
  const jarImageUrl = stats?.config?.imageUrl ?? null;

  function validate() {
    const errs = {};
    if (!form.guesserName.trim()) errs.guesserName = "Your name is required";
    if (form.guesserEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guesserEmail.trim())) {
      errs.guesserEmail = "Enter a valid email address";
    }
    const num = parseInt(form.guessNumber, 10);
    if (!form.guessNumber) errs.guessNumber = "Enter your guess";
    else if (isNaN(num) || num < 1) errs.guessNumber = "Enter a number greater than 0";
    if (!form.paymentMethod) errs.paymentMethod = "Please choose a payment method";
    return errs;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((err) => ({ ...err, [name]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch(`${API_BASE}/api/lego-jar/guesses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guesserName: form.guesserName.trim(),
          guesserEmail: form.guesserEmail.trim() || undefined,
          guessNumber: parseInt(form.guessNumber, 10),
          paymentMethod: form.paymentMethod,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Something went wrong. Please try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return null;

  return (
    <section className="py-16 bg-[#1E3A6E]/5 border-y border-[#1E3A6E]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-10">
          <span className="inline-block bg-[#1E3A6E] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Fundraiser
          </span>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3">🧱 LEGO Jar Challenge</h2>
          <p className="text-gray-600 max-w-2xl leading-relaxed">
            How many LEGO bricks are in the jar? Guess the exact number for{" "}
            <span className="font-semibold text-[#1E3A6E]">HK${Number(pricePerGuess).toLocaleString()}</span> — the closest guess wins!
            The jar travels with the team raising funds for Rotterdam 2026.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: Stats + jar info */}
          <div className="space-y-6">
            {/* Stats pills */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Guesses sold", value: totalGuesses.toLocaleString() },
                { label: "Raised so far", value: `HK$${totalRaised.toLocaleString()}` },
                { label: "Per guess", value: `HK$${Number(pricePerGuess).toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-xl font-extrabold text-[#1E3A6E] leading-tight">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Current holder + optional jar photo */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">The jar right now</p>
              <div className="flex items-start gap-4">
                {jarImageUrl ? (
                  <img
                    src={jarImageUrl}
                    alt="The LEGO jar"
                    className="w-20 h-20 object-cover rounded-xl border border-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 bg-[#1E3A6E]/8 rounded-xl flex items-center justify-center text-4xl shrink-0">
                    🧱
                  </div>
                )}
                <div className="flex-1">
                  {currentRound ? (
                    <>
                      <p className="font-bold text-gray-900 text-lg leading-tight">{currentRound.holderName}</p>
                      {currentRound.location && (
                        <p className="text-xs text-gray-500 mt-0.5">{currentRound.location}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        Get your guess in — the jar moves around to team events and social gatherings.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 leading-relaxed">
                      The jar is warming up! Check back soon to find out who has it next.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-3">How it works</h3>
              <ul className="space-y-3">
                {[
                  ["Submit your guess", "Pick a number you think is closest to the actual count and pay HK$50 per guess."],
                  ["The jar travels", "The LEGO jar circulates through team events, training sessions, and social gatherings."],
                  ["Closest guess wins", "Once the challenge ends, the player whose guess is nearest to the true count is crowned the winner!"],
                ].map(([title, body]) => (
                  <li key={title} className="flex gap-3">
                    <div className="w-2 h-2 bg-[#1E3A6E] rounded-full mt-2 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{title}</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Round history table */}
            {pastRounds.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm">Jar journey so far</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-semibold">Holder</th>
                      <th className="px-5 py-2.5 text-left font-semibold">Location</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Guesses</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Raised</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pastRounds.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3 font-medium text-gray-900">{r.holderName}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{r.location ?? "—"}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-700">{r.guessCount}</td>
                        <td className="px-5 py-3 text-right font-bold text-[#1E3A6E]">HK${r.amountRaised.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Form or success */}
          <div>
            {submitted ? (
              <div className="space-y-5">
                <div className="bg-[#1E3A6E]/5 border border-[#1E3A6E]/20 rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-[#1E3A6E] rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Guess submitted! 🧱</h3>
                  <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                    Your guess of <span className="font-bold text-[#1E3A6E]">{Number(form.guessNumber).toLocaleString()}</span> is in. Good luck!
                  </p>
                </div>
                <PaymentPanel method={form.paymentMethod} guesserName={form.guesserName.trim()} />
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <h3 className="text-xl font-bold text-gray-900">Enter your guess</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="lj-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Your name <span className="text-[#DE2910]">*</span>
                    </label>
                    <input
                      id="lj-name"
                      name="guesserName"
                      type="text"
                      autoComplete="name"
                      value={form.guesserName}
                      onChange={handleChange}
                      placeholder="Jane Smith"
                      className={`w-full px-4 py-3 rounded-xl border-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A6E]/20 focus:border-[#1E3A6E]/40 transition-colors ${
                        errors.guesserName ? "border-red-400 bg-red-50" : "border-gray-300"
                      }`}
                    />
                    {errors.guesserName && <p className="text-xs text-red-600 mt-1">{errors.guesserName}</p>}
                  </div>

                  <div>
                    <label htmlFor="lj-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Email <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      id="lj-email"
                      name="guesserEmail"
                      type="email"
                      autoComplete="email"
                      value={form.guesserEmail}
                      onChange={handleChange}
                      placeholder="jane@example.com"
                      className={`w-full px-4 py-3 rounded-xl border-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A6E]/20 focus:border-[#1E3A6E]/40 transition-colors ${
                        errors.guesserEmail ? "border-red-400 bg-red-50" : "border-gray-300"
                      }`}
                    />
                    {errors.guesserEmail && <p className="text-xs text-red-600 mt-1">{errors.guesserEmail}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="lj-guess" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Your guess — how many LEGO bricks? <span className="text-[#DE2910]">*</span>
                  </label>
                  <input
                    id="lj-guess"
                    name="guessNumber"
                    type="number"
                    min="1"
                    value={form.guessNumber}
                    onChange={handleChange}
                    placeholder="e.g. 342"
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A6E]/20 focus:border-[#1E3A6E]/40 transition-colors ${
                      errors.guessNumber ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                  />
                  {errors.guessNumber && <p className="text-xs text-red-600 mt-1">{errors.guessNumber}</p>}
                </div>

                <div>
                  <p className="block text-sm font-semibold text-gray-700 mb-2">
                    How will you pay the HK${Number(pricePerGuess).toLocaleString()} fee? <span className="text-[#DE2910]">*</span>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, paymentMethod: pm.id }));
                          if (errors.paymentMethod) setErrors((err) => ({ ...err, paymentMethod: undefined }));
                        }}
                        className={`flex flex-col items-center gap-2 px-2 py-4 rounded-xl border-2 text-xs font-semibold transition-all text-center cursor-pointer shadow-sm ${
                          form.paymentMethod === pm.id
                            ? "border-[#1E3A6E] bg-[#1E3A6E]/8 text-[#1E3A6E] shadow-[#1E3A6E]/10"
                            : "border-gray-300 text-gray-600 hover:border-[#1E3A6E]/40 hover:bg-[#1E3A6E]/4 bg-white"
                        }`}
                      >
                        <span className={form.paymentMethod === pm.id ? "text-[#1E3A6E]" : "text-gray-400"}>{pm.icon}</span>
                        <span className="leading-tight">{pm.label}</span>
                        <span className={`text-[10px] font-normal ${form.paymentMethod === pm.id ? "text-[#1E3A6E]/60" : "text-gray-400"}`}>{pm.sublabel}</span>
                        {form.paymentMethod === pm.id && <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A6E]" />}
                      </button>
                    ))}
                  </div>
                  {errors.paymentMethod && <p className="text-xs text-red-600 mt-1">{errors.paymentMethod}</p>}
                </div>

                {serverError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{serverError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#1E3A6E] text-white font-bold text-sm py-3.5 rounded-xl hover:bg-[#162d56] disabled:opacity-60 transition-colors shadow-sm"
                >
                  {submitting ? "Submitting…" : `Submit guess · HK$${Number(pricePerGuess).toLocaleString()}`}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
