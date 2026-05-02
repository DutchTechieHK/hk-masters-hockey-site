import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { API_BASE } from "../utils/api";

const SECTIONS = [
  {
    title: "Travel",
    fields: [
      { key: "flightArrivalDateTime", label: "Flight arrival (Rotterdam)", type: "datetime-local", placeholder: "" },
      { key: "flightDepartureDateTime", label: "Flight departure (Rotterdam)", type: "datetime-local", placeholder: "" },
      { key: "arrivalCity", label: "Arrival city / airport", type: "text", placeholder: "e.g. Rotterdam The Hague Airport (RTM)" },
    ],
  },
  {
    title: "Passport & personal",
    fields: [
      { key: "passportNumber", label: "Passport number", type: "text", placeholder: "A1234567" },
      { key: "passportExpiry", label: "Passport expiry", type: "date", placeholder: "" },
      { key: "nationality", label: "Nationality", type: "text", placeholder: "e.g. Hong Kong" },
      { key: "dateOfBirth", label: "Date of birth", type: "date", placeholder: "" },
      { key: "phone", label: "Mobile phone", type: "tel", placeholder: "+852 XXXX XXXX" },
    ],
  },
  {
    title: "Emergency contact",
    fields: [
      { key: "emergencyContactName", label: "Emergency contact name", type: "text", placeholder: "Full name" },
      { key: "emergencyContactPhone", label: "Emergency contact phone", type: "tel", placeholder: "+852 XXXX XXXX" },
    ],
  },
  {
    title: "Kit sizes",
    fields: [
      { key: "shirtSize", label: "Shirt", type: "text", placeholder: "S / M / L / XL" },
      { key: "shortsSize", label: "Shorts", type: "text", placeholder: "S / M / L / XL" },
      { key: "jacketSize", label: "Jacket", type: "text", placeholder: "S / M / L / XL" },
    ],
  },
  {
    title: "Other",
    fields: [
      { key: "roomSharingPreference", label: "Room sharing preference", type: "select", options: [
        { value: "shared", label: "Shared room" },
        { value: "single", label: "Single room" },
      ] },
      { key: "dietaryRequirements", label: "Dietary requirements", type: "text", placeholder: "None, vegetarian, halal, etc." },
      { key: "medicalNotes", label: "Medical notes", type: "textarea", placeholder: "Allergies, conditions, medication..." },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

function buildInitialForm(data) {
  const form = {};
  for (const key of ALL_FIELDS) {
    form[key] = data[key] ?? "";
  }
  return form;
}

export default function MyDetails() {
  const params = useParams();
  const token = params.token;
  const [player, setPlayer] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/players/self/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) {
          setError("This link isn't valid. Please ask the team admin for a new one.");
          setLoading(false);
          return;
        }
        if (!r.ok) throw new Error("Could not load your details. Please try again.");
        const data = await r.json();
        setPlayer(data);
        setForm(buildInitialForm(data));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Something went wrong.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSavedAt(null);
    try {
      const res = await fetch(`${API_BASE}/api/players/self/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Could not save your details. Please try again.");
      const updated = await res.json();
      setPlayer(updated);
      setForm(buildInitialForm(updated));
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto text-center text-gray-500">Loading your details...</div>
      </div>
    );
  }

  if (error && !player) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold mb-1">Link not valid</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
            Rotterdam 2026 — {player.teamName}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">
            Hi {player.name.split(" ")[0]}, please review your details
          </h1>
          <p className="text-gray-600">
            Update your travel, passport, emergency contact and kit sizes. Your name, team, shirt number and email are
            managed by the admin — contact them if anything's wrong there.
          </p>
        </div>

        {/* Locked summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-3">Confirmed by the admin</p>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-gray-500 text-xs mb-0.5">Name</dt>
              <dd className="font-semibold text-gray-900 truncate">{player.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs mb-0.5">Team</dt>
              <dd className="font-semibold text-gray-900 truncate">{player.teamName || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs mb-0.5">Shirt #</dt>
              <dd className="font-semibold text-gray-900">{player.shirtNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs mb-0.5">Email</dt>
              <dd className="font-semibold text-gray-900 truncate">{player.email || "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{section.title}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {section.fields.map((field) => (
                  <div
                    key={field.key}
                    className={`space-y-1.5 ${field.type === "textarea" ? "sm:col-span-2" : ""}`}
                  >
                    <label className="block text-sm font-semibold text-gray-700">{field.label}</label>
                    {field.type === "select" ? (
                      <select
                        value={form[field.key] ?? ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C] transition-colors"
                      >
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        rows={3}
                        value={form[field.key] ?? ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C] transition-colors"
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={form[field.key] ?? ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C] transition-colors"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Save bar */}
          <div className="sticky bottom-4 bg-white rounded-2xl border border-gray-100 shadow-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              {error && <p className="text-red-600">{error}</p>}
              {!error && savedAt && (
                <p className="text-emerald-700 font-semibold">
                  Saved at {savedAt.toLocaleTimeString()} — admins will see this immediately.
                </p>
              )}
              {!error && !savedAt && <p className="text-gray-500">Changes are saved when you press Save.</p>}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#006B3C] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save my details"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
