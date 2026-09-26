/**
 * Syllabus-standard scoring and PNU section extraction.
 */

import { Store } from "../../core/store.js";
import { Standards } from "../../config/standards/index.js";
import { iso } from "../../utils/date.js";
import { clean, uniqueCleanLines } from "./text.js";
import { parseDateSmart } from "./dates.js";

/**
 * Analyse text against a registered syllabus standard.
 * @param {string} text - Source document text.
 * @param {object} result - NLP analysis result (lessons/events/readings/pnu).
 * @param {string|object} [standard] - Standard id, settings object, or standard itself.
 *   Defaults to the configured `settings.syllabusStandard`, else PNU.
 */
export function analyseAgainstStandard(text, result, standard) {
  const source = String(text || "");
  const resolved =
    standard && typeof standard === "object" && standard.requiredSections
      ? standard
      : Standards.resolve(
          standard ||
            (Store.db && Store.db.settings
              ? Store.db.settings.syllabusStandard
              : null),
        );
  const sections = resolved.requiredSections.map(function (section) {
    const matched = section.patterns.some(function (pattern) {
      return pattern.test(source);
    });
    return {
      id: section.id,
      label: section.label,
      status: matched ? "present" : "missing",
    };
  });
  const present = sections.filter(function (section) {
    return section.status === "present";
  }).length;
  const score = Math.round((present / sections.length) * 100);
  const findings = [];
  const warnings = [];
  sections.forEach(function (section) {
    if (section.status === "missing")
      warnings.push("Missing or unrecognized section: " + section.label + ".");
  });

  const weights = [];
  // Only collect percentages that appear in the course requirements / grading
  // breakdown section, and skip the PNU grade-point-scale table rows.
  let inGradingSection = false;
  let pastGradeScale = false;
  source.split(/\r?\n/).forEach(function (line) {
    if (
      /\b(?:grading\s+system|course\s+requirements|formative\s+assessment|summative\s+assessment)\b/i.test(
        line,
      )
    )
      inGradingSection = true;
    if (
      /\b(?:grade\s+in\s+percent|grade\s+point\s+scale|adjectival\s+description)\b/i.test(
        line,
      )
    )
      pastGradeScale = true;
    if (!inGradingSection || pastGradeScale) return;
    if (/\b(?:total|subtotal|highest\s+mark|passing\s+mark)\b/i.test(line)) return;
    // Skip PNU grade-scale rows e.g. "98 - 100   1.00, Excellent"
    if (/\b\d{2,3}\s*[-–]\s*\d{2,3}(?:\.\d+)?\s+\d+\.\d{2}\b/.test(line)) return;
    const matches = line.match(/\b(\d{1,3}(?:\.\d+)?)\s*%/g) || [];
    matches.forEach(function (value) {
      const v = parseFloat(value);
      if (v > 0 && v <= 100) weights.push(v);
    });
  });
  const weightTotal = weights.reduce(function (sum, value) {
    return sum + value;
  }, 0);
  const hasGradingBreakdown =
    /grading system|course requirements|formative assessment|summative assessment/i.test(
      source,
    );
  if (
    hasGradingBreakdown &&
    weights.length &&
    Math.abs(weightTotal - resolved.gradingTarget) > 0.01
  ) {
    findings.push("Grading percentages total " + weightTotal + "%, not 100%.");
  }
  if (hasGradingBreakdown && !weights.length)
    warnings.push(
      "A grading section was found, but no percentage weights were detected.",
    );
  const codeMentions =
    result.pnu && result.pnu.document
      ? result.pnu.document.courseCodeMentions || []
      : [];
  if (
    result.pnu &&
    result.pnu.course &&
    result.pnu.course.code &&
    codeMentions.length &&
    codeMentions.indexOf(result.pnu.course.code) < 0
  ) {
    findings.push(
      "Course code differs between the title header and Course Number field.",
    );
  }
  if ((result.lessons || []).length < resolved.minimumSessionCount) {
    findings.push(
      "Only " +
        (result.lessons || []).length +
        " session topics were detected; verify the session table.",
    );
  }
  if (!(result.events || []).length)
    warnings.push(
      "No assessments or deadlines were detected from the extracted text.",
    );
  if (!(result.readings || []).length)
    warnings.push("No required readings or learning resources were detected.");

  const scoreLabel =
    score >= 90
      ? "Strong match"
      : score >= 70
        ? "Partial match"
        : "Needs review";
  return {
    standard: resolved.id,
    standardLabel: resolved.label,
    score: score,
    scoreLabel: scoreLabel,
    sections: sections,
    findings: findings,
    warnings: warnings,
    grading: {
      detected: hasGradingBreakdown,
      weights: weights,
      total: weightTotal || null,
      target: resolved.gradingTarget,
      valid:
        !weights.length ||
        Math.abs(weightTotal - resolved.gradingTarget) <= 0.01,
    },
    checks: {
      sessions: (result.lessons || []).length,
      assessments: (result.events || []).length,
      readings: (result.readings || []).length,
    },
  };
}

export function extractPnuSections(source, lines, result) {
  const text = String(source || "");
  const lower = text.toLowerCase();
  const section = function (heading, stops) {
    const start = lines.findIndex(function (line) {
      return heading.test(line);
    });
    if (start < 0) return [];
    const end = lines.findIndex(function (line, index) {
      return (
        index > start &&
        stops.some(function (stop) {
          return stop.test(line);
        })
      );
    });
    return lines.slice(start + 1, end < 0 ? lines.length : end);
  };
  const allHeadings = [
    /^(?:pnu philosophy|pnu vision|pnu mission|pnu quality policy|institutional outcomes|college\/institute goals|program outcomes|ppst domain)/i,
    /^(?:course number|course title|course pre-requisite|course prerequisite|course description|gedi themes|gced themes)/i,
    /^(?:sdg indicator|session no\.?\s*\/?\s*duration|unit\s*\d|independent study|required readings|course references)/i,
    /^(?:performance indicator|summary of|evidence of performance|performance standard|grading system|course requirements|course policies|class policies|course expectations|consultation period|prepared by|reviewed by|revised by|approved by)/i,
  ];
  const stops = allHeadings;
  const valuesAfter = function (pattern) {
    const found = lines.findIndex(function (line) {
      return pattern.test(line);
    });
    return found < 0 ? "" : clean(lines[found].replace(pattern, ""));
  };
  const listSection = function (heading) {
    const start = lines.findIndex(function (line) {
      return heading.test(line);
    });
    const inline = start < 0 ? "" : clean(lines[start].replace(heading, ""));
    const values = section(heading, stops);
    if (inline) values.unshift(inline);
    return uniqueCleanLines(values, 80).filter(function (line) {
      return !/^(?:focus on|essential question|content|assessment|whole class discussion|small group activity)$/i.test(
        line,
      );
    });
  };

  const institutional = {
    philosophy: valuesAfter(/^pnu philosophy\s*/i),
    vision: valuesAfter(/^pnu vision\s*/i),
    mission: valuesAfter(/^pnu mission\s*/i),
    qualityPolicy: valuesAfter(/^pnu quality policy\s*/i),
    collegeGoals: listSection(/^college\/institute goals\s*/i),
    institutionalOutcomes: listSection(/^institutional outcomes\s*/i),
    programOutcomes: listSection(/^program outcomes\s*/i),
    ppst: valuesAfter(/^ppst\s*/i),
  };
  const course = {
    code: valuesAfter(/^course number\s*/i) || result.courseMeta.code || null,
    title: valuesAfter(/^course title\s*/i) || result.courseMeta.title || null,
    prerequisite: valuesAfter(/^course pre-?requisite\s*/i) || null,
    description:
      valuesAfter(/^course description\s*/i) ||
      result.courseMeta.description ||
      null,
  };
  const themes = {
    gedi: listSection(/^gedi themes\s*/i),
    gced: listSection(/^gced themes\s*/i),
    sdg: listSection(/^sdg indicator(?:\/s)?\s*addressed\s*/i),
  };
  const outcomes = {
    courseIntended: listSection(
      /^(?:course intended learning outcomes|cilos?)\s*/i,
    ),
    performanceIndicators: listSection(
      /^performance indicator(?:s)? and evidence/i,
    ),
    evidence: listSection(/^evidence of performance\s*/i),
    standards: listSection(/^performance standard\s*/i),
  };
  const resources = {
    required: listSection(/^required readings\s*/i),
    references: listSection(
      /^course references\s*(?:and learning resources)?\s*/i,
    ),
    supplementary: listSection(/^supplementary references\s*/i),
    independentStudy: listSection(
      /^independent study\s*\/\s*flexible learning activity/i,
    ),
  };
  const policies = {
    course: listSection(/^course policies\s*/i),
    class: listSection(/^class policies\s*/i),
    expectations: listSection(/^course expectations\s*/i),
    consultation: valuesAfter(/^consultation period\s*/i),
  };
  const approvals = {
    preparedBy: valuesAfter(/^prepared by\s*/i),
    reviewedBy: valuesAfter(/^reviewed by\s*/i),
    revisedBy: valuesAfter(/^revised by\s*/i),
    approvedBy: valuesAfter(/^approved by\s*/i),
  };
  const firstMatch = function (pattern) {
    const match = pattern.exec(text);
    return match ? clean(match[1]) : null;
  };
  const headerCodeMatches = [];
  lines.forEach(function (line) {
    const match = /\b([A-Z]{2,}[A-Z0-9]*\d{2,})\b\s*[–—-]\s*[^\d]/.exec(line);
    if (match && headerCodeMatches.indexOf(match[1]) < 0)
      headerCodeMatches.push(match[1]);
  });
  const document = {
    referenceNo: firstMatch(/reference\s+no\.?\s*([^\n]+)/i),
    issueNo: firstMatch(/issue\s+no\.?\s*([^\n]+)/i),
    revisionNo: firstMatch(/rev(?:ision)?\.?\s+no\.?\s*([^\n]+)/i),
    documentDate: firstMatch(/(?:^|\n)date\s*:\s*([^\n]+)/i),
    dcNo: firstMatch(/dc\s+no\.?\s*([^\n]+)/i),
    pageCount: firstMatch(/page\s+\d+\s*\/\s*(\d+)/i),
    courseCodeMentions: headerCodeMatches,
  };

  const gradingItems = [];
  lines.forEach(function (line) {
    const match = /^(.*?)(\d{1,3}(?:\.\d+)?)\s*%\s*$/i.exec(line);
    if (!match || /total|highest mark|passing mark/i.test(line)) return;
    const label = clean(match[1]);
    if (label)
      gradingItems.push({ label: label, weight: parseFloat(match[2]) });
  });
  const courseRequirements = gradingItems
    .filter(function (item) {
      return !/^(?:grade in percent|grade point scale|adjectival description|total)$/i.test(
        item.label,
      );
    })
    .map(function (item) {
      return {
        name: item.label
          .replace(
            /^(?:course requirements\s*)?(?:formative assessment|summative assessment)\s*/i,
            "",
          )
          .trim(),
        weight: item.weight,
      };
    });

  const dates = [];
  lines.forEach(function (line) {
    const date = parseDateSmart(line);
    if (date) dates.push({ label: clean(line), date: iso(date) });
  });
  const uniqueDates = [];
  const dateKeys = {};
  dates.forEach(function (item) {
    const key = item.label + "|" + item.date;
    if (dateKeys[key]) return;
    dateKeys[key] = true;
    uniqueDates.push(item);
  });

  return {
    institutional: institutional,
    course: course,
    themes: themes,
    outcomes: outcomes,
    sessions: (result.lessons || [])
      .filter(function (lesson) {
        return lesson.week != null;
      })
      .map(function (lesson) {
        return {
          number: lesson.week,
          topic: lesson.topic,
          start: lesson.start,
          source: lesson.raw || lesson.topic,
        };
      }),
    assessments: (result.events || []).slice(),
    grading: {
      items: gradingItems,
      total: gradingItems.reduce(function (sum, item) {
        return sum + item.weight;
      }, 0),
    },
    courseRequirements: courseRequirements,
    resources: resources,
    policies: policies,
    dates: uniqueDates,
    approvals: approvals,
    document: document,
    sourceStats: {
      characters: text.length,
      lines: lines.length,
      tables: (result.tables || []).length,
    },
    detected: lower.length > 0,
  };
}
