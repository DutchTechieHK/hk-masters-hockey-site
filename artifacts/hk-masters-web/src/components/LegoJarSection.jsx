import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../utils/api";

function LegoBrickIcon({ className = "w-7 h-7" }) {
  return (
    <svg className={className} viewBox="0 0 32 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="8" width="32" height="14" rx="2" fill="#E3000B" />
      <rect x="0" y="18" width="32" height="4" rx="1" fill="#B20009" />
      <rect x="4" y="3" width="6" height="7" rx="3" fill="#E3000B" />
      <rect x="4" y="3" width="6" height="7" rx="3" fill="#C20008" opacity="0.5" />
      <rect x="13" y="3" width="6" height="7" rx="3" fill="#E3000B" />
      <rect x="13" y="3" width="6" height="7" rx="3" fill="#C20008" opacity="0.5" />
      <rect x="22" y="3" width="6" height="7" rx="3" fill="#E3000B" />
      <rect x="22" y="3" width="6" height="7" rx="3" fill="#C20008" opacity="0.5" />
      <rect x="4" y="3" width="6" height="3" rx="2" fill="#FF3333" opacity="0.4" />
      <rect x="13" y="3" width="6" height="3" rx="2" fill="#FF3333" opacity="0.4" />
      <rect x="22" y="3" width="6" height="3" rx="2" fill="#FF3333" opacity="0.4" />
      <rect x="0" y="8" width="32" height="2.5" rx="0" fill="#FF3333" opacity="0.18" />
    </svg>
  );
}

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

function PaymentPanel({ method, guesserName, totalAmount }) {
  const amtLabel = `HK$${Number(totalAmount ?? 50).toLocaleString()}`;
  if (method === "payme") {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <p className="text-sm font-bold text-gray-900 mb-1">Pay via PayMe</p>
        <p className="text-xs text-gray-500 mb-4">
          Open the PayMe app and scan the QR code to send your <span className="font-semibold text-gray-700">{amtLabel}</span> guess fee.
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
          Scan the QR code in the Wise app to send <span className="font-semibold text-gray-700">{amtLabel}</span>.
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
        Transfer <span className="font-semibold text-gray-700">{amtLabel}</span> to the account below.
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

const FALLBACK_PRIZES = [
  {
    rank: 1,
    badge: "1st Prize",
    badgeColor: "bg-amber-400 text-amber-900",
    title: "7 Nights in a 4-Bedroom Bali Villa",
    description: "Stay at The Starling Villa in Bali — a stunning 4-bedroom private villa with its own pool, open-plan living areas, and lush tropical gardens. Perfect for a family holiday or a group getaway.",
    imageUrl: "/bali-villa.jpg",
    imageAlt: "The Starling Villa, Bali — private pool and tropical gardens",
  },
  {
    rank: 2,
    badge: "2nd Prize",
    badgeColor: "bg-gray-200 text-gray-700",
    title: "To be announced",
    description: "Watch this space — we're lining up something great for second place.",
    imageUrl: null,
    imageAlt: null,
  },
  {
    rank: 3,
    badge: "3rd Prize",
    badgeColor: "bg-orange-100 text-orange-700",
    title: "To be announced",
    description: "A special prize for the runner-up. Stay tuned!",
    imageUrl: null,
    imageAlt: null,
  },
];

function useLegoJarData() {
  const [stats, setStats] = useState(null);
  const [prizes, setPrizes] = useState(FALLBACK_PRIZES);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/lego-jar/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d))
      .catch(() => setError(true));

    fetch(`${API_BASE}/api/lego-jar/prizes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d) && d.length > 0) setPrizes(d); })
      .catch(() => {});
  }, []);

  return { stats, prizes, error };
}

function PrizesSection({ prizes, onZoom }) {
  const [first, ...rest] = prizes;
  if (!first) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <span className="text-lg">🏆</span>
        <h3 className="font-bold text-gray-900">What you could win</h3>
      </div>

      {/* Hero prize — 1st place */}
      <div className="p-4">
        <div className="relative rounded-xl overflow-hidden border border-gray-100">
          {first.imageUrl && (
            <button
              type="button"
              onClick={() => onZoom(first.imageUrl, first.imageAlt)}
              className="relative group block w-full h-52 focus:outline-none focus:ring-2 focus:ring-[#1E3A6E]/40 cursor-zoom-in"
              aria-label="Expand prize photo"
            >
              <img
                src={first.imageUrl}
                alt={first.imageAlt ?? first.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg className="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zm-6-3v6m-3-3h6" />
                  </svg>
                </span>
              </span>
              <span className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${first.badgeColor} shadow-sm`}>
                {first.badge}
              </span>
            </button>
          )}
          {!first.imageUrl && (
            <div className="px-4 pt-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${first.badgeColor}`}>
                {first.badge}
              </span>
            </div>
          )}

          <div className="p-4">
            <p className="font-bold text-gray-900 text-base leading-snug mb-1">{first.title}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{first.description}</p>
          </div>
        </div>

        {/* 2nd + 3rd prizes side by side */}
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {rest.map((prize) => (
              <div key={prize.rank} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                {prize.imageUrl && (
                  <button
                    type="button"
                    onClick={() => onZoom(prize.imageUrl, prize.imageAlt)}
                    className="block w-full mb-2 rounded-lg overflow-hidden cursor-zoom-in bg-white"
                    aria-label={`Expand ${prize.badge} photo`}
                  >
                    <img src={prize.imageUrl} alt={prize.imageAlt ?? prize.title} className="w-full h-56 object-contain p-2" />
                  </button>
                )}
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold mb-2 ${prize.badgeColor}`}>
                  {prize.badge}
                </span>
                <p className="font-semibold text-gray-800 text-sm leading-snug mb-1">{prize.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{prize.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LegoJarSection() {
  const { stats, prizes, error } = useLegoJarData();

  const [tier, setTier] = useState("1"); // "1" or "3"
  const [form, setForm] = useState({
    guesserName: "",
    guesserEmail: "",
    guesserPhone: "",
    guessNumbers: [""],
    paymentMethod: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Shared lightbox — stores { src, alt } or null when closed
  const [lightbox, setLightbox] = useState(null);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === "Escape") closeLightbox(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox]);

  const pricePerGuess = stats?.config?.pricePerGuess ?? 50;
  const totalGuesses = stats?.totalGuesses ?? 0;
  const totalRaised = stats?.totalRaised ?? 0;
  const currentRound = stats?.currentRound ?? null;
  const rounds = stats?.rounds ?? [];
  const pastRounds = rounds.filter((r) => r.endedAt !== null);
  const jarImageUrl = stats?.config?.imageUrl ?? "/lego-jar.jpg";

  const tierTotal = tier === "3" ? 100 : 50;

  function handleTierChange(newTier) {
    setTier(newTier);
    setForm((f) => ({ ...f, guessNumbers: newTier === "3" ? ["", "", ""] : [""] }));
    if (errors.guessNumbers) setErrors((e) => ({ ...e, guessNumbers: undefined }));
  }

  function handleGuessNumberChange(index, value) {
    setForm((f) => ({ ...f, guessNumbers: f.guessNumbers.map((n, i) => i === index ? value : n) }));
    if (errors.guessNumbers) setErrors((e) => ({ ...e, guessNumbers: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.guesserName.trim()) errs.guesserName = "Your name is required";
    if (!form.guesserEmail.trim()) {
      errs.guesserEmail = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guesserEmail.trim())) {
      errs.guesserEmail = "Enter a valid email address";
    }
    if (!form.guesserPhone.trim()) errs.guesserPhone = "Phone is required";
    const filled = form.guessNumbers.filter((n) => n.trim() !== "");
    if (filled.length === 0) {
      errs.guessNumbers = tier === "3" ? "Enter all 3 guess numbers" : "Enter your guess";
    } else if (tier === "3" && filled.length < 3) {
      errs.guessNumbers = "Fill in all 3 guess numbers";
    } else {
      for (const n of filled) {
        const parsed = parseInt(n, 10);
        if (isNaN(parsed) || parsed < 1) { errs.guessNumbers = "Each guess must be a number greater than 0"; break; }
      }
    }
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
      const parsedNumbers = form.guessNumbers.filter((n) => n.trim()).map((n) => parseInt(n, 10));
      const res = await fetch(`${API_BASE}/api/lego-jar/guesses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guesserName: form.guesserName.trim(),
          guesserEmail: form.guesserEmail.trim(),
          guesserPhone: form.guesserPhone.trim(),
          guessNumbers: parsedNumbers,
          paymentMethod: form.paymentMethod,
          totalAmountPaid: tierTotal,
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
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3 flex items-center gap-3">
            <LegoBrickIcon className="w-10 h-7 shrink-0" /> LEGO Jar Challenge
          </h2>
          <p className="text-gray-600 max-w-2xl leading-relaxed">
            How many LEGO bricks are in the jar? Guess the exact number for{" "}
            <span className="font-semibold text-[#1E3A6E]">HK${Number(pricePerGuess).toLocaleString()}</span> — the closest guess wins!
            The LEGO jar rotates between members of the squad to raise funds for our 2026 World Cup in Rotterdam.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: Stats + jar info */}
          <div className="space-y-6">
            {/* Stats pills */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Guesses sold", value: totalGuesses.toLocaleString() },
                { label: "Raised so far", value: `HK$${Math.round(totalRaised).toLocaleString()}` },
                { label: "Per guess", value: `HK$${Number(pricePerGuess).toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 text-center">
                  <p className="text-sm sm:text-xl font-extrabold text-[#1E3A6E] leading-tight whitespace-nowrap">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Current holder + optional jar photo */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Who has the jar right now</p>
              <div className="flex items-start gap-4">
                {jarImageUrl ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ src: jarImageUrl, alt: "The LEGO jar — enlarged" })}
                    className="relative group w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#1E3A6E]/40"
                    aria-label="Expand jar photo"
                  >
                    <img
                      src={jarImageUrl}
                      alt="The LEGO jar"
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors duration-200">
                      <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zm-6-3v6m-3-3h6" />
                      </svg>
                    </span>
                  </button>
                ) : (
                  <div className="w-20 h-20 bg-[#1E3A6E]/8 rounded-xl flex items-center justify-center shrink-0">
                    <LegoBrickIcon className="w-12 h-9" />
                  </div>
                )}
                <div className="flex-1">
                  {currentRound ? (
                    <>
                      <p className="font-bold text-gray-900 text-lg leading-tight">{currentRound.holderName}</p>
                      {currentRound.company && (
                        <p className="text-sm font-medium text-gray-600 mt-0.5">{currentRound.company}</p>
                      )}
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

            {/* Prizes */}
            <PrizesSection prizes={prizes} onZoom={(src, alt) => setLightbox({ src, alt })} />

            {/* Round history table */}
            {pastRounds.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm">Jar journey so far</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Holder</th>
                      <th className="px-4 py-2.5 text-left font-semibold hidden sm:table-cell">Location</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Guesses</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Raised</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pastRounds.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.holderName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">{r.location ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">{r.guessCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#1E3A6E] whitespace-nowrap">HK${Math.round(r.amountRaised).toLocaleString()}</td>
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
                  <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
                    {tier === "3" ? "3 guesses received!" : "Guess received!"} <LegoBrickIcon className="w-8 h-6" />
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                    {tier === "3" ? (
                      <>Your guesses of <span className="font-bold text-[#1E3A6E]">{form.guessNumbers.filter(Boolean).map((n) => Number(n).toLocaleString()).join(", ")}</span> are saved.</>
                    ) : (
                      <>Your guess of <span className="font-bold text-[#1E3A6E]">{Number(form.guessNumbers[0]).toLocaleString()}</span> is saved.</>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs leading-relaxed max-w-sm mx-auto mt-2">
                    Complete your payment below to confirm your entry — your {tier === "3" ? "guesses" : "guess"} will be counted once we've received it. Good luck!
                  </p>
                </div>
                <PaymentPanel method={form.paymentMethod} guesserName={form.guesserName.trim()} totalAmount={tierTotal} />
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
                      Email <span className="text-[#DE2910]">*</span>
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
                  <label htmlFor="lj-phone" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Phone <span className="text-[#DE2910]">*</span>
                  </label>
                  <input
                    id="lj-phone"
                    name="guesserPhone"
                    type="tel"
                    autoComplete="tel"
                    value={form.guesserPhone}
                    onChange={handleChange}
                    placeholder="+852 XXXX XXXX"
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A6E]/20 focus:border-[#1E3A6E]/40 transition-colors ${
                      errors.guesserPhone ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                  />
                  {errors.guesserPhone && <p className="text-xs text-red-600 mt-1">{errors.guesserPhone}</p>}
                </div>

                {/* Tier selector */}
                <div>
                  <p className="block text-sm font-semibold text-gray-700 mb-2">
                    How many guesses? <span className="text-[#DE2910]">*</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "1", label: "1 guess", price: "HK$50" },
                      { value: "3", label: "3 guesses", price: "HK$100" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleTierChange(opt.value)}
                        className={`flex flex-col items-center gap-0.5 px-4 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all shadow-sm ${
                          tier === opt.value
                            ? "border-[#1E3A6E] bg-[#1E3A6E]/8 text-[#1E3A6E]"
                            : "border-gray-300 text-gray-600 hover:border-[#1E3A6E]/40 bg-white"
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className={`text-xs font-bold ${tier === opt.value ? "text-[#1E3A6E]" : "text-gray-500"}`}>{opt.price}</span>
                        {tier === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A6E] mt-0.5" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Guess number field(s) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {tier === "3" ? "Your 3 guesses — how many LEGO bricks?" : "Your guess — how many LEGO bricks?"}{" "}
                    <span className="text-[#DE2910]">*</span>
                  </label>
                  <div className={tier === "3" ? "grid grid-cols-3 gap-2" : ""}>
                    {form.guessNumbers.map((num, i) => (
                      <div key={i}>
                        {tier === "3" && (
                          <p className="text-xs text-gray-500 mb-1 font-medium">Guess {i + 1}</p>
                        )}
                        <input
                          type="number"
                          min="1"
                          value={num}
                          onChange={(e) => handleGuessNumberChange(i, e.target.value)}
                          placeholder="e.g. 342"
                          className={`w-full px-4 py-3 rounded-xl border-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A6E]/20 focus:border-[#1E3A6E]/40 transition-colors ${
                            errors.guessNumbers ? "border-red-400 bg-red-50" : "border-gray-300"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                  {errors.guessNumbers && <p className="text-xs text-red-600 mt-1">{errors.guessNumbers}</p>}
                </div>

                <div>
                  <p className="block text-sm font-semibold text-gray-700 mb-2">
                    How will you pay the <span className="text-[#1E3A6E]">HK${tierTotal}</span> fee? <span className="text-[#DE2910]">*</span>
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
                  {submitting ? "Submitting…" : `Submit ${tier === "3" ? "3 guesses" : "guess"} · HK$${tierTotal}`}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Shared lightbox overlay — handles both jar photo and villa photo */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Photo enlarged"
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-h-[90vh] max-w-full rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
