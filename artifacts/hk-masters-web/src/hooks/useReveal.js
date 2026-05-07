import { useEffect } from "react";

/**
 * Shared scroll-reveal hook.
 * Pass [location] from wouter so it re-observes after every SPA navigation.
 * Watches all `.reveal:not(.visible)` elements and adds `.visible`
 * when they enter the viewport, triggering the CSS animation in index.css.
 * Add `.wipe` or `.scale-in` to the element for animation variants.
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
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    // Only observe elements not yet revealed
    document.querySelectorAll(".reveal:not(.visible)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
