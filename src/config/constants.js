/**
 * Configuration constants for Journey A.I
 * Centralizes all magic numbers, provider definitions, and app settings.
 */

export const CFG = {
  storageKey: "journeyai.db.v1",
  schemaVersion: 4,
  maxDocChars: 300000,
  chunkSize: 900,
  chunkOverlap: 150,
  maxChatChars: 20000,
  maxHistoryChars: 8000,

  gemini: {
    model: "gemini-2.5-flash",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    defaultKey: "",
  },

  openrouter: {
    model: "openrouter/free",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultKey: "",
    freeModels: [
      {
        id: "openrouter/free",
        label: "Free auto-router (picks best free model)",
      },
      {
        id: "deepseek/deepseek-v4-flash-0731:free",
        label: "DeepSeek V4 Flash (1M ctx)",
      },
      {
        id: "google/gemma-4-26b-a4b-it:free",
        label: "Gemma 4 26B (multimodal)",
      },
      { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B" },
      { id: "qwen/qwen3.8-27b:free", label: "Qwen 3.8 27B" },
      {
        id: "nvidia/nemotron-3.5-lightning:free",
        label: "Nemotron 3.5 Lightning (1M ctx)",
      },
      {
        id: "nvidia/nemotron-3-ultra-550b-a55b:free",
        label: "Nemotron 3 Ultra 550B",
      },
      {
        id: "thinkingmachines/inkling:free",
        label: "Inkling (1M ctx, multimodal)",
      },
    ],
  },

  providers: {
    gemini: {
      label: "Google Gemini",
      keyHint: "AIza…",
      keyUrl: "https://aistudio.google.com/apikey",
    },
    openrouter: {
      label: "OpenRouter (free models)",
      keyHint: "sk-or-…",
      keyUrl: "https://openrouter.ai/keys",
    },
  },

  maxChatHistory: 20,
  maxChatMessages: 100,

  palette: [
    "#2f5d8c",
    "#2c6e4c",
    "#8a6410",
    "#5b4a7a",
    "#a8331f",
    "#2a6280",
    "#6b5a3e",
  ],

  taskTypes: {
    exam: { label: "Exam", icon: "", base: 300, color: "#a8331f" },
    quiz: { label: "Quiz", icon: "", base: 90, color: "#8a6410" },
    assignment: { label: "Assignment", icon: "", base: 180, color: "#2a6280" },
    project: { label: "Project", icon: "", base: 600, color: "#5b4a7a" },
    presentation: {
      label: "Presentation",
      icon: "",
      base: 240,
      color: "#2c6e4c",
    },
    lab: { label: "Lab", icon: "", base: 180, color: "#6b5a3e" },
    reading: { label: "Reading", icon: "", base: 60, color: "#545f6a" },
    other: { label: "Other", icon: "", base: 120, color: "#67717a" },
  },

  subtaskTemplates: {
    assignment: [
      "Select topic / scope",
      "Gather references",
      "Create outline",
      "Write draft",
      "Revise content",
      "Submit final work",
    ],
    project: [
      "Review requirements",
      "Write proposal / plan",
      "Design solution",
      "Build / implement",
      "Test and refine",
      "Prepare deliverables",
      "Present and submit",
    ],
    exam: [
      "Review lecture notes",
      "Rework problem sets",
      "Practice under time limit",
      "Build summary sheet",
      "Sit the exam",
    ],
    quiz: [
      "Skim assigned readings",
      "Make flash cards",
      "Self-quiz",
      "Take quiz",
    ],
    presentation: [
      "Research key points",
      "Draft slide outline",
      "Design slides",
      "Rehearse talk",
      "Deliver presentation",
    ],
    lab: [
      "Read lab brief",
      "Prepare materials",
      "Run the experiment",
      "Write lab report",
      "Submit report",
    ],
    reading: [
      "Skim structure and headings",
      "Close read assigned pages",
      "Take notes",
      "Summarise key ideas",
    ],
    other: ["Clarify requirements", "Do the work", "Review and submit"],
  },

  priorityWeights: { urgency: 0.5, weight: 0.3, effort: 0.2 },

  // Timeouts (in milliseconds)
  timeouts: {
    apiDefault: 75000,
    apiRetryDelay: 1200,
    apiRefine: 110000,
    apiAnswer: 90000,
    apiTest: 30000,
    pdfParse: 30000,
    fileParse: 20000,
    toastDefault: 4200,
    toastError: 6500,
    debounceDefault: 200,
    debounceSave: 250,
  },

  // Storage
  storage: {
    maxBytes: 5242880, // ~5 MB browser storage cap
  },

  // RAG tuning
  rag: {
    bm25k1: 1.5,
    bm25b: 0.75,
    phraseBonus: 2.5,
    snippetLength: 420,
  },

  // Planner
  planner: {
    minBlock: 15, // minimum study block in minutes
    maxBlock: 120, // maximum single block in minutes
    blockGap: 10, // gap between blocks in minutes
    weekendStart: 10, // study start hour on weekends
    weekdayStart: 18, // study start hour on weekdays
  },

  // Letter grade thresholds
  grades: [
    { min: 92, letter: "A" },
    { min: 88, letter: "A-" },
    { min: 84, letter: "B+" },
    { min: 80, letter: "B" },
    { min: 76, letter: "B-" },
    { min: 72, letter: "C+" },
    { min: 68, letter: "C" },
    { min: 60, letter: "D" },
    { min: 0, letter: "F" },
  ],
};

export default CFG;
