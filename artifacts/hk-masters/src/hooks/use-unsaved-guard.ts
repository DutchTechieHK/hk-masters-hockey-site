import { useEffect, useRef, type MutableRefObject } from "react";

/**
 * Warns before leaving with unsaved work: tab close/reload (beforeunload), browser Back
 * (sentinel history entry + popstate) and in-app anchor/Link clicks (capture-phase click).
 * `onBlocked(href|null)` is called so the page can confirm; null means a Back press.
 */
export function useUnsavedGuard(dirtyRef: MutableRefObject<boolean>, dirty: boolean, onBlocked: (href: string | null) => void) {
  const blockedRef = useRef(onBlocked);
  blockedRef.current = onBlocked;
  const armed = useRef(false);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      blockedRef.current(url.pathname + url.search + url.hash);
    };
    const onPop = () => {
      if (!armed.current) return;
      armed.current = false;
      if (dirtyRef.current) {
        // Stay on this page (the sentinel shared our URL), then ask.
        window.history.pushState({ ...(window.history.state ?? {}), lineupGuard: true }, "", window.location.href);
        armed.current = true;
        blockedRef.current(null);
      }
    };
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, [dirtyRef]);

  // Arm a same-URL sentinel entry once the board becomes dirty.
  useEffect(() => {
    if (dirty && !armed.current) {
      window.history.pushState({ ...(window.history.state ?? {}), lineupGuard: true }, "", window.location.href);
      armed.current = true;
    }
  }, [dirty]);

  /** Call before a confirmed leave so the guard stops intercepting. */
  return () => { armed.current = false; dirtyRef.current = false; };
}
