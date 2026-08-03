import { useState, useEffect } from "react";
import { API_BASE } from "./api";

// Module-level cache so navigating between pages doesn't refetch.
let cachedPages = null;
let inflight = null;

function fetchPages() {
  if (cachedPages) return Promise.resolve(cachedPages);
  if (!inflight) {
    inflight = fetch(`${API_BASE}/api/site-content/page-texts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.pages) cachedPages = d.pages;
        return cachedPages;
      })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

// Returns the admin-managed text for a page, merged over the baked-in
// fallback (used until the API responds, or if it fails).
export function usePageTexts(page, fallback) {
  const [texts, setTexts] = useState(() =>
    cachedPages ? { ...fallback, ...cachedPages[page] } : fallback
  );
  useEffect(() => {
    let alive = true;
    fetchPages().then((pages) => {
      if (alive && pages && pages[page]) setTexts({ ...fallback, ...pages[page] });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  return texts;
}
