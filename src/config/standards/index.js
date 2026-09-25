/**
 * Syllabus standards registry.
 * Built-ins: PNU CMI and generic higher-ed. Custom standards can be
 * registered at runtime with `Standards.register(...)`.
 */

import { pnuStandard } from "./pnu.js";
import { genericStandard } from "./generic.js";

const registry = new Map();

export const Standards = {};

Standards.DEFAULT_ID = pnuStandard.id;

function normalize(standard) {
  if (!standard || typeof standard !== "object") return null;
  const id = String(standard.id || "").trim();
  const label = String(standard.label || "").trim();
  if (!id || !label) return null;
  const sections = Array.isArray(standard.requiredSections)
    ? standard.requiredSections.filter(function (s) {
        return (
          s &&
          typeof s.id === "string" &&
          typeof s.label === "string" &&
          Array.isArray(s.patterns) &&
          s.patterns.length > 0
        );
      })
    : [];
  if (!sections.length) return null;
  return {
    id: id,
    label: label,
    builtin: !!standard.builtin,
    requiredSections: sections,
    gradingTarget:
      Number.isFinite(standard.gradingTarget) && standard.gradingTarget > 0
        ? standard.gradingTarget
        : 100,
    minimumSessionCount: Number.isFinite(standard.minimumSessionCount)
      ? Math.max(0, Math.floor(standard.minimumSessionCount))
      : 1,
    competencies: Array.isArray(standard.competencies)
      ? standard.competencies.filter(function (c) {
          return c && typeof c.id === "string" && typeof c.label === "string";
        })
      : [],
  };
}

function registerRaw(standard) {
  const value = normalize(standard);
  if (!value) return false;
  registry.set(value.id, value);
  return true;
}

/** Register (or replace) a custom standard. Returns true on success. */
Standards.register = function (standard) {
  return registerRaw(standard);
};

/** Look up a standard by id; falls back to the default when missing. */
Standards.get = function (id) {
  const key = String(id || "").trim();
  if (key && registry.has(key)) return registry.get(key);
  return registry.get(Standards.DEFAULT_ID) || null;
};

/** All registered standards, sorted by label. */
Standards.list = function () {
  return Array.from(registry.values()).sort(function (a, b) {
    return a.label.localeCompare(b.label);
  });
};

/**
 * Competency list for the active standard (settings or explicit id).
 * Falls back to the default standard's competencies (may be empty).
 */
Standards.competencies = function (idOrSettings) {
  const std = Standards.resolve(idOrSettings);
  return (std && std.competencies) || [];
};

/**
 * Resolve the standard id to use for an analysis.
 * Accepts an explicit id, else a settings-like object, else the default.
 */
Standards.resolve = function (idOrSettings) {
  if (typeof idOrSettings === "string" && idOrSettings.trim()) {
    return Standards.get(idOrSettings);
  }
  if (idOrSettings && typeof idOrSettings === "object") {
    const fromSettings = idOrSettings.syllabusStandard;
    if (typeof fromSettings === "string" && fromSettings.trim()) {
      return Standards.get(fromSettings);
    }
  }
  return Standards.get(Standards.DEFAULT_ID);
};

/** True when the id exists in the registry. */
Standards.has = function (id) {
  return registry.has(String(id || "").trim());
};

/** Remove a custom standard (built-ins cannot be removed). */
Standards.unregister = function (id) {
  const key = String(id || "").trim();
  const existing = registry.get(key);
  if (!existing || existing.builtin) return false;
  return registry.delete(key);
};

// Built-ins
registerRaw(pnuStandard);
registerRaw(genericStandard);

export { pnuStandard, genericStandard };
export default Standards;
