import { describe, it, expect } from "vitest";
import { inline, mdToHtml } from "../../src/utils/markdown.js";

describe("inline", () => {
  it("escapes HTML entities", () => {
    expect(inline("<b>bold</b>")).toBe("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("converts bold markdown", () => {
    expect(inline("**strong**")).toBe("<strong>strong</strong>");
  });

  it("converts italic markdown", () => {
    expect(inline("*emphasis*")).toBe("<em>emphasis</em>");
  });

  it("converts inline code", () => {
    expect(inline("`code`")).toBe("<code>code</code>");
  });

  it("converts citation references", () => {
    expect(inline("[1]")).toBe(
      '<sup class="cite-mark" title="Source 1">[1]</sup>',
    );
  });

  it("removes unsafe link schemes", () => {
    expect(inline("[unsafe](javascript:alert)")).toBe("unsafe");
    expect(inline("[safe](https://example.com)")).toContain(
      'href="https://example.com"',
    );
  });

  it("combines multiple formatting", () => {
    const result = inline("**bold** and *italic*");
    expect(result).toBe("<strong>bold</strong> and <em>italic</em>");
  });
});

describe("mdToHtml", () => {
  it("converts headings", () => {
    expect(mdToHtml("## Hello")).toContain("<h2>");
    expect(mdToHtml("## Hello")).toContain("Hello");
  });

  it("converts unordered lists", () => {
    const result = mdToHtml("- item one\n- item two");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>");
    expect(result).toContain("item one");
    expect(result).toContain("item two");
  });

  it("converts ordered lists", () => {
    const result = mdToHtml("1. first\n2. second");
    expect(result).toContain("<ol>");
    expect(result).toContain("<li>");
  });

  it("converts blockquotes", () => {
    const result = mdToHtml("> quoted text");
    expect(result).toContain("<blockquote>");
    expect(result).toContain("quoted text");
  });

  it("handles code blocks", () => {
    const result = mdToHtml("```\ncode here\n```");
    expect(result).toContain("<pre><code>");
    expect(result).toContain("code here");
  });

  it("handles empty input", () => {
    expect(mdToHtml("")).toBe("");
    expect(mdToHtml(null)).toBe("");
  });

  it("escapes HTML in content", () => {
    const result = mdToHtml('<script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("converts paragraphs", () => {
    const result = mdToHtml("Hello world");
    expect(result).toContain("<div>");
    expect(result).toContain("Hello world");
  });
});
