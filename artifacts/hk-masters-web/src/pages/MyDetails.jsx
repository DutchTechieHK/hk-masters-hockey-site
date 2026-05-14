import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { API_BASE } from "../utils/api";
import InstallTip from "../components/InstallTip";

const CLOUDINARY_CLOUD_NAME = "djyvdrhal";
const CLOUDINARY_UPLOAD_PRESET = "hk_masters_unsigned";

function cloudinaryViewUrl(url) {
  if (!url) return url;
  if (url.includes("res.cloudinary.com") && url.includes("/image/upload/") && url.toLowerCase().endsWith(".pdf")) {
    return url.replace(/\.pdf$/i, ".jpg");
  }
  return url;
}


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
      { key: "name", label: "Full name", type: "text", placeholder: "Your full name" },
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
      { key: "poloSize", label: "Polo", type: "text", placeholder: "S / M / L / XL" },
      { key: "trackTopSize", label: "Track Top", type: "text", placeholder: "S / M / L / XL" },
      { key: "goalieSmockSize", label: "Goalie Smock (GK only)", type: "text", placeholder: "S / M / L / XL" },
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

function formatHKD(amount) {
  if (amount == null || isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPaymentDate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function FeesPanel({ player }) {
  const due = player.paymentAmountDue;
  const paid = player.paymentAmountPaid;
  const balance = player.paymentBalance;
  const isPaid = player.feePaid && (balance == null || balance === 0);
  const partial = !isPaid && paid != null && paid > 0;
  const notSet = due == null;

  let statusBadge;
  if (notSet) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
        Not yet set
      </span>
    );
  } else if (isPaid) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd"/></svg>
        Paid in full
      </span>
    );
  } else if (partial) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
        Partially paid
      </span>
    );
  } else {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
        Outstanding
      </span>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Tournament fees</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            What you owe and what you've paid towards Rotterdam 2026.
          </p>
        </div>
        {statusBadge}
      </div>

      {notSet ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600">
          Your team admin hasn't set a fee amount for you yet. Please check back later or contact your team manager.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Total fee</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{formatHKD(due)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold mb-1">Paid so far</p>
              <p className="text-xl font-bold text-emerald-800 tabular-nums">{formatHKD(paid ?? 0)}</p>
              {player.paymentDate && (
                <p className="text-xs text-emerald-700/80 mt-1">on {formatPaymentDate(player.paymentDate)}</p>
              )}
            </div>
            <div className={`rounded-xl p-4 ${balance && balance > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
              <p className={`text-xs uppercase tracking-wide font-semibold mb-1 ${balance && balance > 0 ? "text-amber-700" : "text-gray-500"}`}>
                Outstanding
              </p>
              <p className={`text-xl font-bold tabular-nums ${balance && balance > 0 ? "text-amber-800" : "text-gray-900"}`}>
                {formatHKD(balance ?? 0)}
              </p>
            </div>
          </div>

          {due > 0 && (
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-4">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, ((paid ?? 0) / due) * 100)}%` }}
              />
            </div>
          )}

          {!isPaid && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
              <p className="font-semibold mb-1">How to pay</p>
              <p className="text-blue-800/90">
                Please arrange payment with your team manager. Once they record your payment, the amount above will update automatically.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PassportUploadPanel({ token, passportCopyUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const widgetRef = useRef(null);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;
  const tokenRef = useRef(token);
  tokenRef.current = token;

  // Pre-initialise the widget as soon as the Cloudinary script is ready.
  // The script is loaded in <head> with async, so it may arrive slightly
  // after mount — poll for it briefly rather than waiting for a user click.
  useEffect(() => {
    let cancelled = false;
    let timerId = null;

    const tryInit = () => {
      if (cancelled || widgetRef.current) return;
      if (!window.cloudinary) {
        timerId = setTimeout(tryInit, 100);
        return;
      }
      widgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName: CLOUDINARY_CLOUD_NAME,
          uploadPreset: CLOUDINARY_UPLOAD_PRESET,
          sources: ["local", "camera"],
          multiple: false,
          resourceType: "auto",
          accessMode: "public",
          clientAllowedFormats: ["jpg", "jpeg", "png", "pdf", "heic", "webp"],
          maxFileSize: 10000000,
          folder: "passport-copies",
          cropping: false,
          showAdvancedOptions: false,
          showPoweredBy: false,
          styles: {
            palette: {
              window: "#FFFFFF",
              windowBorder: "#E5E7EB",
              tabIcon: "#006B3C",
              menuIcons: "#6B7280",
              textDark: "#111827",
              textLight: "#FFFFFF",
              link: "#006B3C",
              action: "#006B3C",
              inactiveTabIcon: "#9CA3AF",
              error: "#EF4444",
              inProgress: "#006B3C",
              complete: "#10B981",
              sourceBg: "#F9FAFB",
            },
          },
        },
        async (error, result) => {
          if (error) {
            setUploading(false);
            setUploadError("Upload failed. Please try again.");
            return;
          }
          if (result.event === "upload-added") {
            setUploading(true);
          }
          if (result.event === "close") {
            setWidgetOpen(false);
            setUploading(false);
          }
          if (result.event === "success") {
            const url = result.info.secure_url;
            setUploading(false);
            try {
              const res = await fetch(
                `${API_BASE}/api/players/self/${encodeURIComponent(tokenRef.current)}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ passportCopyUrl: url }),
                }
              );
              if (!res.ok) throw new Error("Could not save passport copy URL.");
              const updated = await res.json();
              onUploadedRef.current(updated);
              setUploadSuccess(true);
            } catch {
              setUploadError("File uploaded but could not be saved. Please try again.");
            }
          }
        }
      );
    };

    tryInit();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const openWidget = () => {
    if (widgetOpen) return;
    setUploadError("");
    setUploadSuccess(false);
    if (!widgetRef.current) {
      setUploadError("Upload service unavailable. Please refresh and try again.");
      return;
    }
    setWidgetOpen(true);
    widgetRef.current.open();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex items-start justify-between mb-1 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Passport copy</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload a photo or scan of your passport's photo page. This helps the admin process your tournament registration.
          </p>
        </div>
        {passportCopyUrl && (
          <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd"/></svg>
            Uploaded
          </span>
        )}
      </div>

      {passportCopyUrl && (
        <div className="mt-3 mb-4 flex items-center gap-3 bg-gray-50 rounded-xl p-3">
          <svg className="w-8 h-8 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 truncate">Passport copy on file</p>
            <a
              href={cloudinaryViewUrl(passportCopyUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#006B3C] hover:underline"
            >
              View uploaded file ↗
            </a>
          </div>
        </div>
      )}

      {uploadSuccess && !uploadError && (
        <div className="mb-4 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Passport copy saved successfully</p>
            <p className="text-xs text-emerald-700 mt-0.5">Your admin can now see it and access the file above.</p>
          </div>
        </div>
      )}

      {uploadError && (
        <p className="text-sm text-red-600 mb-3">{uploadError}</p>
      )}

      <button
        type="button"
        onClick={openWidget}
        disabled={uploading || widgetOpen}
        className="inline-flex items-center gap-2 bg-gray-900 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Uploading…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {passportCopyUrl ? "Replace passport copy" : "Upload passport copy"}
          </>
        )}
      </button>
      <p className="text-xs text-gray-400 mt-2">Accepted: JPG, PNG, PDF, HEIC · Max 10 MB</p>
    </div>
  );
}

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
        <InstallTip />
        {/* Header */}
        <div className="mb-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
            Rotterdam 2026 — {player.teamName}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">
            Hi {player.name.split(" ")[0]}, please review your details
          </h1>
          <p className="text-gray-600">
            Update your travel, passport, emergency contact and kit sizes. Your team, shirt number and email are
            managed by the admin — contact them if anything's wrong there.
          </p>
        </div>

        {/* Locked summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-3">Confirmed by the admin</p>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
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

        {/* Tournament fees */}
        <FeesPanel player={player} />

        {/* Passport copy upload */}
        <PassportUploadPanel
          token={token}
          passportCopyUrl={player.passportCopyUrl}
          onUploaded={(updated) => {
            setPlayer(updated);
            setForm(buildInitialForm(updated));
          }}
        />

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
                  Saved at {savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} — admins will see this immediately.
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
