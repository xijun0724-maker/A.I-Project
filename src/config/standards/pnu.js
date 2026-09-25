/**
 * PNU CMI teacher-education syllabus reference standard.
 * Data-driven so the extraction pipeline stays standard-agnostic.
 */

export const pnuStandard = {
  id: "pnu-cmi-teacher-education-2025",
  label: "PNU CMI Teacher Education Pathways",
  builtin: true,
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
  competencies: [
    {
      id: "institutional-outcomes",
      label: "Institutional Outcomes",
      types: [],
      keywords: [],
    },
    {
      id: "program-outcomes",
      label: "Program Outcomes",
      types: [],
      keywords: [],
    },
    {
      id: "cilos",
      label: "Course Intended Learning Outcomes (CILOs)",
      types: [
        "exam",
        "quiz",
        "assignment",
        "project",
        "presentation",
        "reading",
        "other",
      ],
      keywords: ["teaching", "lesson", "demo"],
    },
    {
      id: "performance-indicators",
      label: "Performance Indicators",
      types: ["exam", "quiz", "project", "lab"],
      keywords: ["research", "investigation"],
    },
    {
      id: "evidence",
      label: "Evidence of Performance",
      types: ["assignment", "project", "presentation", "lab"],
      keywords: ["reflection", "portfolio", "research", "investigation"],
    },
    {
      id: "standards",
      label: "Performance Standards",
      types: ["exam", "project"],
      keywords: [],
    },
    {
      id: "gedi",
      label: "GEDI Themes",
      types: [],
      keywords: ["group", "collaborative"],
    },
    {
      id: "gced",
      label: "GCED Themes",
      types: ["presentation"],
      keywords: ["reflection", "portfolio", "group", "collaborative"],
    },
    {
      id: "ppst",
      label: "PPST Alignment",
      types: [],
      keywords: ["teaching", "lesson", "demo"],
    },
  ],
};

export default pnuStandard;
