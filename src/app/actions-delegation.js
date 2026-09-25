/**
 * Global action delegation.
 * Intercepts clicks and keyboard events on [data-act] elements
 * and dispatches them through the action system.
 *
 * Failures are reported to the user as a toast, not just the console: a
 * swallowed error is indistinguishable from a dead button.
 */

import { act } from "../core/actions/index.js";
import { toast } from "../utils/dom.js";

/**
 * Tell the user (and the console) that an action failed.
 * @param {string} action - The data-act value that failed
 * @param {Error|*} err - Whatever the handler threw or rejected with
 */
function reportActionFailure(action, err) {
  const detail = (err && err.message) || String(err || "unknown error");
  console.error('Journey A.I: action "' + action + '" failed:', err);
  toast("Something went wrong: " + detail, "bad", "Action failed");
}

/**
 * Run one delegated action, surfacing both synchronous throws and
 * rejected promises (several handlers are async).
 * @param {Element} el - The [data-act] element
 */
function dispatch(el) {
  const action = el.dataset.act;
  try {
    const result = act(action, el);
    if (result && typeof result.then === "function") {
      result.catch((err) => reportActionFailure(action, err));
    }
  } catch (err) {
    reportActionFailure(action, err);
  }
}

export function initActionDelegation() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!el) return;
    e.preventDefault();
    dispatch(el);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    const el = e.target?.closest
      ? e.target.closest('[data-act][role="checkbox"], [data-act][role="button"]')
      : null;
    if (!el) return;
    if (el.tagName === "BUTTON") return;
    e.preventDefault();
    dispatch(el);
  });
}
