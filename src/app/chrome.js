/**
 * App chrome wiring — theme toggle, sidebar collapse, nav toggle,
 * and header button listeners.
 */

import { UI } from "../core/state.js";
import { Router } from "../core/router.js";
import { Views } from "../core/state.js";
import { q } from "../utils/dom.js";

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem("journeyai.theme");
  } catch (_e) {}
  if (!saved) {
    saved = window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  applyTheme(saved);

  const btn = q("#btnThemeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      saved = saved === "dark" ? "light" : "dark";
      applyTheme(saved);
      try {
        localStorage.setItem("journeyai.theme", saved);
      } catch (_e) {}
    });
  }
  return saved;
}

function initSidebar() {
  const app = q("#app");
  const sidebar = q(".sidebar");
  const toggle = q("#btnSidebarToggle");
  if (!app || !sidebar || !toggle) return;

  let collapsed = false;
  try {
    collapsed =
      localStorage.getItem("journeyai.sidebarCollapsed") === "1";
  } catch (_e) {}

  function apply() {
    app.classList.toggle("sidebar-collapsed", collapsed);
    sidebar.classList.toggle("collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute(
      "aria-label",
      collapsed ? "Expand sidebar" : "Collapse sidebar",
    );
    toggle.setAttribute(
      "title",
      collapsed ? "Expand sidebar" : "Collapse sidebar",
    );
    toggle.dataset.tip = collapsed
      ? "Expand sidebar"
      : "Collapse sidebar";
  }

  apply();
  toggle.addEventListener("click", () => {
    collapsed = !collapsed;
    apply();
    try {
      localStorage.setItem(
        "journeyai.sidebarCollapsed",
        collapsed ? "1" : "0",
      );
    } catch (_e) {}
  });
}

function initButtons() {
  q("#btnImport")?.addEventListener("click", () => {
    UI.draft = null;
    Router.navigate("import");
  });
  q("#btnAsk")?.addEventListener("click", () =>
    Router.navigate("assistant"),
  );
  q("#btnQuickAdd")?.addEventListener("click", () =>
    Views.eventModal?.(null, {}),
  );

  const navToggle = q("#navToggle");
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      const sidebar = q(".sidebar");
      sidebar.classList.toggle("open");
      navToggle.setAttribute(
        "aria-expanded",
        sidebar.classList.contains("open"),
      );
    });
  }
}

export function initChrome() {
  initTheme();
  initSidebar();
  initButtons();
}
