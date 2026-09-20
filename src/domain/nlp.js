/**
 * Natural Language Processing for syllabus/document analysis
 * Rule-based extraction of lessons, events, and readings from text.
 */

import { Store } from "../core/store.js";
import { uid, slug, uniq } from "../utils/helpers.js";
import {
  DAY,
  daysUntil,
  addDays,
  dateOnly,
  fromIso,
  iso,
  parseDate,
  parseTime,
  MONTH_FIRST_G,
  DAY_FIRST_G,
} from "../utils/date.js";
import { Tasks } from "./tasks.js";

export const NLP = {};

/**
 * PNU CMI syllabus reference standard.
 * This is intentionally data-driven so other institutional standards can be
 * added later without changing the extraction pipeline.
 */
NLP.PNU_SYLLABUS_STANDARD = {
  id: "pnu-cmi-teacher-education-2025",
  label: "PNU CMI Teacher Education Pathways",
  requiredSections: [
    {
      id: "institutional",
      label: "Institutional identity",
      patterns: [
        /pnu philosophy/i,
        /pnu vision/i,
        /pnu mission/i,
        /quality policy/i,
      ],
    },
    {
      id: "course",
      label: "Course information",
      patterns: [
        /course number/i,
        /course title/i,
        /course description/i,
        /pre-requisite|prerequisite/i,
      ],
    },
    {
      id: "outcomes",
      label: "Outcomes and alignment",
      patterns: [
        /program outcomes/i,
        /institutional outcomes/i,
        /ppst domain/i,
        /course intended learning outcomes|cilo/i,
      ],
    },
    {
      id: "inclusivity",
      label: "GEDI and GCED themes",
      patterns: [
        /gedi themes/i,
        /gced themes/i,
        /gender (?:equality|sensitivity|literacy)/i,
        /culture and intercultural/i,
      ],
    },
    {
      id: "schedule",
      label: "Session plan",
      patterns: [
        /session no\.?\s*\/?\s*duration/i,
        /instructional delivery design/i,
        /face-to-face activities/i,
        /online modality/i,
      ],
    },
    {
      id: "assessment",
      label: "Assessment and evidence",
      patterns: [
        /assessment/i,
        /evidence of performance/i,
        /performance standard/i,
        /rubric/i,
      ],
    },
    {
      id: "grading",
      label: "Grading system",
      patterns: [
        /grading system/i,
        /formative assessment/i,
        /summative assessment/i,
        /total\s+100%/i,
      ],
    },
    {
      id: "resources",
      label: "Readings and resources",
      patterns: [
        /required readings/i,
        /course references/i,
        /learning resources/i,
        /supplementary references/i,
      ],
    },
    {
      id: "policies",
      label: "Policies and expectations",
      patterns: [
        /course policies/i,
        /class policies/i,
        /course expectations/i,
        /attendance and class participation/i,
      ],
    },
    {
      id: "approvals",
      label: "Review and approval",
      patterns: [/prepared by/i, /reviewed by/i, /approved by/i],
    },
  ],
  gradingTarget: 100,
  minimumSessionCount: 3,
};

NLP.analyseAgainstStandard = function (text, result) {
  const source = String(text || "");
  const standard = NLP.PNU_SYLLABUS_STANDARD;
  const sections = standard.requiredSections.map(function (section) {
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
  source.split(/\r?\n/).forEach(function (line) {
    if (/\b(?:total|subtotal|highest mark|passing mark)\b/i.test(line)) return;
    const matches = line.match(/\b\d{1,3}(?:\.\d+)?\s*%/g) || [];
    matches.forEach(function (value) {
      weights.push(parseFloat(value));
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
    Math.abs(weightTotal - standard.gradingTarget) > 0.01
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
  if ((result.lessons || []).length < standard.minimumSessionCount) {
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
    standard: standard.id,
    standardLabel: standard.label,
    score: score,
    scoreLabel: scoreLabel,
    sections: sections,
    findings: findings,
    warnings: warnings,
    grading: {
      detected: hasGradingBreakdown,
      weights: weights,
      total: weightTotal || null,
      target: standard.gradingTarget,
      valid:
        !weights.length ||
        Math.abs(weightTotal - standard.gradingTarget) <= 0.01,
    },
    checks: {
      sessions: (result.lessons || []).length,
      assessments: (result.events || []).length,
      readings: (result.readings || []).length,
    },
  };
};

NLP.uniqueCleanLines = function (lines, limit) {
  const seen = {};
  const out = [];
  (lines || []).forEach(function (line) {
    const value = NLP.clean(line);
    if (value.length < 3 || seen[value.toLowerCase()]) return;
    seen[value.toLowerCase()] = true;
    out.push(value);
  });
  return limit ? out.slice(0, limit) : out;
};

NLP.extractPnuSections = function (source, lines, result) {
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
    return found < 0 ? "" : NLP.clean(lines[found].replace(pattern, ""));
  };
  const listSection = function (heading) {
    const start = lines.findIndex(function (line) {
      return heading.test(line);
    });
    const inline =
      start < 0 ? "" : NLP.clean(lines[start].replace(heading, ""));
    const values = section(heading, stops);
    if (inline) values.unshift(inline);
    return NLP.uniqueCleanLines(values, 80).filter(function (line) {
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
    return match ? NLP.clean(match[1]) : null;
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
    const label = NLP.clean(match[1]);
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
    const date = NLP.parseDateSmart(line);
    if (date) dates.push({ label: NLP.clean(line), date: iso(date) });
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
};

/** Assessment keyword -> task type. Order matters (specific before generic). */
NLP.TYPE_RULES = [
  {
    type: "project",
    re: /\b(project|capstone|final deliverable|implementation|prototype|toolkit|lemp|learning environment management plan)\b/i,
  },
  {
    type: "exam",
    re: /\b(midterm|mid-?term exam|final exam|finals|examination|exam)\b/i,
  },
  { type: "quiz", re: /\b(quiz|quizzes)\b/i },
  {
    type: "presentation",
    re: /\b(presentation|present(?:ation)?|defense|demo day|oral report|pitch)\b/i,
  },
  { type: "lab", re: /\b(lab|laboratory|experiment)\b/i },
  {
    type: "assignment",
    re: /\b(assignment|homework|hw\s?\d|problem set|pset|paper|essay|report|write-?up|response|reflection|journal|portfolio|draft|proposal|case study|literature review|exercise|worksheet|submission|deliverable)\b/i,
  },
  {
    type: "reading",
    re: /\b(reading|readings|read|chapter|ch\.|textbook|article|handout|reading packet|pp\.)\b/i,
  },
];

NLP.typeOf = function (line) {
  for (let i = 0; i < NLP.TYPE_RULES.length; i++) {
    if (NLP.TYPE_RULES[i].re.test(line)) return NLP.TYPE_RULES[i].type;
  }
  return null;
};

NLP.WEEK_RE =
  /\b(?:week|wk|session|module|unit|lecture|class|topic|part)\s*#?\s*(\d{1,2})\b/i;
NLP.weekOf = function (line) {
  const m = NLP.WEEK_RE.exec(line);
  if (!m) return null;
  const idx = m.index;
  if (
    idx > 24 &&
    !/[:\-–—]/.test(line.slice(idx + m[0].length, idx + m[0].length + 2))
  )
    return null;
  return parseInt(m[1], 10);
};

NLP.SESSION_ROW_RE = /^\s*(\d{1,2})\s+(.*)$/;
NLP.sessionOf = function (line) {
  const m = NLP.SESSION_ROW_RE.exec(String(line || ""));
  if (!m) return null;
  if (/^\s*\d{1,2}\s*[.)]/.test(String(line || ""))) return null;
  const number = parseInt(m[1], 10);
  if (number < 0 || number > 20 || !m[2].trim()) return null;
  return number;
};

NLP.NOISE_RE = /^[\d\s\-–—().:+]+$|@|\bhttps?:\/\/|\bwww\./i;
NLP.isNoise = function (line) {
  const s = String(line || "").trim();
  if (!s || s.length < 3) return true;
  if (NLP.NOISE_RE.test(s)) return true;
  if (/^(page|pg)\.?\s*\d+/i.test(s)) return true;
  if (/^(table of contents|contents|syllabus|course syllabus)$/i.test(s))
    return true;
  return false;
};

NLP.clean = function (s) {
  return String(s == null ? "" : s)
    .replace(/^[\s\u2022\u25cf\u25aa\u25cb\u2023\u00b7*\-–—>|]+/, "")
    .replace(/\s+/g, " ")
    .replace(/\s*[:;,]+\s*$/, "")
    .trim();
};

NLP.stripDates = function (s) {
  let out = String(s || "");
  out = out.replace(
    /\b(?:due|deadline|submit(?:ted)?|submission|posted|by)\b\s*[:_-]?/gi,
    " ",
  );
  out = out.replace(
    /^\s*(?:week|wk|session|module|unit|lecture|class|part)\s*#?\s*\d{1,2}\s*[:\-\u2013\u2014.]?\s*/i,
    " ",
  );
  out = out.replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, " ");
  out = out.replace(/\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g, " ");
  out = out.replace(MONTH_FIRST_G, " ");
  out = out.replace(DAY_FIRST_G, " ");
  out = out.replace(
    /\b(?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?\.?\b/gi,
    " ",
  );
  out = out.replace(/\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, " ");
  out = out.replace(/\b\d{1,3}(?:\.\d+)?\s*%/g, " ");
  out = out.replace(/\b\d{1,4}\s*(?:points|pts|marks)\b/gi, " ");
  out = out.replace(/[\u2013\u2014]/g, "-");
  out = out.replace(/\s*[-–—|]+\s*$/g, "").replace(/^\s*[-–—|]+\s*/g, "");
  out = out.replace(/\s*\(\s*\)/g, " ").replace(/\s*\[\s*\]/g, " ");
  out = out.replace(/\s{2,}/g, " ");
  for (let guard = 0; guard < 3; guard++) {
    out = out.replace(
      /\s+\b(?:on|at|by|for|to|of|in|and|or|the|is|are|was|due|week|day|noon|midnight)\b\.?\s*$/i,
      "",
    );
  }
  return NLP.clean(out);
};

NLP.weightOf = function (line) {
  let m = /(\d{1,3}(?:\.\d+)?)\s*%/.exec(line);
  if (m) return { weight: parseFloat(m[1]), unit: "%" };
  m = /\b(\d{1,4})\s*(?:points|pts|marks)\b/i.exec(line);
  if (m) return { points: parseInt(m[1], 10), unit: "points" };
  return null;
};

NLP.looksLikeReading = function (line) {
  return /\b(chapter|ch\.|read(?:ing|ings)?|pp\.|pages?|textbook|handout|article|packet|worksheet|skim|review the)\b/i.test(
    line,
  );
};

NLP.isSyllabusAssessmentLine = function (line) {
  const value = String(line || "");
  if (value.length < 4 || value.length > 220) return false;
  if (
    /^(?:assessment|course requirements|performance criteria|focus on|rubric)$/i.test(
      value,
    )
  )
    return false;
  return /\b(?:midterm|mid-?term|final exam(?:ination)?|exam(?:ination)?|quiz(?:zes)?|assignment|presentation|portfolio|worksheet|discussion question|lemp|learning environment management plan|submission|project|rubric|reflection|journal|report)\b/i.test(
    value,
  );
};

NLP.termRange = function () {
  const settings = (Store.db && Store.db.settings) || {};
  let s = fromIso(settings.termStart),
    e = fromIso(settings.termEnd);
  if (!s || !e) {
    const y = new Date().getFullYear();
    s = new Date(y, 0, 1);
    e = new Date(y, 11, 31);
  }
  return { s: s, e: e };
};

NLP.yearFor = function (monthIdx) {
  const t = NLP.termRange();
  const cands = uniq([t.s.getFullYear(), t.e.getFullYear()]);
  for (let i = 0; i < cands.length; i++) {
    const d = new Date(cands[i], monthIdx, 15);
    if (d >= addDays(t.s, -60) && d <= addDays(t.e, 60)) return cands[i];
  }
  return t.s.getFullYear();
};

NLP.parseDateSmart = function (line) {
  let d = parseDate(line, null);
  if (!d) return null;
  const explicit =
    /\b\d{4}\b/.test(line) || /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/.test(line);
  if (!explicit) {
    const y = NLP.yearFor(d.getMonth());
    d = new Date(y, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  }
  const tm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(line);
  if (tm) {
    const t = parseTime(tm[0]);
    if (t) {
      const x = new Date(d);
      x.setHours(t.h, t.m, 0, 0);
      return x;
    }
  }
  return d;
};

NLP.defaultDue = function (weekStart) {
  if (!weekStart) return null;
  const d = addDays(weekStart, 4);
  d.setHours(23, 59, 0, 0);
  return d;
};

NLP.tableLines = function (tables) {
  const out = [];
  (tables || []).forEach(function (t) {
    if (t.header) out.push(t.header.join(" | "));
    (t.rows || []).forEach(function (r) {
      const joined = r
        .map(function (c) {
          return c || "";
        })
        .join(" | ");
      if (joined.replace(/[\s|]/g, "")) out.push(joined);
    });
  });
  return out;
};

function weekStartFrom(line) {
  const d = NLP.parseDateSmart(line);
  if (!d) return null;
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(d, diff);
}

/**
 * Analyse extracted document text.
 * -> { lessons[], events[], readings[], tables[], scheme[], courseMeta, meta }
 */
NLP.analyse = function (input) {
  input = input || {};
  const text = String(input.text || "");
  const tables = (input.tables || []).filter(function (t) {
    return t && t.rows && t.rows.length;
  });
  const res = {
    lessons: [],
    events: [],
    readings: [],
    tables: tables,
    scheme: [],
    courseMeta: {},
    sourceName: input.name || "",
    meta: { weeks: 0, dates: 0, weights: 0, lines: 0, blocked: true },
  };
  const eventKeys = {};

  try {
    const lines = [];
    text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .forEach(function (l) {
        l = l
          .replace(/\u00a0/g, " ")
          .replace(/\t+/g, "\t")
          .replace(/[ ]{2,}/g, " ")
          .trim();
        if (!l || NLP.isNoise(l)) return;
        lines.push(l);
      });
    res.meta.lines = lines.length;

    lines.forEach(function (line, index) {
      const courseNumber = /^course\s+number\s+(.+)$/i.exec(line);
      const courseTitle = /^course\s+title\s+(.+)$/i.exec(line);
      const description = /^course\s+description\s+(.+)$/i.exec(line);
      if (courseNumber) res.courseMeta.code = NLP.clean(courseNumber[1]);
      if (courseTitle) res.courseMeta.title = NLP.clean(courseTitle[1]);
      if (description) res.courseMeta.description = NLP.clean(description[1]);
      if (/^session\s+no\.?\s*\/?\s*duration/i.test(line))
        res.meta.sessionTable = index;
    });

    const scanLines = lines.concat(NLP.tableLines(tables));

    let cur = { week: null, header: null, lines: [] };
    let sessionMode = false;
    const blocks = [];
    lines.forEach(function (l) {
      const w = NLP.weekOf(l);
      if (/^session\s+no\.?\s*\/?\s*duration/i.test(l)) sessionMode = true;
      const session = sessionMode ? NLP.sessionOf(l) : null;
      if (w !== null || session !== null) {
        if (cur.header || cur.lines.length) blocks.push(cur);
        cur = { week: w !== null ? w : session, header: l, lines: [] };
        if (w !== null || session !== null) res.meta.weeks++;
      } else if (cur.header) {
        cur.lines.push(l);
      } else {
        cur.lines.push(l);
      }
    });
    if (cur.header || cur.lines.length) blocks.push(cur);

    const weekStartByNumber = {};
    blocks.forEach(function (b) {
      const isWeekBlock = b.week !== null && b.week > 0;
      let topic = null;
      if (b.header) {
        topic = NLP.clean(
          NLP.stripDates(
            b.header
              .replace(
                /^\s*(?:week|wk|session|module|unit|lecture|class|topic|part)\s*#?\s*\d{1,2}\s*[:\-–—.]?\s*/i,
                "",
              )
              .replace(/^\s*\d{1,2}\s+/, ""),
          ),
        );
        topic = topic.replace(/^[\s:\-–—.|]+/, "").trim();
      }
      if (!topic || topic.length < 4) {
        for (let i = 0; i < b.lines.length; i++) {
          const candidate = NLP.clean(NLP.stripDates(b.lines[i]));
          if (
            candidate.length > 5 &&
            !NLP.typeOf(b.lines[i]) &&
            !NLP.parseDateSmart(b.lines[i])
          ) {
            topic = candidate;
            break;
          }
        }
      }
      let start = null;
      if (b.header) start = weekStartFrom(b.header);
      for (let j = 0; j < b.lines.length && !start; j++)
        start = weekStartFrom(b.lines[j]);
      let weekDerived = false;
      if (!start && isWeekBlock) {
        const settings = (Store.db && Store.db.settings) || {};
        const termStart = fromIso(settings.termStart);
        if (termStart) {
          start = addDays(termStart, (b.week - 1) * 7);
          weekDerived = true;
        }
      }
      if (start && !weekDerived) res.meta.dates++;
      if (isWeekBlock) {
        if (start) weekStartByNumber[b.week] = start;
        if (topic) {
          res.lessons.push({
            week: b.week,
            topic: topic,
            start: start ? dateOnly(start) : null,
            weekDerived: weekDerived,
            raw: b.header || topic,
          });
        }
      } else if (
        topic &&
        topic.length > 3 &&
        !NLP.typeOf(topic) &&
        !NLP.parseDateSmart(topic)
      ) {
        res.lessons.push({
          week: null,
          topic: topic,
          start: start ? dateOnly(start) : null,
          weekDerived: weekDerived,
          raw: topic,
        });
      }

      b.lines.forEach(function (line) {
        const t = NLP.typeOf(line);
        if (t === "reading") {
          const clean = NLP.clean(NLP.stripDates(line));
          if (clean.length > 3)
            res.readings.push({
              title: clean,
              source: "",
              week: b.week || null,
              pages: "",
              optional: /\boptional\b/i.test(line),
            });
        }
        const d = NLP.parseDateSmart(line);
        if (d && t && t !== "reading") {
          const title = NLP.clean(NLP.stripDates(line));
          if (!title || title.length < 3) return;
          const w = NLP.weightOf(line);
          const key = slug(title) + "|" + dateOnly(d);
          if (eventKeys[key]) return;
          eventKeys[key] = 1;
          res.meta.weights += w ? 1 : 0;
          res.events.push({
            title: title,
            type: t,
            due: iso(d),
            weight: w ? w.weight || null : null,
            points: w ? w.points || null : null,
            week: b.week || null,
            confidence: d ? 0.9 : 0.5,
          });
        }
      });
    });

    // Fallback: line-by-line scan for events not inside week blocks
    if (!res.events.length && !res.lessons.length) {
      scanLines.forEach(function (line) {
        const t = NLP.typeOf(line);
        const d = NLP.parseDateSmart(line);
        if (t && d) {
          const title = NLP.clean(NLP.stripDates(line));
          if (!title || title.length < 3) return;
          const w = NLP.weightOf(line);
          const key = slug(title) + "|" + dateOnly(d);
          if (eventKeys[key]) return;
          eventKeys[key] = 1;
          res.events.push({
            title: title,
            type: t,
            due: iso(d),
            weight: w ? w.weight || null : null,
            points: w ? w.points || null : null,
            week: null,
            confidence: 0.7,
          });
        }
      });
    }

    // Syllabi frequently list assessments without dates. Keep those as
    // undated tasks so the planner, task list, and tutor can still use them.
    scanLines.forEach(function (line) {
      if (!NLP.isSyllabusAssessmentLine(line)) return;
      const t = NLP.typeOf(line);
      if (!t || t === "reading") return;
      const title = NLP.clean(NLP.stripDates(line));
      if (!title || title.length < 4) return;
      const w = NLP.weightOf(line);
      const key = slug(title) + "|undated";
      if (eventKeys[key]) return;
      eventKeys[key] = 1;
      res.meta.weights += w ? 1 : 0;
      res.events.push({
        title: title,
        type: t,
        due: null,
        weight: w ? w.weight || null : null,
        points: w ? w.points || null : null,
        week: NLP.weekOf(line),
        confidence: 0.65,
        source: "syllabus requirement",
      });
    });

    const eventTitles = {};
    res.events = res.events.filter(function (event) {
      const key = slug(event.title);
      if (!key || !eventTitles[key]) {
        eventTitles[key] = event;
        return true;
      }
      if (!eventTitles[key].due && event.due) eventTitles[key] = event;
      return false;
    });

    // Remove repeated references caused by multi-page PDF extraction while
    // preserving the first occurrence and its week assignment.
    const readingKeys = {};
    res.readings = res.readings.filter(function (reading) {
      const key = slug(reading.title);
      if (!key || readingKeys[key]) return false;
      readingKeys[key] = true;
      return true;
    });

    res.meta.blocked = false;
    res.pnu = NLP.extractPnuSections(text, lines, res);
    res.standard = NLP.analyseAgainstStandard(text, res);
  } catch (_e) {
    res.meta.blocked = true;
    res.meta.error = true;
  }
  return res;
};

/** Write an analysis into the store, merging with existing course structure. */
/**
 * Summarise an analysis result for the import review screen.
 * Returns { lessons, events, readings, tables, confidence, syllabusLike }.
 */
NLP.summary = function (result) {
  const lessons = result.lessons || [];
  const events = result.events || [];
  const readings = result.readings || [];
  const tables = result.tables || [];
  const meta = result.meta || {};
  let confidence = 0;
  if (events.length) {
    let sum = 0;
    events.forEach(function (e) {
      sum += e.confidence || 0;
    });
    confidence = sum / events.length;
  }
  if (lessons.length) {
    confidence = (confidence + Math.min(1, lessons.length / 10) * 0.5) / 1.5;
  }
  confidence = Math.min(1, confidence);
  const syllabusLike = meta.weeks >= 3 || events.length >= 4;
  return {
    lessons: lessons.length,
    events: events.length,
    readings: readings.length,
    tables: tables.length,
    confidence: confidence,
    syllabusLike: syllabusLike,
  };
};

NLP.commit = function (result, courseId, docId) {
  const db = Store.db,
    stats = { lessons: 0, events: 0, readings: 0, updated: 0 };
  try {
    (result.lessons || []).forEach(function (l) {
      if (!l.topic || l.weak) return;
      const dup = db.lessons.filter(function (x) {
        return (
          x.courseId === courseId &&
          x.week === l.week &&
          slug(x.topic) === slug(l.topic)
        );
      })[0];
      if (dup) {
        if (l.start && !dup.start) dup.start = l.start;
        if (docId && dup.sourceDocId !== docId)
          dup.sourceDocId = dup.sourceDocId || docId;
        return;
      }
      let weekStart = l.start ? fromIso(l.start) : null;
      if (!weekStart && l.week) {
        const settings = (Store.db && Store.db.settings) || {};
        const t = fromIso(settings.termStart);
        if (t) weekStart = addDays(t, (l.week - 1) * 7);
      }
      if (!weekStart) weekStart = new Date();
      db.lessons.push({
        id: uid("lsn"),
        courseId: courseId,
        week: l.week,
        topic: l.topic,
        start: dateOnly(weekStart),
        end: dateOnly(addDays(weekStart, 2)),
        notes: "",
        done: false,
        readings: [],
        eventIds: [],
        sourceDocId: docId || null,
        source: "import",
      });
      stats.lessons++;
    });

    (result.events || []).forEach(function (e) {
      const title = NLP.clean(e.title);
      if (!title) return;
      const dup = db.events.filter(function (x) {
        if (x.courseId !== courseId || slug(x.title) !== slug(title))
          return false;
        if (!x.due || !e.due) return true;
        return Math.abs(daysUntil(x.due) - daysUntil(e.due)) <= 2;
      })[0];
      if (dup) {
        if (!dup.due && e.due) dup.due = e.due;
        if (dup.weight == null && e.weight != null) dup.weight = e.weight;
        if (dup.points == null && e.points != null) dup.points = e.points;
        if (e.confidence > (dup.confidence || 0)) dup.confidence = e.confidence;
        stats.updated++;
        return;
      }
      const subs = Tasks.subtasksFor(
        e.type,
        e.weight,
        e.points,
        e.due ? fromIso(e.due) : null,
      );
      db.events.push({
        id: uid("ev"),
        courseId: courseId,
        title: title,
        type: e.type || "other",
        due: e.due || null,
        weight: e.weight == null ? null : e.weight,
        points: e.points == null ? null : e.points,
        pointsEarned: null,
        status: "todo",
        notes: "",
        sourceDocId: docId || null,
        confidence: e.confidence || 0.5,
        subtasks: subs,
        readingIds: [],
        createdAt: new Date().toISOString(),
      });
      stats.events++;
    });

    (result.readings || []).forEach(function (r) {
      const title = NLP.clean(r.title);
      if (!title) return;
      const dup = db.readings.filter(function (x) {
        return (
          x.courseId === courseId &&
          slug(x.title).slice(0, 40) === slug(title).slice(0, 40)
        );
      })[0];
      if (dup) {
        if (!dup.pages && r.pages) dup.pages = r.pages;
        return;
      }
      db.readings.push({
        id: uid("rdg"),
        courseId: courseId,
        title: title,
        source: r.source || "",
        week: r.week || null,
        pages: r.pages || "",
        status: r.optional ? "optional" : "required",
        docId: docId || null,
      });
      stats.readings++;
    });

    Store.db.events.forEach(function (e) {
      if (e.courseId !== courseId || e.readingIds.length) return;
      let week = null;
      const lesson = Store.db.lessons.filter(function (l) {
        return l.courseId === courseId && l.eventIds.indexOf(e.id) !== -1;
      })[0];
      if (lesson) week = lesson.week;
      if (e.due) {
        const settings = (Store.db && Store.db.settings) || {};
        const t = fromIso(settings.termStart);
        if (t) week = Math.max(1, Math.ceil((fromIso(e.due) - t) / (7 * DAY)));
      }
      if (week == null) return;
      e.readingIds = Store.db.readings
        .filter(function (r) {
          return (
            r.courseId === courseId && r.week && Math.abs(r.week - week) <= 1
          );
        })
        .map(function (r) {
          return r.id;
        });
    });

    Store.db.lessons.forEach(function (l) {
      if (l.courseId !== courseId) return;
      l.eventIds = Store.db.events
        .filter(function (e) {
          if (e.courseId !== courseId || !e.due || !l.start) return false;
          const ls = fromIso(l.start),
            due = fromIso(e.due);
          return due >= addDays(ls, -1) && due <= addDays(ls, 6);
        })
        .map(function (e) {
          return e.id;
        });
    });

    Store.saveNow();
    stats.scheme = (result.scheme || []).length;
  } catch (_e) {
    stats.error = true;
  }
  return stats;
};

/** Extract search-relevant keywords from conversational text for RAG queries. */
NLP.extractKeywords = function (text) {
  if (!text) return "";
  const stopwords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "can",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "out",
    "off",
    "over",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "every",
    "both",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "don",
    "now",
    "about",
    "and",
    "but",
    "or",
    "if",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "i",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
    "he",
    "him",
    "his",
    "she",
    "her",
    "they",
    "them",
    "their",
    "what",
    "which",
    "who",
    "whom",
    "up",
    "also",
    "please",
    "explain",
    "tell",
    "help",
    "give",
    "show",
    "me",
    "want",
    "need",
    "know",
    "think",
    "like",
    "use",
    "used",
    "using",
    "make",
    "makes",
    "made",
    "get",
    "got",
    "go",
    "going",
    "come",
    "came",
    "see",
    "saw",
    "say",
    "said",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(function (w) {
      return w.length > 2 && !stopwords.has(w);
    })
    .slice(0, 12)
    .join(" ");
};

export default NLP;
