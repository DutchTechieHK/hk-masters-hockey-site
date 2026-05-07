import { useEffect } from "react";

/**
 * Shared scroll-reveal hook.
 * Watches all `.reveal` elements in the document and adds `.visible`
 * when they enter the viewport, triggering the CSS animation defined
 * in index.css.  Add `.wipe` or `.scale-in` to the element for variants.
 */
export function useReveal() {
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
      { threshold: 0.1 }
    );

    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
