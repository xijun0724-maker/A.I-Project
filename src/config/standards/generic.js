/**
 * Generic higher-education syllabus reference standard.
 * Institution-neutral sections most university syllabi should contain.
 */

export const genericStandard = {
  id: "generic-higher-ed",
  label: "Generic higher-education syllabus",
  builtin: true,
  requiredSections: [
    {
      id: "course",
      label: "Course information",
      patterns: [
        /course (?:code|number|title|name)/i,
        /catalog(?:ue)? description/i,
        /credit(?: hours?)?/i,
        /prerequisite|pre-requisite/i,
      ],
    },
    {
      id: "instructor",
      label: "Instructor and contact",
      patterns: [
        /instructor|lecturer|professor|teacher/i,
        /office hours?/i,
        /email|e-mail|contact/i,
      ],
    },
    {
      id: "outcomes",
      label: "Learning outcomes",
      patterns: [
        /learning outcomes?/i,
        /course outcomes?/i,
        /objectives?/i,
        /students? (?:will|should) be able/i,
      ],
    },
    {
      id: "schedule",
      label: "Schedule or calendar",
      patterns: [
        /schedule/i,
        /course outline/i,
        /week(?:ly)? plan/i,
        /topics? covered/i,
        /calendar/i,
      ],
    },
    {
      id: "assessment",
      label: "Assessment methods",
      patterns: [
        /assessment/i,
        /evaluation/i,
        /examination|exam/i,
        /assignment/i,
        /rubric/i,
      ],
    },
    {
      id: "grading",
      label: "Grading policy",
      patterns: [
        /grading(?: scale| system| policy)?/i,
        /grade boundaries?/i,
        /passing mark/i,
        /final grade/i,
      ],
    },
    {
      id: "materials",
      label: "Materials and readings",
      patterns: [
        /required readings?/i,
        /textbooks?/i,
        /required materials?/i,
        /references/i,
        /learning resources/i,
      ],
    },
    {
      id: "policies",
      label: "Course policies",
      patterns: [
        /course policies?/i,
        /class policies?/i,
        /attendance/i,
        /academic integrity|plagiarism/i,
        /late (?:work|submission)/i,
      ],
    },
  ],
  gradingTarget: 100,
  minimumSessionCount: 1,
  competencies: [
    {
      id: "learning-outcomes",
      label: "Learning outcomes",
      types: [
        "exam",
        "quiz",
        "assignment",
        "project",
        "presentation",
        "reading",
        "other",
      ],
      keywords: ["objective", "outcome"],
    },
    {
      id: "assessment",
      label: "Assessment",
      types: ["exam", "quiz", "assignment", "project", "presentation"],
      keywords: ["grade", "rubric", "mark"],
    },
    {
      id: "application",
      label: "Applied practice",
      types: ["lab", "project"],
      keywords: ["practice", "workshop", "studio"],
    },
    {
      id: "research",
      label: "Research and inquiry",
      types: ["assignment", "project"],
      keywords: ["research", "investigation", "inquiry"],
    },
    {
      id: "communication",
      label: "Communication",
      types: ["presentation", "assignment"],
      keywords: ["presentation", "report", "essay", "group", "collaborative"],
    },
    {
      id: "professionalism",
      label: "Professional practice",
      types: [],
      keywords: [
        "ethics",
        "integrity",
        "professional",
        "reflection",
        "portfolio",
      ],
    },
  ],
};

export default genericStandard;
