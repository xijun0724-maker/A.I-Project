/**
 * File extraction utility for Journey A.I
 * Bridges pdf.js and mammoth (loaded via CDN) to a unified Extract API.
 */

function kindFromName(name) {
  const lower = (name || "").toLowerCase();
  if (/syllabus|curriculum|outline/.test(lower)) return "syllabus";
  if (/lecture|notes|slides/.test(lower)) return "notes";
  if (/textbook|chapter|read/.test(lower)) return "textbook";
  if (/brief|summary|review/.test(lower)) return "brief";
  return "other";
}

function readAsArrayBuffer(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.onerror = function () {
      reject(new Error("Failed to read file"));
    };
    reader.readAsArrayBuffer(file);
  });
}

function readAsText(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.onerror = function () {
      reject(new Error("Failed to read file"));
    };
    reader.readAsText(file);
  });
}

function ensurePdfWorker(pdfjsLib) {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
}

async function extractPdf(file, onProgress) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib)
    throw new Error(
      "PDF.js library not loaded. Check your internet connection.",
    );

  ensurePdfWorker(pdfjsLib);

  const buffer = await readAsArrayBuffer(file);
  const data = new Uint8Array(buffer);

  let loadingTask;
  try {
    loadingTask = pdfjsLib.getDocument({ data: data });
  } catch (_e) {
    loadingTask = pdfjsLib.getDocument({ data: data, disableWorker: true });
  }
  if (onProgress) {
    loadingTask.onProgress = function (evt) {
      if (evt.total) onProgress(evt.loaded / evt.total, evt.total);
    };
  }

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const textParts = [];
  const extractedTables = [];

  function positionedRows(items) {
    const positioned = items
      .filter(function (item) {
        return item.str && item.str.trim();
      })
      .map(function (item) {
        const transform = item.transform || [];
        return {
          text: item.str.trim(),
          x: Number(transform[4]) || 0,
          y: Number(transform[5]) || 0,
          height: Number(item.height) || 10,
          width: Number(item.width) || 0,
        };
      })
      .sort(function (a, b) {
        return b.y - a.y || a.x - b.x;
      });

    const rows = [];
    positioned.forEach(function (item) {
      const row = rows.find(function (candidate) {
        return (
          Math.abs(candidate.y - item.y) <= Math.max(2.5, item.height * 0.25)
        );
      });
      if (row) {
        row.items.push(item);
        row.y = (row.y + item.y) / 2;
      } else {
        rows.push({ y: item.y, items: [item] });
      }
    });

    return rows.sort(function (a, b) {
      return b.y - a.y;
    });
  }

  function pageLines(items) {
    return positionedRows(items)
      .map(function (row) {
        row.items.sort(function (a, b) {
          return a.x - b.x;
        });
        let line = "";
        row.items.forEach(function (item) {
          const previous = line.slice(-1);
          const needsSpace =
            line && previous !== " " && !/^[,.;:!?)]/.test(item.text);
          line += (needsSpace ? " " : "") + item.text;
        });
        return line.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
  }

  function pageTable(items, pageNumber) {
    const rows = positionedRows(items)
      .map(function (row) {
        row.items.sort(function (a, b) {
          return a.x - b.x;
        });
        const cells = [];
        row.items.forEach(function (item) {
          const previous = cells[cells.length - 1];
          const previousEnd = previous ? previous.end : null;
          const gap = previousEnd == null ? 0 : item.x - previousEnd;
          if (!previous || gap > 18) {
            cells.push({
              text: item.text,
              start: item.x,
              end: item.x + (Number(item.width) || item.text.length * 4),
            });
          } else {
            previous.text +=
              (/[,.!?;:]$/.test(previous.text) ? "" : " ") + item.text;
            previous.end = Math.max(
              previous.end,
              item.x + (Number(item.width) || item.text.length * 4),
            );
          }
        });
        return cells
          .map(function (cell) {
            return cell.text.replace(/\s+/g, " ").trim();
          })
          .filter(Boolean);
      })
      .filter(function (row) {
        return row.length >= 2;
      });
    if (rows.length < 2) return null;
    const requirementPattern =
      /course requirements|formative assessment|summative assessment|accomplished worksheets|topic facilitation|discussion responses|final examinations?|presentation\s*\/\s*critique|learning environment management plan|e-?portfolio|total\s+100%/i;
    const hasHeading = rows.some(function (row) {
      return /course requirements/i.test(row.join(" "));
    });
    const relevantRows = hasHeading
      ? rows.filter(function (row) {
          return requirementPattern.test(row.join(" "));
        })
      : rows.filter(function (row) {
          return requirementPattern.test(row.join(" "));
        });
    if (relevantRows.length < 1) return null;
    return {
      page: pageNumber,
      rows: relevantRows,
      confidence: 0.9,
      kind: "course-requirements",
    };
  }

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    textParts.push(pageLines(content.items).join("\n"));
    const table = pageTable(content.items, i);
    if (table) extractedTables.push(table);
  }

  return {
    text: textParts.join("\n"),
    tables: extractedTables,
    pages: numPages,
  };
}

async function extractDocx(file) {
  const mammothLib = window.mammoth;
  if (!mammothLib)
    throw new Error(
      "Mammoth library not loaded. Check your internet connection.",
    );

  const buffer = await readAsArrayBuffer(file);
  const result = await mammothLib.extractRawText({ arrayBuffer: buffer });
  return { text: result.value || "", tables: [], pages: null };
}

async function extractText(file) {
  const text = await readAsText(file);
  return { text: text, tables: [], pages: null };
}

const KIND_LABEL = {
  syllabus: "Syllabus",
  notes: "Lecture Notes",
  textbook: "Textbook",
  brief: "Brief / Summary",
  other: "Other",
};

/* istanbul ignore next */
if (typeof window !== "undefined") {
  window.Extract = {
    SUPPORTED: "PDF, Word, text, CSV",
    accept: ".pdf,.docx,.txt,.csv",
    KIND_LABEL: KIND_LABEL,

    kind: kindFromName,

    file: function (file, onProgress) {
      const extension = (file.name || "").split(".").pop().toLowerCase();
      if (extension === "pdf") return extractPdf(file, onProgress);
      if (extension === "docx") return extractDocx(file);
      return extractText(file);
    },
  };
}
