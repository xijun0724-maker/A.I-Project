/**
 * Scroll-reveal via IntersectionObserver.
 * Observes `.reveal` elements and adds `.revealed` when they enter viewport.
 */

import { q } from "../utils/dom.js";

export function initScrollReveal() {
  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reducedMotion || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
  );

  const setup = () => {
    document.querySelectorAll(".reveal:not(.revealed)").forEach((el) => {
      observer.observe(el);
    });
  };

  setup();

  const viewRoot = q("#viewRoot");
  if (viewRoot) {
    new MutationObserver(setup).observe(viewRoot, {
      childList: true,
      subtree: true,
    });
  }
}
