import { Store } from "../core/store.js";
import { esc, sortBy, uniq } from "../utils/helpers.js";
import { fmtDate } from "../utils/date.js";
import { empty, courseChip, docs, pageHead } from "./shared.js";

export function library() {
  const docList = sortBy(
    docs(),
    function (d) {
      return d.importedAt;
    },
    -1,
  );
  const usage = Store.usage();
  const KIND_LABEL = {
    syllabus: "Syllabus",
    notes: "Lecture notes",
    textbook: "Textbook",
    brief: "Assignment brief",
    other: "Other",
  };

  let h = pageHead(
    "Library",
    "Textbooks, lecture notes, handouts and briefs. Everything here is searchable by the AI assistant.",
    '<button class="btn primary" data-act="go-import">Add documents</button>',
  );

  if (location.protocol === "file:") {
    h +=
      '<div class="notice info mb"><div>You are opening this file directly from disk. Word, text and paste imports work here; PDF parsing needs a local server such as <code>npx --yes serve .</code> because browsers block PDF workers on <code>file://</code>.</div></div>';
  }

  h += '<div class="grid g-2-1">';
  h +=
    '<div class="card"><div class="card-head"><h2>Documents</h2><span class="spacer"></span>' +
    '<span class="tiny muted">' +
    docList.length +
    " file" +
    (docList.length === 1 ? "" : "s") +
    ' <i class="msep"></i> ' +
    usage.pretty +
    " of ~5 MB browser storage used</span></div>";
  if (!docList.length) {
    h += empty(
      "",
      "No documents yet",
      "Upload a syllabus, textbook chapter, lecture notes or assignment brief.",
      '<button class="btn primary mt" data-act="go-import">Add documents</button>',
    );
  } else {
    h +=
      '<div class="tbl-wrap"><table aria-label="Document library"><thead><tr><th>Document</th><th>Type</th><th>Course</th><th>Content</th><th>Added</th><th></th></tr></thead><tbody>';
    docList.forEach(function (d) {
      h +=
        "<tr>" +
        '<td><div class="strong">' +
        esc(d.name) +
        "</div>" +
        (d.chunkCount
          ? '<div class="tiny muted">' +
            d.chunkCount +
            " searchable passages</div>"
          : '<div class="tiny muted">not indexed</div>') +
        "</td>" +
        '<td><span class="tag">' +
        (KIND_LABEL[d.kind] || d.kind) +
        "</span></td>" +
        "<td>" +
        courseChip(d.courseId) +
        "</td>" +
        '<td class="nowrap-cell"><span class="tiny">' +
        (d.chars || (d.text || "").length).toLocaleString() +
        " chars" +
        (d.tables && d.tables.length
          ? ' <i class="msep"></i> ' +
            d.tables.length +
            " table" +
            (d.tables.length === 1 ? "" : "s")
          : "") +
        (d.truncated ? ' <i class="msep"></i> truncated' : "") +
        "</span></td>" +
        '<td class="nowrap-cell tiny muted">' +
        fmtDate(d.importedAt) +
        "</td>" +
        '<td class="right nowrap-cell">' +
        '<button class="btn xs" data-act="view-doc" data-id="' +
        d.id +
        '">Open</button> ' +
        '<button class="btn xs" data-act="doc-reanalyse" data-id="' +
        d.id +
        '" title="Re-run the syllabus/Deadline analysis">Re-analyse</button> ' +
        '<button class="btn xs danger" data-act="del-doc" data-id="' +
        d.id +
        '">Remove</button>' +
        "</td></tr>";
    });
    h += "</tbody></table></div>";
  }
  h += "</div>";

  h +=
    '<div class="card"><div class="card-head"><h2>Retrieval index</h2></div>' +
    '<p class="small muted">Uploaded documents are split into overlapping passages. The assistant retrieves the most relevant passages for your question and answers only from them, quoting the source.</p>' +
    '<div class="kv"><span class="k">Indexed passages</span><span class="v">' +
    (Store.db.chunks || []).length +
    "</span></div>" +
    '<div class="kv"><span class="k">Courses with material</span><span class="v">' +
    uniq(
      Store.db.documents
        .map(function (d) {
          return d.courseId;
        })
        .filter(Boolean),
    ).length +
    "</span></div>" +
    '<div class="kv"><span class="k">Storage used</span><span class="v">' +
    usage.pretty +
    "</span></div>" +
    '<button class="btn block sm mt" data-act="reindex">Rebuild index</button>' +
    '<p class="hint">Browser storage is limited to about 5 MB. Very large textbooks should be trimmed to the chapters you actually need.</p>' +
    "</div>";
  h += "</div>";
  return h;
}

export const libraryView = {
  title: "Library",
  fn: library,
};
