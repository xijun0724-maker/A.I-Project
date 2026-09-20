/**
 * Application bootstrap layer.
 * Keeps the root app shell, global event wiring, and startup sequence
 * separate from the main module entry point.
 */

import { Store } from "../core/store.js";
import { UIState, Views, UI } from "../core/state.js";
import { Router } from "../core/router.js";
import { act } from "../core/actions/index.js";
import { registerAll as registerViews } from "../views/index.js";
import { q } from "../utils/dom.js";
import { RAG } from "../domain/rag.js";
import { hydrateKey } from "../utils/secure.js";
import "../utils/extract.js";

function registerAll() {
  registerViews(Router);
}

function boot() {
  Store.load();
  hydrateKey(Store.db.settings);

  registerAll();

  afterSeed();
}

function afterSeed() {
  const needsIndex =
    !(Store.db.chunks || []).length &&
    Store.db.documents.some((d) => (d.text || "").length > 200);
  if (needsIndex) RAG.reindexAll();
  Store.saveNow();

  /* --- Scroll Reveal (IntersectionObserver) --- */
  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!reducedMotion && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    const setupReveals = () => {
      document.querySelectorAll(".reveal:not(.revealed)").forEach((el) => {
        revealObserver.observe(el);
      });
    };
    setupReveals();
    const viewRoot = q("#viewRoot");
    if (viewRoot) {
      new MutationObserver(setupReveals).observe(viewRoot, {
        childList: true,
        subtree: true,
      });
    }
  }

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

  window.addEventListener("beforeunload", () => Store.saveNow());
  window.addEventListener("pagehide", () => Store.saveNow());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Store.saveNow();
  });

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
  }
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem("journeyai.theme");
  } catch (_e) {}
  if (!savedTheme) {
    savedTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  applyTheme(savedTheme);
  const app = q("#app");
  const sidebar = q(".sidebar");
  const sidebarToggle = q("#btnSidebarToggle");
  let sidebarCollapsed = false;
  try {
    sidebarCollapsed =
      localStorage.getItem("journeyai.sidebarCollapsed") === "1";
  } catch (_e) {}
  function applySidebarState() {
    if (!app || !sidebar || !sidebarToggle) return;
    app.classList.toggle("sidebar-collapsed", sidebarCollapsed);
    sidebar.classList.toggle("collapsed", sidebarCollapsed);
    sidebarToggle.setAttribute("aria-expanded", String(!sidebarCollapsed));
    sidebarToggle.setAttribute(
      "aria-label",
      sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
    );
    sidebarToggle.setAttribute(
      "title",
      sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
    );
  }
  applySidebarState();
  sidebarToggle?.addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    applySidebarState();
    try {
      localStorage.setItem(
        "journeyai.sidebarCollapsed",
        sidebarCollapsed ? "1" : "0",
      );
    } catch (_e) {}
  });
  const btnTheme = q("#btnThemeToggle");
  if (btnTheme)
    btnTheme.addEventListener("click", () => {
      savedTheme = savedTheme === "dark" ? "light" : "dark";
      applyTheme(savedTheme);
      try {
        localStorage.setItem("journeyai.theme", savedTheme);
      } catch (_e) {}
    });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const root = q("#modalRoot");
    if (!root || !root.classList.contains("open")) return;
    const focusable = Array.from(
      root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const tablist = e.target.closest('[role="tablist"]');
      if (!tablist) return;
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      const idx = tabs.indexOf(e.target);
      if (idx === -1) return;
      e.preventDefault();
      const next =
        e.key === "ArrowRight"
          ? (idx + 1) % tabs.length
          : (idx - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    }
  });

  q("#btnImport")?.addEventListener("click", () => {
    UI.draft = null;
    Router.navigate("import");
  });
  q("#btnAsk")?.addEventListener("click", () => Router.navigate("assistant"));
  q("#btnHelp")?.addEventListener("click", () => Views.helpModal?.());
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

  Router.init();
}

export { boot, act, Store, UIState, Views, UI, Router };

export default {
  boot,
  act,
  Store,
  UIState,
  Views,
  UI,
  Router,
};
