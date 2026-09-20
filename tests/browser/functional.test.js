/* Functional smoke test after the re-skin: the flows, not the pixels. */
(async function () {
  const J = window.JourneyAI;
  const R = [];
  const ok = (label, cond, extra) => R.push({ label, ok: !!cond, extra: extra === undefined ? '' : String(extra).slice(0, 180) });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  if (!J) { ok('app namespace', false); return R; }

  /* 1. every screen renders with content */
  const EXPECT = { dashboard: /Dashboard/, roadmap: /Roadmap/, tasks: /Task/i, planner: /Plan/i, assistant: /tutor|Ask/, library: /Library/, courses: /Course/, settings: /Settings/ };
  const bad = [];
  Object.keys(EXPECT).forEach((v) => {
    J.App.navigate(v);
    const html = $('#viewRoot').innerHTML;
    if (!EXPECT[v].test(html) || html.length < 400) bad.push(v);
    if (/>undefined<|\[object Object\]|>NaN</.test(html)) bad.push(v + '(bad value)');
  });
  ok('all screens render real content', bad.length === 0, bad.join(','));

  /* 2. the app still boots with its demo term and index */
  ok('demo term intact', J.Store.db.courses.length === 3 && J.Store.db.lessons.length > 20,
    J.Store.db.courses.length + ' courses, ' + J.Store.db.lessons.length + ' lessons');
  ok('retrieval index intact', (J.Store.db.chunks || []).length > 0, (J.Store.db.chunks || []).length + ' passages');
  ok('demo plan intact', (J.Store.db.plan || []).length > 0, (J.Store.db.plan || []).length + ' blocks');

  /* 3. import a syllabus through the real file input */
  J.App.navigate('import');
  const bin = atob(window.__FIX.txt);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  dt.items.add(new File([bytes], 'CS301-syllabus.txt', { type: 'text/plain' }));
  const input = $('#fileInput');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  for (let i = 0; i < 60 && !J.UI.draft; i++) await wait(60);
  const draft = J.UI.draft && J.UI.draft.payloads[0];
  ok('import produces a review draft', !!draft && draft.result.events.length >= 4 && draft.result.lessons.length >= 6,
    draft ? draft.result.lessons.length + ' lessons, ' + draft.result.events.length + ' deadlines, ' + draft.result.readings.length + ' readings' : 'no draft');
  ok('review screen renders', /Review what was found/.test($('#viewRoot').innerHTML));
  const before = J.Store.db.events.length;
  document.querySelector('[data-act="draft-commit"]').click();
  await wait(200);
  ok('committing an import adds tasks with subtasks', J.Store.db.events.length - before >= 4 &&
    J.Store.db.events.slice(before).every((e) => (e.subtasks || []).length >= 3),
    (J.Store.db.events.length - before) + ' new tasks');

  /* 4. the task modal still edits subtasks and grades */
  const ev = J.Store.db.events.filter((e) => (e.subtasks || []).length > 0)[0];
  J.UI.eventModal(ev.id);
  await wait(60);
  ok('task modal opens with its fields', !!$('#evTitle') && !!$('#evSubs') && !!$('#evEarned') && !!$('#evPoints'));
  $('#evSubs').value = '';
  $('#evSave').click();
  await wait(80);
  ok('clearing subtasks still works', (J.Store.event(ev.id).subtasks || []).length === 0);
  J.UI.eventModal(ev.id);
  await wait(60);
  $('#evEarned').value = '42';
  $('#evPoints').value = '50';
  $('#evSave').click();
  await wait(80);
  ok('grade entry still works', J.Store.event(ev.id).grade === 84, 'grade=' + J.Store.event(ev.id).grade);

  /* 5. task toggles and keyboard parity */
  J.App.navigate('tasks');
  const toggle = $('#viewRoot [role="checkbox"]');
  const sub = $('#viewRoot [data-act="sub-toggle"]');
  let toggled = false;
  if (sub) {
    const e = J.Store.event(sub.dataset.id);
    const s = e.subtasks.filter((x) => x.id === sub.dataset.sub)[0];
    const was = s.done;
    sub.focus();
    sub.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await wait(60);
    toggled = J.Store.event(sub.dataset.id).subtasks.filter((x) => x.id === sub.dataset.sub)[0].done !== was;
  }
  ok('checkbox rows still toggle by keyboard', !!toggle && toggled);

  /* 6. the offline tutor still answers with citations */
  J.App.navigate('assistant');
  $('#chatInput').value = 'Explain hash table collisions and probing from my notes';
  document.querySelector('[data-act="chat-send"]').click();
  for (let i = 0; i < 60 && J.UI.state.chatPending; i++) await wait(100);
  await wait(120);
  const msgs = J.Store.db.chat || [];
  const last = msgs[msgs.length - 1];
  ok('offline tutor answers with citations', !!last && last.role === 'assistant' && (last.content || '').length > 60 && (last.citations || []).length > 0,
    last ? (last.content || '').length + ' chars, ' + (last.citations || []).length + ' citations' : 'no answer');

  /* 7. sidebar clicks still navigate by mouse */
  J.App.navigate('dashboard');
  document.querySelector('#navMain a[data-arg="planner"]').click();
  await wait(80);
  ok('sidebar click navigates', J.App.renderedView === 'planner', J.App.renderedView);

  /* 8. buttons carry readable labels, not glyphs */
  const buttons = Array.from(document.querySelectorAll('#viewRoot .btn, .topbar .btn, .sidebar-foot .btn'));
  const glyphOnly = buttons.filter((b) => b.textContent.trim().length < 2);
  ok('every button has a readable label', glyphOnly.length === 0, glyphOnly.map((b) => b.dataset.act || b.id).join(','));

  /* 9. transient UI still works (toast + modal) */
  J.U.toast('Check toast', 'ok', 'Toast');
  await wait(50);
  ok('toasts render', !!$('#toasts .toast'), $('#toasts') ? $('#toasts').textContent.trim() : '');
  J.Views.helpModal();
  await wait(80);
  ok('the help modal opens', !!$('#modalRoot .modal') && $('#modalRoot').textContent.length > 200);
  document.querySelector('#modalRoot [data-close]').click();
  await wait(60);
  ok('the help modal closes', !$('#modalRoot .modal'));

  return R;
})()
