import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  apiAdminLogin,
  apiCheckAdminSession,
  clearAdminToken,
  getStoredAdminToken,
  storeAdminToken,
  SESSION_EXPIRED_EVENT,
} from "@/lib/admin-auth";

type Status = "checking" | "authed" | "unauthed";

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [hasEverAuthed, setHasEverAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = getStoredAdminToken();
    if (!stored) {
      setStatus("unauthed");
      return;
    }
    apiCheckAdminSession(stored).then((valid) => {
      if (valid) {
        setStatus("authed");
        setHasEverAuthed(true);
      } else {
        clearAdminToken();
        setStatus("unauthed");
      }
    });
  }, []);

  useEffect(() => {
    function onExpired() {
      clearAdminToken();
      queryClient.clear();
      setStatus("unauthed");
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const token = await apiAdminLogin(password);
      storeAdminToken(token);
      setPassword("");
      queryClient.invalidateQueries();
      setStatus("authed");
      setHasEverAuthed(true);
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const loginCard = (
    <div className="max-w-sm w-full bg-white rounded-2xl border border-border shadow-xl p-8">
      <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mx-auto mb-5">
        <Lock className="w-6 h-6 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-center mb-1">HK Masters Team Portal</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        {hasEverAuthed
          ? "Your session expired. Please sign in again to continue."
          : "Enter your team password to access the portal."}
      </p>
      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          type="password"
          placeholder="Team password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || !password}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );

  if (status === "unauthed" && !hasEverAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        {loginCard}
      </div>
    );
  }

  return (
    <>
      {children}
      {status === "unauthed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          {loginCard}
        </div>
      )}
    </>
  );
}
