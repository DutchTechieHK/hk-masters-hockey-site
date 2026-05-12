import { useState, useEffect, useRef } from "react";
import { API_BASE } from "../utils/api";

function PlayerCombobox({ squad, mo40Players, mo50Players, otherPlayers, selectedPlayerId, playerSearch, setPlayerSearch, onSelect, hasError }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedPlayer = squad.find((p) => String(p.id) === String(selectedPlayerId));

  const q = playerSearch.toLowerCase();
  const filter = (list) => q ? list.filter((p) => p.name.toLowerCase().includes(q) || (p.shirtNumber && String(p.shirtNumber).includes(q))) : list;

  const filteredMO40 = filter(mo40Players);
  const filteredMO50 = filter(mo50Players);
  const filteredOther = filter(otherPlayers);
  const totalResults = filteredMO40.length + filteredMO50.length + filteredOther.length;

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInputChange(e) {
    setPlayerSearch(e.target.value);
    setOpen(true);
    if (selectedPlayerId) onSelect("");
  }

  function handleSelect(player) {
    onSelect(String(player.id));
    setPlayerSearch("");
    setOpen(false);
  }

  function handleFocus() {
    setOpen(true);
  }

  const displayValue = selectedPlayer
    ? `${selectedPlayer.shirtNumber ? `#${selectedPlayer.shirtNumber} ` : ""}${selectedPlayer.name}`
    : playerSearch;

  function renderGroup(label, players) {
    if (players.length === 0) return null;
    return (
      <div key={label}>
        <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">{label}</div>
        {players.map((p) => (
          <button
            key={p.id}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-[#006B3C]/5 hover:text-[#006B3C] transition-colors flex items-center gap-2 ${
              String(selectedPlayerId) === String(p.id) ? "bg-[#006B3C]/5 text-[#006B3C] font-semibold" : "text-gray-800"
            }`}
          >
            {p.shirtNumber && (
              <span className="text-xs text-gray-400 w-7 shrink-0 font-mono">#{p.shirtNumber}</span>
            )}
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center w-full rounded-lg border text-sm bg-white ${hasError ? "border-red-400" : "border-gray-200"}`}>
        <svg className="w-4 h-4 text-gray-400 ml-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={selectedPlayer ? `${selectedPlayer.shirtNumber ? `#${selectedPlayer.shirtNumber} ` : ""}${selectedPlayer.name}` : playerSearch}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Search by name or shirt number…"
          className="flex-1 px-3 py-2.5 bg-transparent focus:outline-none placeholder-gray-400"
          autoComplete="off"
        />
        {selectedPlayer && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSelect(""); setPlayerSearch(""); }}
            className="mr-2 p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Clear selection"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-56 overflow-y-auto">
          {totalResults === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">No players found</div>
          ) : (
            <>
              {renderGroup("MO40", filteredMO40)}
              {renderGroup("MO50", filteredMO50)}
              {renderGroup("Other", filteredOther)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PledgeForm({ onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", amount: "", note: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);

  const [beneficiaryType, setBeneficiaryType] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
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
            className={`w-full px-4 py-3 rounded-xl border-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C]/40 transition-colors ${
              errors.name ? "border-red-400 bg-red-50" : "border-gray-300"
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
            className={`w-full px-4 py-3 rounded-xl border-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C]/40 transition-colors ${
              errors.email ? "border-red-400 bg-red-50" : "border-gray-300"
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
            className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C]/40 transition-colors ${
              errors.amount ? "border-red-400 bg-red-50" : "border-gray-300"
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
            {
              id: "mo40",
              label: "MO40 Team",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
            {
              id: "mo50",
              label: "MO50 Team",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
            {
              id: "player",
              label: "A Player",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ),
            },
          ].map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => {
                setBeneficiaryType(beneficiaryType === tile.id ? null : tile.id);
                setSelectedPlayerId("");
                if (errors.player) setErrors((err) => ({ ...err, player: undefined }));
              }}
              className={`flex flex-col items-center gap-2 px-2 py-4 rounded-xl border-2 text-xs font-semibold transition-all text-center cursor-pointer shadow-sm ${
                beneficiaryType === tile.id
                  ? "border-[#006B3C] bg-[#006B3C]/8 text-[#006B3C] shadow-[#006B3C]/10"
                  : "border-gray-300 text-gray-600 hover:border-[#006B3C]/40 hover:bg-[#006B3C]/4 hover:text-[#006B3C] bg-white"
              }`}
            >
              <span className={beneficiaryType === tile.id ? "text-[#006B3C]" : "text-gray-400"}>{tile.icon}</span>
              <span className="leading-tight">{tile.label}</span>
              {beneficiaryType === tile.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#006B3C]" />
              )}
            </button>
          ))}
        </div>

        {beneficiaryType === "player" && (
          <div className="mt-3">
            {squadLoading ? (
              <p className="text-xs text-gray-400">Loading players…</p>
            ) : (
              <PlayerCombobox
                squad={squad}
                mo40Players={mo40Players}
                mo50Players={mo50Players}
                otherPlayers={otherPlayers}
                selectedPlayerId={selectedPlayerId}
                playerSearch={playerSearch}
                setPlayerSearch={setPlayerSearch}
                onSelect={(id) => {
                  setSelectedPlayerId(id);
                  if (errors.player) setErrors((err) => ({ ...err, player: undefined }));
                }}
                hasError={!!errors.player}
              />
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
          placeholder="A message for the team or player you are supporting…"
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
