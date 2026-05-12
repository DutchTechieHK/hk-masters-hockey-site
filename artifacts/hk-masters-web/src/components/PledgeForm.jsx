import { useState, useEffect } from "react";
import { API_BASE } from "../utils/api";

export default function PledgeForm({ onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", amount: "", note: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);

  const [beneficiaryType, setBeneficiaryType] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [squad, setSquad] = useState([]);
  const [squadLoading, setSquadLoading] = useState(false);

  useEffect(() => {
    if (beneficiaryType === "player" && squad.length === 0) {
      setSquadLoading(true);
      fetch(`${API_BASE}/api/public/squad`)
        .then((r) => r.json())
        .then((data) => setSquad(Array.isArray(data) ? data : []))
        .catch(() => setSquad([]))
        .finally(() => setSquadLoading(false));
    }
  }, [beneficiaryType]);

  function getBeneficiaryValue() {
    if (beneficiaryType === "mo40") return "MO40 Team";
    if (beneficiaryType === "mo50") return "MO50 Team";
    if (beneficiaryType === "player" && selectedPlayerId) {
      const player = squad.find((p) => String(p.id) === String(selectedPlayerId));
      return player ? player.name : undefined;
    }
    return undefined;
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email address";
    if (!form.amount) errs.amount = "Amount is required";
    else {
      const num = parseFloat(form.amount);
      if (isNaN(num) || num <= 0) errs.amount = "Enter a valid amount greater than 0";
    }
    if (beneficiaryType === "player" && !selectedPlayerId) {
      errs.player = "Please select a player";
    }
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
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const beneficiary = getBeneficiaryValue();
      const res = await fetch(`${API_BASE}/api/pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          amount: parseFloat(form.amount),
          note: form.note.trim() || undefined,
          beneficiary,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Something went wrong. Please try again.");
      }
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const mo40Players = squad.filter((p) => p.teamCategory && p.teamCategory.toLowerCase().includes("mo40"));
  const mo50Players = squad.filter((p) => p.teamCategory && p.teamCategory.toLowerCase().includes("mo50"));
  const otherPlayers = squad.filter(
    (p) => !p.teamCategory || (!p.teamCategory.toLowerCase().includes("mo40") && !p.teamCategory.toLowerCase().includes("mo50"))
  );

  if (submitted) {
    return (
      <div className="space-y-5">
        <div className="bg-[#006B3C]/5 border border-[#006B3C]/20 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 bg-[#006B3C] rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Thank you for your pledge!</h3>
          <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
            Your support means a great deal to the team.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-bold text-gray-900 mb-1">Pay now via PayMe</p>
          <p className="text-xs text-gray-500 mb-4">
            Open the PayMe app and scan the code below to send your{" "}
            <span className="font-semibold text-gray-700">
              HK${parseFloat(form.amount).toLocaleString()}
            </span>{" "}
            pledge.
          </p>
          <img
            src="/payme-qr.jpg"
            alt="PayMe QR code"
            className="w-52 h-52 object-contain mx-auto rounded-xl"
          />
          <p className="text-xs text-gray-400 mt-4 leading-relaxed">
            Prefer bank transfer? A team member will be in touch with details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="pledge-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Your name <span className="text-[#DE2910]">*</span>
          </label>
          <input
            id="pledge-name"
            name="name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Jane Smith"
            className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 ${
              errors.name ? "border-red-400 bg-red-50" : "border-gray-200"
            }`}
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="pledge-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Email address <span className="text-[#DE2910]">*</span>
          </label>
          <input
            id="pledge-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="jane@example.com"
            className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 ${
              errors.email ? "border-red-400 bg-red-50" : "border-gray-200"
            }`}
          />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="pledge-amount" className="block text-sm font-semibold text-gray-700 mb-1.5">
          Pledge amount (HKD) <span className="text-[#DE2910]">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium select-none">HK$</span>
          <input
            id="pledge-amount"
            name="amount"
            type="number"
            min="1"
            step="any"
            value={form.amount}
            onChange={handleChange}
            placeholder="500"
            className={`w-full pl-12 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 ${
              errors.amount ? "border-red-400 bg-red-50" : "border-gray-200"
            }`}
          />
        </div>
        {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount}</p>}
        <div className="flex gap-2 mt-2">
          {[500, 1000, 2500, 5000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, amount: String(preset) }));
                if (errors.amount) setErrors((err) => ({ ...err, amount: undefined }));
              }}
              className="text-xs px-2.5 py-1 rounded-full border border-[#006B3C]/30 text-[#006B3C] font-medium hover:bg-[#006B3C]/5 transition-colors"
            >
              HK${preset.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="block text-sm font-semibold text-gray-700 mb-2">
          Who are you supporting? <span className="text-gray-400 font-normal">(optional)</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "mo40", label: "MO40 Team" },
            { id: "mo50", label: "MO50 Team" },
            { id: "player", label: "An Individual Player" },
          ].map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => {
                setBeneficiaryType(beneficiaryType === tile.id ? null : tile.id);
                setSelectedPlayerId("");
                if (errors.player) setErrors((err) => ({ ...err, player: undefined }));
              }}
              className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-xs font-semibold transition-all text-center ${
                beneficiaryType === tile.id
                  ? "border-[#006B3C] bg-[#006B3C]/5 text-[#006B3C]"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span className="leading-tight">{tile.label}</span>
            </button>
          ))}
        </div>

        {beneficiaryType === "player" && (
          <div className="mt-3">
            {squadLoading ? (
              <p className="text-xs text-gray-400">Loading players…</p>
            ) : (
              <select
                value={selectedPlayerId}
                onChange={(e) => {
                  setSelectedPlayerId(e.target.value);
                  if (errors.player) setErrors((err) => ({ ...err, player: undefined }));
                }}
                className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 bg-white ${
                  errors.player ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
              >
                <option value="">Select a player…</option>
                {mo40Players.length > 0 && (
                  <optgroup label="MO40">
                    {mo40Players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.shirtNumber ? `#${p.shirtNumber} ` : ""}{p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {mo50Players.length > 0 && (
                  <optgroup label="MO50">
                    {mo50Players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.shirtNumber ? `#${p.shirtNumber} ` : ""}{p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherPlayers.length > 0 && (
                  <optgroup label="Other">
                    {otherPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.shirtNumber ? `#${p.shirtNumber} ` : ""}{p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
            {errors.player && <p className="text-xs text-red-600 mt-1">{errors.player}</p>}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="pledge-note" className="block text-sm font-semibold text-gray-700 mb-1.5">
          Note <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="pledge-note"
          name="note"
          rows={3}
          value={form.note}
          onChange={handleChange}
          placeholder="e.g. In memory of someone, a message for the team…"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 resize-none"
        />
      </div>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{serverError}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#006B3C] text-white font-bold py-3 px-6 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Submitting…" : "Submit my pledge"}
      </button>

      <p className="text-xs text-gray-400 text-center leading-relaxed">
        This is a pledge only — no payment is taken now. A team member will follow up with details on how to send funds.
      </p>
    </form>
  );
}
