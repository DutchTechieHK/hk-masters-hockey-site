import { useEffect } from "react";

/**
 * Shared scroll-reveal hook.
 *
 * Pass [location] from wouter so it re-observes after every SPA navigation.
 *
 * Uses both IntersectionObserver (triggers the animation when elements
 * scroll into view) AND MutationObserver (picks up elements that are
 * added to the DOM AFTER the hook first runs, e.g. async API-loaded cards
 * on the Events, Journal and Schedule pages).
 */
export function useReveal(deps = []) {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    const observe = () => {
      document
        .querySelectorAll(".reveal:not(.visible)")
        .forEach((el) => io.observe(el));
    };

    // Observe elements that are already in the DOM
    observe();

    // Watch for elements added later (async API responses rendering cards)
    const mo = new MutationObserver((mutations) => {
      let found = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (
            node.classList?.contains("reveal") &&
            !node.classList.contains("visible")
          ) {
            io.observe(node);
            found = true;
          }
          node.querySelectorAll?.(".reveal:not(.visible)").forEach((el) => {
            io.observe(el);
            found = true;
          });
        }
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
