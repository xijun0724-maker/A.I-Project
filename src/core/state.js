/**
 * Application state management for Journey A.I
 * Centralized state for UI, views, and application context.
 */

import { Shared } from "../views/shared.js";

/**
 * Application UI state
 */
export const UIState = {
  view: "dashboard",
  courseId: "all",
  tab: {},
  chatPending: false,
  chatSources: [],
  chatSourcesOpen: true,
  pendingPrompt: null,
  draft: null,
};

/**
 * View registry (populated by view modules)
 */
export const Views = {};

/**
 * Shared helper namespace reused by the app shell.
 * This keeps one source of truth for filtering, formatting, and chart cleanup
 * without maintaining parallel wrapper methods.
 */
export const UI = Object.assign({}, Shared, {
  state: UIState,
  draft: null,
  charts: Shared.charts,
  killCharts() {
    Shared.killCharts();
  },
});

export default UIState;
