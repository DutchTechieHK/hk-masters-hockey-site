import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Mail, KeyRound, ArrowLeft, ShieldCheck } from "lucide-react";
import { createStaffSession } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  apiAdminLogin,
  apiGetAuthIdentity,
  apiRequestPlayerCode,
  apiVerifyPlayerCode,
  clearAdminToken,
  getStoredAdminToken,
  identityFingerprint,
  storeAdminToken,
  SESSION_EXPIRED_EVENT,
  type AuthIdentity,
} from "@/lib/admin-auth";

type Status = "checking" | "authed" | "unauthed";

type AuthContextValue = {
  identity: AuthIdentity;
  revalidate: () => Promise<void>;
};

const AuthIdentityContext = createContext<AuthContextValue | null>(null);

export function useAuthIdentity(): AuthContextValue {
  const ctx = useContext(AuthIdentityContext);
  if (!ctx) throw new Error("useAuthIdentity must be used inside AdminAuthGate");
  return ctx;
}

const REVALIDATE_MS = 60_000;

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [hasEverAuthed, setHasEverAuthed] = useState(false);
  const queryClient = useQueryClient();
  const fingerprintRef = useRef<string>("none");
  const checkSequence = useRef(0);

  const wipe = useCallback(() => {
    queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  const signOutLocal = useCallback(() => {
    checkSequence.current++;
    clearAdminToken();
    wipe();
    fingerprintRef.current = "none";
    setIdentity(null);
    setStatus("unauthed");
  }, [wipe]);

  const applyIdentity = useCallback((next: AuthIdentity) => {
    const fp = identityFingerprint(next);
    if (fingerprintRef.current !== "none" && fingerprintRef.current !== fp) {
      // Identity or grants changed: drop every cached record before re-rendering.
      wipe();
    }
    fingerprintRef.current = fp;
    setIdentity(next);
    setStatus("authed");
    setHasEverAuthed(true);
  }, [wipe]);

  const revalidate = useCallback(async () => {
    const sequence = ++checkSequence.current;
    const stored = getStoredAdminToken();
    if (!stored) {
      if (fingerprintRef.current !== "none") signOutLocal();
      else setStatus("unauthed");
      return;
    }
    try {
      const next = await apiGetAuthIdentity(stored);
      if (sequence !== checkSequence.current || getStoredAdminToken() !== stored) return;
      if (!next) signOutLocal();
      else applyIdentity(next);
    } catch {
      if (sequence !== checkSequence.current || getStoredAdminToken() !== stored) return;
      // Staff views fail closed if live authorization cannot be checked. Never
      // keep a private team workspace available as an offline fallback.
      if (fingerprintRef.current.startsWith("staff:")) { signOutLocal(); return; }
      // Preserve the existing full-admin behavior on transient network failure.
      setStatus((s) => (s === "checking" ? "unauthed" : s));
    }
  }, [applyIdentity, signOutLocal]);

  useEffect(() => {
    revalidate();
  }, [revalidate]);

  useEffect(() => {
    function onExpired() {
      signOutLocal();
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [signOutLocal]);

  useEffect(() => {
    if (status !== "authed") return;
    function onFocus() {
      if (document.visibilityState === "visible") revalidate();
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") revalidate();
    }, REVALIDATE_MS);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [status, revalidate]);

  async function onTokenObtained(token: string) {
    const sequence = ++checkSequence.current;
    wipe();
    storeAdminToken(token);
    fingerprintRef.current = "none";
    const next = await apiGetAuthIdentity(token);
    if (sequence !== checkSequence.current || getStoredAdminToken() !== token) return;
    if (!next) {
      clearAdminToken();
      throw new Error("Session could not be verified");
    }
    applyIdentity(next);
  }

  if (status === "checking") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted/40">
        <div className="w-64 space-y-3">
          <div className="h-3 rounded-full bg-primary/15 animate-pulse" />
          <div className="h-3 w-2/3 rounded-full bg-primary/10 animate-pulse" />
        </div>
      </div>
    );
  }

  if (status === "unauthed" || !identity) {
    return <LoginScreen expired={hasEverAuthed} onToken={onTokenObtained} />;
  }

  return (
    <AuthIdentityContext.Provider value={{ identity, revalidate }}>
      {children}
    </AuthIdentityContext.Provider>
  );
}

function LoginScreen({ expired, onToken }: { expired: boolean; onToken: (token: string) => Promise<void> }) {
  const [mode, setMode] = useState<"team" | "staff">("team");
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/40 p-4">
      <div className="max-w-sm w-full bg-card rounded-2xl border border-border shadow-xl p-8">
        <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mx-auto mb-5">
          {mode === "team" ? <Lock className="w-6 h-6 text-primary" /> : <ShieldCheck className="w-6 h-6 text-primary" />}
        </div>
        <h2 className="text-lg font-bold text-center mb-1">HK Masters Team Portal</h2>
        <p className="text-sm text-muted-foreground text-center mb-5">
          {expired
            ? "Your session ended. Sign in again to continue."
            : mode === "team"
              ? "Enter the club admin password to access the portal."
              : "Coaches and managers sign in with their member email."}
        </p>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted mb-5" role="tablist">
          {(["team", "staff"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              data-testid={`tab-login-${m}`}
              onClick={() => setMode(m)}
              className={cn(
                "text-xs font-semibold py-2 rounded-md transition-colors",
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "team" ? "Club admin" : "Coach / manager"}
            </button>
          ))}
        </div>

        {mode === "team" ? <PasswordForm onToken={onToken} /> : <StaffEmailForm onToken={onToken} />}
      </div>
    </div>
  );
}

function PasswordForm({ onToken }: { onToken: (token: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const token = await apiAdminLogin(password);
      setPassword("");
      await onToken(token);
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <Input
        type="password"
        placeholder="Team password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        autoComplete="current-password"
        data-testid="input-admin-password"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting || !password} data-testid="button-admin-login">
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function StaffEmailForm({ onToken }: { onToken: (token: string) => Promise<void> }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequestPlayerCode(email.trim());
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const playerSession = await apiVerifyPlayerCode(email.trim(), code.trim());
      let staffToken: string;
      try {
        const res = await createStaffSession({ headers: { "x-player-session": playerSession } });
        staffToken = res.token;
      } catch (err) {
        const status = (err as { status?: number })?.status;
        throw new Error(
          status === 403 || status === 401
            ? "This member account has no coach or manager access for the current season. Ask a club admin to grant it."
            : "Could not open a staff session. Please try again.",
        );
      }
      setCode("");
      await onToken(staffToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder="you@example.com"
            className="pl-9"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
            data-testid="input-staff-email"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting || !email.includes("@")} data-testid="button-staff-send-code">
          {submitting ? "Sending…" : "Email me a sign-in code"}
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground text-center">
          Only members granted Coach or Manager access by a club admin can enter. Being on a team roster alone does not.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Code sent to <span className="font-semibold text-foreground">{email}</span>
      </p>
      <div className="relative">
        <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          inputMode="numeric"
          placeholder="6-digit code"
          className="pl-9 font-mono tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoComplete="one-time-code"
          data-testid="input-staff-code"
        />
      </div>
      {error && <p className="text-xs text-destructive" data-testid="text-staff-login-error">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting || code.trim().length < 4} data-testid="button-staff-verify">
        {submitting ? "Verifying…" : "Open my team workspace"}
      </Button>
      <button
        type="button"
        onClick={() => { setStep("email"); setCode(""); setError(null); }}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        data-testid="button-staff-change-email"
      >
        <ArrowLeft className="w-3 h-3" /> Use a different email
      </button>
    </form>
  );
}
