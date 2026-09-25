/**
 * Application state management for Journey A.I
 * Centralized state for UI, views, and application context.
 *
 * UIState is defined in core/scope.js to avoid a circular dependency.
 * This module re-exports it for backward compatibility.
 */

import { toastSaved } from "../utils/dom.js";
import {
  UIState,
  courses,
  courseIds,
  inScope,
  events,
  lessons,
  readings,
  docs,
  eventProgress,
  remainingMinutes,
} from "./scope.js";

/**
 * View registry (populated by view modules)
 */
export const Views = {};

/**
 * Shared helper namespace reused by the app shell.
 * This keeps one source of truth for filtering, formatting,
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
  toastSaved,
};

export { UIState };

export default UIState;
