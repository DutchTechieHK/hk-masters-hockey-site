import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { requestLoginCode, verifyLoginCode, getPlayerToken } from "../lib/playerAuth";

export default function Login() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (getPlayerToken()) setLocation("/dashboard");
  }, [setLocation]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      await requestLoginCode(email.trim());
      setInfo("If that email is on the squad list, a 6-digit code is on its way. Check your inbox (and spam).");
      setStep("code");
    } catch (err) {
      setError(err.message || "Could not send code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await verifyLoginCode(email.trim(), code.trim());
      setLocation("/dashboard");
    } catch (err) {
      setError(err.message || "Code didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
          <p className="mt-2 text-sm text-gray-600">
            For HK Masters Hockey players, coaches and staff travelling to Rotterdam 2026.
          </p>
        </div>

        {step === "email" && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent text-base"
              />
              <p className="mt-2 text-xs text-gray-500">
                Use the same email your team manager has on file for you.
              </p>
            </div>
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50"
            >
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent text-2xl tracking-[0.5em] text-center font-mono"
              />
              <p className="mt-2 text-xs text-gray-500">
                Sent to <strong>{email}</strong>. Code expires in 15 minutes.
              </p>
            </div>
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(""); setInfo(""); }}
              className="w-full text-sm text-gray-600 hover:text-gray-900"
            >
              Use a different email
            </button>
          </form>
        )}

        {info && <p className="mt-4 text-sm text-green-700 text-center">{info}</p>}
        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
      </div>
    </div>
  );
}
