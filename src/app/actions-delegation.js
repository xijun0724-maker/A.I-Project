/**
 * Global action delegation.
 * Intercepts clicks and keyboard events on [data-act] elements
 * and dispatches them through the action system.
 */

import { act } from "../core/actions/index.js";

export function initActionDelegation() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest ? e.target.closest("[data-act]") : null;
    if (el) {
      e.preventDefault();
      try {
        act(el.dataset.act, el);
      } catch (err) {
        console.error("Action error:", err);
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    const el = e.target?.closest
      ? e.target.closest('[data-act][role="checkbox"]')
      : null;
    if (!el) return;
    if (el.tagName === "BUTTON") return;
    e.preventDefault();
    try {
      act(el.dataset.act, el);
    } catch (err) {
      console.error("Action error:", err);
    }
  });
}
