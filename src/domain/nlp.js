/**
 * Natural Language Processing for syllabus/document analysis
 * Rule-based extraction of lessons, events, and readings from text.
 *
 * Implementation lives under `src/domain/nlp/`; this module re-exports the
 * same `NLP` object API that callers already import.
 */

import { pnuStandard } from "../config/standards/pnu.js";
import {
  TYPE_RULES,
  WEEK_RE,
  SESSION_ROW_RE,
  NOISE_RE,
  typeOf,
  weekOf,
  sessionOf,
  isNoise,
  clean,
  stripDates,
  weightOf,
  looksLikeReading,
  isSyllabusAssessmentLine,
  uniqueCleanLines,
  tableLines,
} from "./nlp/text.js";
import {
  termRange,
  yearFor,
  parseDateSmart,
  defaultDue,
} from "./nlp/dates.js";
import {
  analyseAgainstStandard,
  extractPnuSections,
} from "./nlp/standards.js";
import { analyse } from "./nlp/analyse.js";
import { summary, extractKeywords } from "./nlp/summary.js";

export const NLP = {
  /**
   * Back-compat alias — the PNU standard now lives in the standards registry
   * (`src/config/standards/`). Prefer `Standards.get(...)` for new code.
   */
  PNU_SYLLABUS_STANDARD: pnuStandard,

  TYPE_RULES,
  WEEK_RE,
  SESSION_ROW_RE,
  NOISE_RE,

  typeOf,
  weekOf,
  sessionOf,
  isNoise,
  clean,
  stripDates,
  weightOf,
  looksLikeReading,
  isSyllabusAssessmentLine,
  uniqueCleanLines,
  tableLines,

  termRange,
  yearFor,
  parseDateSmart,
  defaultDue,

  analyseAgainstStandard,
  extractPnuSections,

  analyse,
  summary,
  extractKeywords,
};

export default NLP;
