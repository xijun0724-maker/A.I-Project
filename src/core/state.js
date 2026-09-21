/**
 * Application state management for Journey A.I
 * Centralized state for UI, views, and application context.
 */

import {
  courses,
  courseIds,
  inScope,
  events,
  lessons,
  readings,
  docs,
  eventProgress,
  remainingMinutes,
  charts,
  killCharts,
} from "./scope.js";

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
export const UI = {
  courses,
  courseIds,
  inScope,
  events,
  lessons,
  readings,
  docs,
  eventProgress,
  remainingMinutes,
  state: UIState,
  draft: null,
  charts,
  killCharts,
};

export default UIState;
