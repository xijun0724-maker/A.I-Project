// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/core/store.js";
import { library, afterLibrary, libraryView } from "../../src/views/library.js";

describe("Library View Layout & Hierarchy", () => {
  beforeEach(() => {
    Store.resetAll();
    Store.db.courses = [
      { id: "c1", code: "TGED 04", title: "Ethics" },
      { id: "c2", code: "MATH 101", title: "Calculus I" },
    ];
    Store.db.documents = [
      {
        id: "d1",
        name: "TEDpaths_TGED04_Ethics.pdf",
        courseId: "c1",
        kind: "other",
        chunkCount: 49,
        chars: 31872,
        importedAt: "2026-09-23T10:00:00Z",
      },
    ];
    Store.db.chunks = new Array(49).fill({ id: "chk", text: "passage text" });
  });

  it("renders balanced 4-card KPI metric grid without orphan cards", () => {
    const html = library();
    expect(html).toContain('class="library-stats-grid mb"');
    expect(html).toContain("Cataloged Documents");
    expect(html).toContain("Searchable Passages");
    expect(html).toContain("Courses Covered");
    expect(html).toContain("Storage Used");
  });

  it("renders document catalog with search and filtering toolbar", () => {
    const html = library();
    expect(html).toContain('id="libSearchInput"');
    expect(html).toContain('id="libCourseFilter"');
    expect(html).toContain('id="libTypeFilter"');
    expect(html).toContain("TGED 04 · Ethics");
    expect(html).toContain("All courses");
  });

  it("renders document card with icon, metadata badges, and actions", () => {
    const html = library();
    expect(html).toContain("TEDpaths_TGED04_Ethics.pdf");
    expect(html).toContain("doc-icon-pdf");
    expect(html).toContain("PDF");
    expect(html).toContain("49 passages");
    expect(html).toContain("31,872 chars");
    expect(html).toContain('data-act="view-doc"');
    expect(html).toContain('data-act="doc-reanalyse"');
    expect(html).toContain('data-act="del-doc"');
  });

  it("renders intake banner to eliminate empty space on low file counts", () => {
    const html = library();
    expect(html).toContain("library-intake-banner");
    expect(html).toContain("Supported Academic Materials");
    expect(html).toContain("PDF Documents");
    expect(html).toContain("Word (.docx)");
    expect(html).toContain("Plain Text &amp; Markdown");
  });

  it("renders exactly one primary add documents button without redundancy", () => {
    const html = library();
    // Header has the single authoritative CTA
    expect(html).toContain("+ Add documents");
    // Ensure no redundant duplicate buttons exist in the document card or intake banner
    expect(html).not.toContain("+ Upload files");
    const buttonMatches = html.match(/data-act="go-import"/g) || [];
    expect(buttonMatches.length).toBe(1);
  });

  it("renders non-redundant AI Knowledge Base and Storage Privacy sidebar cards", () => {
    const html = library();
    expect(html).toContain("library-ai-card");
    expect(html).toContain("AI Knowledge Base");
    expect(html).toContain("BM25 Ready");
    expect(html).toContain("On-device Lexical");
    expect(html).toContain('data-act="reindex"');
    expect(html).toContain("library-storage-card");
    expect(html).toContain("Storage &amp; Privacy");
    expect(html).toContain("Local On-Device Sandbox");
    expect(html).toContain("Browser IndexedDB");

    // Ensure sidebar does NOT duplicate top KPI metrics
    expect(html).not.toContain("Courses Indexed");
    expect(html).toContain("All documents shown");
    expect(html).not.toContain("1 document &middot; 165.6 KB used");
  });

  it("filters documents in real-time when searching or changing course filter", () => {
    Store.db.documents.push({
      id: "d2",
      name: "Calculus_Early_Transcendentals.pdf",
      courseId: "c2",
      kind: "textbook",
      chunkCount: 120,
      chars: 85000,
      importedAt: "2026-09-24T08:00:00Z",
    });

    const div = document.createElement("div");
    div.innerHTML = library();
    document.body.appendChild(div);
    afterLibrary(div);

    const searchInput = div.querySelector("#libSearchInput");
    const courseFilter = div.querySelector("#libCourseFilter");
    const rows = div.querySelectorAll(".doc-row");

    expect(rows.length).toBe(2);

    const ethicsRow = div.querySelector('[data-doc-name*="Ethics"]');
    const calcRow = div.querySelector('[data-doc-name*="Calculus"]');

    const countBadge = div.querySelector("#libFilterCount");
    expect(countBadge.textContent).toBe("All documents shown");

    // Search for Ethics
    searchInput.value = "ethics";
    searchInput.dispatchEvent(new Event("input"));

    expect(ethicsRow.style.display).toBe("");
    expect(calcRow.style.display).toBe("none");
    expect(countBadge.textContent).toBe("Showing 1 of 2 documents");

    // Filter by Calculus course (c2)
    searchInput.value = "";
    courseFilter.value = "c2";
    courseFilter.dispatchEvent(new Event("change"));

    expect(ethicsRow.style.display).toBe("none");
    expect(calcRow.style.display).toBe("");
    expect(countBadge.textContent).toBe("Showing 1 of 2 documents");

    // Reset filters
    courseFilter.value = "all";
    courseFilter.dispatchEvent(new Event("change"));
    expect(countBadge.textContent).toBe("All documents shown");

    div.remove();
  });
});
