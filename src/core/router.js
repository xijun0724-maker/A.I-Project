/**
 * View routing for Journey A.I
 * Handles navigation, URL hashing, and view rendering.
 */

import { Store } from "./store.js";
import { UI, Views, UIState } from "./state.js";
import { Tasks } from "../domain/tasks.js";
import { Coach } from "../domain/coach.js";
import { q } from "../utils/dom.js";
import { esc } from "../utils/helpers.js";
import { fmtDate } from "../utils/date.js";

/**
 * View definitions (populated by view modules)
 */
const viewDefs = {};

/**
 * Navigation groups for sidebar
 */
const navGroups = [
  {
    target: "#navMain",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "dashboard" },
      {
        id: "tasks",
        label: "Tasks",
        icon: "tasks",
        count: () => Store.db.events.filter(Tasks.isOpen).length,
      },
      {
        id: "planner",
        label: "Planner",
        icon: "planner",
        count: () =>
          (Store.db.plan || []).filter((p) => !p.done).length || null,
      },
    ],
  },
  {
    target: "#navStudy",
    items: [
      { id: "assistant", label: "AI tutor", icon: "assistant" },
      {
        id: "roadmap",
        label: "Roadmap",
        icon: "roadmap",
        count: () => Store.db.lessons.length,
      },
      {
        id: "library",
        label: "Library",
        icon: "library",
        count: () => Store.db.documents.length,
      },
      {
        id: "courses",
        label: "Courses",
        icon: "courses",
        count: () => Store.db.courses.length,
      },
      { id: "settings", label: "Settings", icon: "settings" },
    ],
  },
];

/**
 * SVG icons for navigation
 */
const icons = {
  dashboard:
    '<rect x="2.4" y="2.4" width="4.8" height="4.8" rx="1"/><rect x="8.8" y="2.4" width="4.8" height="4.8" rx="1"/><rect x="2.4" y="8.8" width="4.8" height="4.8" rx="1"/><rect x="8.8" y="8.8" width="4.8" height="4.8" rx="1"/>',
  roadmap:
    '<path d="M2.6 3.4v9.2"/><circle cx="2.6" cy="3.4" r="1.1"/><path d="M5.4 4.6h8"/><circle cx="2.6" cy="8" r="1.1"/><path d="M5.4 8h8"/><circle cx="2.6" cy="12.6" r="1.1"/><path d="M5.4 12.6h5"/>',
  tasks:
    '<rect x="2.4" y="2.4" width="11.2" height="11.2" rx="2"/><path d="M5.4 8.1 7 9.7l3.6-4"/>',
  planner:
    '<rect x="2.4" y="3.6" width="11.2" height="10" rx="1.6"/><path d="M2.4 6.9h11.2M5.6 2.2v2.8M10.4 2.2v2.8"/>',
  assistant:
    '<path d="M8 2.4l1.4 4.2 4.2 1.4-4.2 1.4L8 13.6l-1.4-4.2L2.4 8l4.2-1.4z"/>',
  library: '<path d="M4 2.6h5.4L13 6.2v7.2H4z"/><path d="M9.2 2.6v3.6H13"/>',
  courses:
    '<path d="M8 2.4l5.6 2.9L8 8.2 2.4 5.3z"/><path d="M3.4 8.6 8 11l4.6-2.4M3.4 11.2 8 13.6l4.6-2.4"/>',
  settings:
    '<path d="M2.4 4.8h11.2M2.4 11.2h11.2"/><circle cx="6" cy="4.8" r="1.7"/><circle cx="10.4" cy="11.2" r="1.7"/>',
};

/**
 * Get SVG mark for icon
 * @param {string} name - Icon name
 * @returns {string} SVG markup
 */
function mark(name) {
  if (!icons[name]) return "";
  return (
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    icons[name] +
    "</svg>"
  );
}

/**
 * Register a view definition
 * @param {string} id - View ID
 * @param {Object} def - View definition { title, fn, after }
 */
function registerView(id, def) {
  viewDefs[id] = def;
}

/**
 * Render navigation sidebar
 */
function renderNav() {
  navGroups.forEach((g) => {
    const host = q(g.target);
    if (!host) return;
    host.innerHTML = g.items
      .map((it) => {
        const c = it.count ? it.count() : null;
        return (
          '<a href="#' +
          it.id +
          '" data-act="nav" data-arg="' +
          it.id +
          '" class="' +
          (UIState.view === it.id ? "active" : "") +
          '"' +
          (UIState.view === it.id ? ' aria-current="page"' : "") +
          ">" +
          '<span class="ic">' +
          mark(it.icon) +
          "</span><span>" +
          esc(it.label) +
          "</span>" +
          (c ? '<span class="cnt">' + c + "</span>" : "") +
          "</a>"
        );
      })
      .join("");
  });
}

/**
 * Sync chrome elements (term summary badge)
 */
function syncChrome() {
  const termSummary = q("#termSummary");
  if (termSummary) {
    const settings = Store.db.settings || {};
    termSummary.textContent =
      settings.termStart && settings.termEnd
        ? "Term: " +
          fmtDate(settings.termStart, false) +
          " to " +
          fmtDate(settings.termEnd, false) +
          " · Week " +
          Coach.currentWeek()
        : "Term dates not set";
  }
}

/**
 * 404 view for unknown routes
 */
function notFoundView() {
  return (
    '<div class="empty" style="margin-top:80px">' +
    '<div class="big">404</div>' +
    "<h3>Page not found</h3>" +
    "<p>The page you are looking for does not exist or has been moved.</p>" +
    '<button class="btn primary mt" data-act="nav" data-arg="dashboard">Back to dashboard</button>' +
    "</div>"
  );
}

/**
 * Main render function
 */
function render() {
  UI.killCharts();
  const defaultView = Store.db.settings.defaultView || "dashboard";
  UIState.view = viewDefs[UIState.view]
    ? UIState.view
    : viewDefs[defaultView]
      ? defaultView
      : "dashboard";
  const def = viewDefs[UIState.view] || {
    fn: notFoundView,
    title: "Not found",
  };
  const currentView = UIState.view;

  renderNav();
  syncChrome();

  const root = q("#viewRoot");
  let html;
  try {
    html = def.fn();
  } catch (e) {
    html =
      '<div class="card"><h2>Something went wrong rendering this screen</h2><p class="small mono">' +
      esc(e.message) +
      "</p>" +
      '<button class="btn primary mt" data-act="nav" data-arg="dashboard">Back to dashboard</button></div>';
    if (window.console) console.error(e);
  }
  root.innerHTML = html;
  document.title = "Journey A.I - " + def.title;

  const srStatus = q("#srStatus");
  if (srStatus) srStatus.textContent = def.title;

  if (currentView === "import") {
    if (UI.draft) Views.importReviewBind(root);
    else Views.importBind(root);
  }
  if (def.after) {
    try {
      def.after(root);
    } catch (e) {
      if (window.console) console.error(e);
    }
  }
}

/**
 * Navigate to a view
 * @param {string} view - View ID
 */
function navigate(view) {
  const defaultView = Store.db.settings.defaultView || "dashboard";
  if (!viewDefs[view]) view = defaultView;
  UIState.view = view;
  if (location.hash !== "#/" + view) location.hash = "#/" + view;
  render();
}

/**
 * Initialize router and event listeners
 */
function init() {
  window.addEventListener("hashchange", () => {
    const v = (location.hash || "").replace(/^#\/?/, "");
    const defaultView = Store.db.settings.defaultView || "dashboard";
    UIState.view = viewDefs[v]
      ? v
      : viewDefs[defaultView]
        ? defaultView
        : "dashboard";
    if (location.hash !== "#/" + UIState.view) {
      window.history.replaceState(null, "", "#/" + UIState.view);
    }
    render();
  });

  window.addEventListener("popstate", () => {
    const v = (location.hash || "").replace(/^#\/?/, "");
    const defaultView = Store.db.settings.defaultView || "dashboard";
    UIState.view = viewDefs[v] ? v : defaultView;
    render();
  });

  const initial = (location.hash || "").replace(/^#\/?/, "");
  const defaultView = Store.db.settings.defaultView || "dashboard";
  UIState.view = viewDefs[initial] ? initial : defaultView;
  if (location.hash !== "#/" + UIState.view) {
    window.history.replaceState(null, "", "#/" + UIState.view);
  }
  render();
}

// Export the Router API
export const Router = {
  viewDefs,
  navGroups,
  icons,
  mark,
  registerView,
  renderNav,
  syncChrome,
  render,
  navigate,
  init,
};

export default Router;
