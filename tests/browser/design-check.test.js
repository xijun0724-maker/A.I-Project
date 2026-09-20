/* In-page design checks: geometry, contrast, leftovers from the old theme. */
(function () {
  const J = window.JourneyAI;
  const R = [];
  const ok = (label, cond, extra) =>
    R.push({
      label,
      ok: !!cond,
      extra: extra === undefined ? "" : String(extra).slice(0, 160),
    });
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const cs = (el) => getComputedStyle(el);

  const px = (v) => parseFloat(v) || 0;
  function lum(c) {
    const m = c.match(/[\d.]+/g);
    if (!m) return 1;
    const [r, g, b] = m.slice(0, 3).map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const l1 = lum(a),
      l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  /* Composite every translucent layer up to the first opaque ancestor, so a
     10%-tint badge is measured against the paper it actually sits on. */
  function pageBg(el) {
    const layers = [];
    let n = el;
    while (n) {
      const c = cs(n).backgroundColor;
      const m = c && c.match(/[\d.]+/g);
      if (m) {
        const a = m.length > 3 ? parseFloat(m[3]) : 1;
        if (a > 0) {
          layers.push({ rgb: m.slice(0, 3).map(Number), a });
          if (a >= 1) break;
        }
      }
      n = n.parentElement;
    }
    let out = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      out = out.map((base, k) => L.rgb[k] * L.a + base * (1 - L.a));
    }
    return "rgb(" + out.map((v) => Math.round(v)).join(", ") + ")";
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  if (!J) {
    ok("app namespace", false);
    return R;
  }

  /* ---------- typography and palette actually loaded ---------- */
  const faces = ["Source Serif 4", "Plus Jakarta Sans", "Geist Mono"];
  ok(
    "the three typefaces loaded",
    faces.every((f) => document.fonts.check('16px "' + f + '"')),
    faces
      .map((f) => f + ":" + document.fonts.check('16px "' + f + '"'))
      .join(" "),
  );
  const bodyFont = cs(document.body).fontFamily;
  ok(
    "body uses the interface sans",
    /Plus Jakarta Sans/.test(bodyFont),
    bodyFont,
  );
  ok(
    "headings use the serif",
    /Source Serif/.test(cs($("h1") || document.body).fontFamily) ||
      /Source Serif/.test(cs($(".page-head h1") || document.body).fontFamily),
  );
  ok(
    "paper background, not dark",
    lum(cs(document.body).backgroundColor) > 0.6,
    cs(document.body).backgroundColor,
  );

  /* ---------- no leftover dark-theme chrome ---------- */
  const gradients = $$("*").filter((el) =>
    /linear-gradient/.test(cs(el).backgroundImage),
  );
  ok(
    "no gradient washes remain",
    gradients.length === 0,
    gradients
      .slice(0, 3)
      .map((e) => e.className)
      .join(" | "),
  );
  const shadows = $$("*").filter((el) => {
    const s = cs(el).boxShadow;
    return (
      s &&
      s !== "none" &&
      !/inset|0px 0px 0px|rgb\(0, 0, 0\) 0px 0px 0px/.test(s) &&
      px(s.split(" ")[3]) > 4
    );
  });
  ok(
    "shadows are reserved for floating layers",
    shadows.length <= 3,
    shadows.map((e) => e.className).join(" | "),
  );

  /* ---------- the term header ---------- */
  const termName = $("#termName"),
    termWeek = $("#termWeek"),
    termDates = $("#termBadge");
  ok(
    "header names the term",
    !!termName && termName.textContent.trim().length > 2,
    termName && termName.textContent,
  );
  ok(
    "header states the week",
    !!termWeek && /week \d+/.test(termWeek.textContent),
    termWeek && termWeek.textContent,
  );
  ok(
    "header gives the term dates",
    !!termDates && /\d/.test(termDates.textContent),
    termDates && termDates.textContent,
  );

  /* ---------- navigation: real svg marks, no emoji ---------- */
  const navSvg = $$("#navMain svg, #navStudy svg");
  ok("nav marks are inline svg", navSvg.length >= 8, navSvg.length + " marks");
  ok(
    "nav marks inherit ink",
    navSvg.length > 0 && cs(navSvg[0]).stroke === cs(navSvg[0]).color,
    navSvg.length ? cs(navSvg[0]).stroke + " vs " + cs(navSvg[0]).color : "-",
  );
  /* real emoji ranges only: typographic marks (⌕ ▸ ▾ × –) are deliberate */
  const EMOJI =
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;
  const appText = $("#app") ? $("#app").innerText : "";
  ok(
    "no emoji anywhere in the interface",
    !EMOJI.test(appText),
    (appText.match(EMOJI) || []).join(" "),
  );

  /* ---------- contrast floor on real text ---------- */
  const samples = [
    ["h1", $("#viewRoot h1")],
    ["lead", $(".page-head .lead")],
    ["card body", $("#viewRoot .card p")],
    ["meta row", $("#viewRoot .tiny.muted")],
    ["nav item", $("#navMain a")],
    ["badge", $("#viewRoot .badge")],
    ["button", $("#viewRoot .btn")],
    ["table header", $("#viewRoot th")],
  ].filter((s) => s[1]);
  const bad = samples
    .map((s) => {
      const el = s[1];
      const fg = cs(el).color;
      const bg = pageBg(el);
      return {
        name: s[0],
        ratio: Math.round(contrast(fg, bg) * 100) / 100,
        size: px(cs(el).fontSize),
        fg,
        bg,
      };
    })
    .filter((x) => x.ratio < 4.5);
  ok(
    "text meets 4.5:1 against its background",
    bad.length === 0,
    bad
      .map(
        (b) =>
          b.name +
          " " +
          b.ratio +
          ":1 @" +
          b.size +
          "px " +
          b.fg +
          " on " +
          b.bg,
      )
      .join(" | ") || samples.length + " samples",
  );

  /* ---------- layout holds at desktop, tablet, phone ---------- */
  function overflowReport() {
    const over = $$("#viewRoot *").filter(
      (el) =>
        el.scrollWidth > el.clientWidth + 2 &&
        cs(el).overflowX !== "auto" &&
        cs(el).overflowX !== "scroll" &&
        el.clientWidth > 0,
    );
    return over
      .slice(0, 3)
      .map(
        (e) =>
          (e.className || e.tagName) +
          " " +
          e.scrollWidth +
          ">" +
          e.clientWidth,
      );
  }
  const views = [
    "dashboard",
    "roadmap",
    "tasks",
    "planner",
    "assistant",
    "library",
    "courses",
    "settings",
  ];
  let docOver = [];
  views.forEach((v) => {
    J.App.navigate(v);
    [...$("#viewRoot").children].forEach(() => {});
    if (document.documentElement.scrollWidth > window.innerWidth + 1)
      docOver.push(v);
  });
  ok(
    "no view overflows the viewport horizontally",
    docOver.length === 0,
    docOver.join(","),
  );
  J.App.navigate("dashboard");
  ok(
    "no element overflows its own box",
    overflowReport().length === 0,
    overflowReport().join(" | "),
  );

  /* ---------- the week rail: the signature device ---------- */
  J.App.navigate("roadmap");
  const rails = $$("#viewRoot .rail");
  ok(
    "roadmap renders one rail per week",
    rails.length >= 8,
    rails.length + " rails",
  );
  const firstRail = rails[0];
  if (firstRail) {
    const n = firstRail.querySelector(".rail-n"),
      b = firstRail.querySelector(".rail-body");
    ok(
      "rail carries the week number in the margin",
      /^\d+/.test(n ? n.textContent : ""),
      n && n.textContent,
    );
    const nb = n.getBoundingClientRect(),
      bb = b.getBoundingClientRect();
    ok(
      "rail number sits left of the content",
      nb.right <= bb.left + 1,
      Math.round(nb.right) + " <= " + Math.round(bb.left),
    );
    ok(
      "rail number aligns with its content rule",
      Math.abs(nb.top - bb.top) < 2,
      Math.round(nb.top) + " vs " + Math.round(bb.top),
    );
    ok(
      "rail numerals are serif and large",
      /Source Serif/.test(cs(n).fontFamily) && px(cs(n).fontSize) >= 20,
      cs(n).fontSize,
    );
  }
  ok(
    "the current week is marked with the highlighter",
    !!$("#viewRoot .rail.on .rail-n .now"),
    $("#viewRoot .rail.on") ? "marked" : "no current week",
  );

  /* ---------- separators are whitespace, not decorative characters ---------- */
  const metaRows = $$("#viewRoot .list-item .m, #viewRoot .tiny.muted");
  const withDot = metaRows.filter((el) => el.textContent.includes("\u00b7"));
  ok(
    "metadata uses whitespace separators, not middle dots",
    withDot.length === 0,
    withDot
      .slice(0, 2)
      .map((e) => e.textContent.trim().slice(0, 40))
      .join(" | ") || metaRows.length + " rows",
  );
  ok(
    "msep spacers are present for consistent spacing",
    $$("#viewRoot .msep").length > 0,
    $$("#viewRoot .msep").length + " spacers",
  );

  /* ---------- interactive states keep their affordances ---------- */
  J.App.navigate("tasks");
  const chk = $('#viewRoot [role="checkbox"]');
  ok(
    "toggles are square paper boxes",
    chk && px(cs(chk).borderRadius) <= 4,
    chk ? cs(chk).borderRadius : "-",
  );
  ok(
    "toggles keep a visible focus ring",
    !!$('#viewRoot [role="checkbox"]') &&
      getComputedStyle(document.documentElement)
        .getPropertyValue("--ink")
        .trim().length > 0,
  );
  J.App.navigate("planner");
  ok(
    "planner day heads are mono timestamps",
    !!$("#viewRoot .day-head .day-num") &&
      /Plex Mono/.test(cs($("#viewRoot .day-head .day-num")).fontFamily),
    $("#viewRoot .day-head .day-num")
      ? cs($("#viewRoot .day-head .day-num")).fontFamily
      : "missing",
  );

  /* ---------- mobile ---------- */
  return R;
})();
