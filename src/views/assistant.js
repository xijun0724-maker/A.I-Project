import { CFG } from "../config/constants.js";
import { Store } from "../core/store.js";
import { UIState } from "../core/state.js";
import { Router } from "../core/router.js";
import * as AI from "../ai/index.js";
import { Tasks } from "../domain/tasks.js";
import { Coach } from "../domain/coach.js";
import { esc, uid, sortBy } from "../utils/helpers.js";
import { mdToHtml } from "../utils/markdown.js";
import { q, toast } from "../utils/dom.js";
import { pageHead } from "./shared.js";

export function assistant() {
  const st = AI.status();
  const msgs = Store.db.chat || [];
  const docs = Store.db.documents;

  let h = pageHead(
    "AI tutor",
    "Ask a question about any of your uploaded documents.",
    '<button class="btn sm" data-act="chat-plan">Study plan</button>' +
      '<button class="btn sm" data-act="chat-clear">Clear chat</button>' +
      '<button class="btn sm" data-act="chat-sources-toggle" aria-expanded="' +
      UIState.chatSourcesOpen +
      '">' +
      (UIState.chatSourcesOpen ? "Hide sources" : "Show sources") +
      "</button>",
  );

  if (!st.on) {
    h +=
      '<div class="notice ' +
      (st.why && /key/i.test(st.why) ? "warn" : "info") +
      ' mb"><div>' +
      "<strong>" +
      esc(st.label) +
      ".</strong> " +
      esc(st.why) +
      " Your questions are still answered by retrieving passages from your uploaded documents, but the explanation is extractive rather than reasoned. " +
      '<button class="btn xs" data-act="nav" data-arg="settings">Open Settings</button></div></div>';
  }
  if (!docs.length) {
    h +=
      '<div class="notice info mb"><div>Your Library is empty, so there is nothing to ground answers in yet. ' +
      '<button class="btn xs" data-act="go-import">Upload course material</button></div></div>';
  }

  const selectedSources = UIState.chatSources || [];
  const sourceLabel = selectedSources.length
    ? selectedSources.length + " selected"
    : "All files";
  h +=
    '<div class="tutor-layout' +
    (UIState.chatSourcesOpen ? "" : " sources-hidden") +
    '"><aside class="source-rail">' +
    '<div class="source-rail-head"><div><span class="eyebrow">Chat workspace</span><h2>Chat sources</h2></div><span class="source-count">' +
    sourceLabel +
    "</span></div>" +
    '<p class="tiny muted">Choose which imported files this conversation can use as evidence. Your documents are managed in Library.</p>' +
    '<button class="source-manage" data-act="nav" data-arg="library">Manage documents</button>' +
    '<button class="source-reset" data-act="chat-sources-clear"' +
    (!selectedSources.length ? " disabled" : "") +
    ">Use all files</button>" +
    '<div class="source-list">' +
    docs
      .map(function (doc) {
        const selected = selectedSources.indexOf(doc.id) !== -1;
        const used = msgs.some(function (m) {
          return (m.citations || []).some(function (c) {
            return c.docId === doc.id;
          });
        });
        return (
          '<button class="source-item' +
          (selected ? " selected" : "") +
          '" data-act="chat-source" data-id="' +
          esc(doc.id) +
          '" aria-pressed="' +
          selected +
          '">' +
          '<span class="source-icon">' +
          (used ? "●" : "○") +
          '</span><span class="source-copy"><strong>' +
          esc(doc.name) +
          "</strong><span>" +
          (used ? "Referenced in chat" : "Available source") +
          '</span></span><span class="source-check">' +
          (selected ? "✓" : "") +
          "</span></button>"
        );
      })
      .join("") +
    '</div></aside><div class="chat-wrap"><div class="chat-log" id="chatLog">';
  if (!msgs.length) {
    h +=
      '<div class="msg ai"><div class="av">AI</div><div class="bub">' +
      "<h4>Hello - I am your study tutor.</h4>" +
      "<p>I answer from the documents you upload: syllabi, lecture notes, handouts, textbook chapters and papers. Ask me to explain a concept, summarise a chapter, quiz you, or help you plan.</p>" +
      '<p class="tiny muted">Current mode: ' +
      esc(st.on ? "AI-connected (" + st.label + ")" : "offline retrieval") +
      "</p>" +
      "</div></div>";
  }
  msgs.forEach(function (m) {
    h +=
      '<div class="msg ' +
      (m.role === "user" ? "user" : "ai") +
      '"><div class="av">' +
      (m.role === "user" ? "You" : "AI") +
      '</div><div class="bub">';
    h +=
      m.role === "user"
        ? "<div>" + esc(m.content) + "</div>"
        : mdToHtml(m.content);
    if (m.citations && m.citations.length) {
      h +=
        '<div class="cites">' +
        m.citations
          .map(function (c) {
            return (
              '<div class="cite"><span class="src">[' +
              c.n +
              "] " +
              esc(c.docName) +
              "</span> - passage " +
              (c.idx + 1) +
              '<div class="tiny muted mt-s">' +
              esc((c.snippet || "").slice(0, 200)) +
              "</div></div>"
            );
          })
          .join("") +
        "</div>";
    }
    if (m.mode === "offline")
      h +=
        '<div class="tiny muted mt-s">offline retrieval <i class="msep"></i> no API key used</div>';
    if (m.model)
      h +=
        '<div class="tiny muted mt-s">answered by ' + esc(m.model) + "</div>";
    h += "</div></div>";
  });
  if (UIState.chatPending)
    h +=
      '<div class="msg ai"><div class="av">AI</div><div class="bub"><div class="typing"><span></span><span></span><span></span></div></div></div>';
  h += "</div>";

  h +=
    '<div class="chat-input"><div class="row" style="align-items:flex-end">' +
    '<textarea id="chatInput" rows="1" placeholder="Ask something like: explain amortised analysis using my week 10 notes..." style="min-height:44px;flex:1"></textarea>' +
    '<button class="chat-send" data-act="chat-send" aria-label="Send message">' +
    '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2.5 2.5l15 7.5-15 7.5 2-7.5-2-7.5zm3 8.5l12-6-12-6v4.5l8 1.5-8 1.5v4.5z"/></svg>' +
    "</button></div>" +
    '<div class="row tiny muted mt-s"><button class="chat-source-picker" data-act="chat-sources-toggle" aria-expanded="' +
    UIState.chatSourcesOpen +
    '">' +
    (UIState.chatSourcesOpen ? "Done selecting" : "Select files") +
    '</button><span>Enter to send, Shift+Enter for a new line</span><span class="spacer"></span>' +
    '<label class="row tiny" style="gap:5px"><input type="checkbox" id="chatFresh"> Start a fresh context</label></div></div></div></div>';

  return h;
}

export function suggestions() {
  const out = [];
  const open = Tasks.ranked(Store.db.events.filter(Tasks.isOpen));
  if (open.length)
    out.push({
      label: "Help me understand " + open[0].title,
      q:
        'Explain what I need to do for "' +
        open[0].title +
        '" and break it into steps.',
    });
  const lesson = sortBy(
    Store.db.lessons.filter(function (l) {
      return l.week >= Coach.currentWeek();
    }),
    function (l) {
      return l.week;
    },
  )[0];
  if (lesson)
    out.push({
      label: "Explain this week's topic: " + lesson.topic.slice(0, 38),
      q: "Explain " + lesson.topic + " in simple terms with an example.",
    });
  const doc = Store.db.documents[0];
  if (doc)
    out.push({
      label: "Summarise " + doc.name.slice(0, 30),
      q:
        "Summarise the key ideas in " +
        doc.name +
        " and list the most likely exam questions.",
    });
  const exam = Store.db.events.filter(function (e) {
    return e.type === "exam" && Tasks.isOpen(e);
  })[0];
  if (exam)
    out.push({
      label: "Quiz me for " + exam.title,
      q:
        "Give me 5 practice questions to test myself for " +
        exam.title +
        ", then show the answers separately.",
    });
  out.push({ label: "Build my study plan", q: "__plan__" });
  return out;
}

export function afterAssistant(root) {
  const log = q("#chatLog", root);
  if (log) log.scrollTop = log.scrollHeight;
  const ta = q("#chatInput", root);
  if (ta) {
    ta.focus();
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
  }
}

export function sendChat(forced) {
  const ta = q("#chatInput");
  const text = forced || (ta ? ta.value.trim() : "");
  if (!text) return;
  if (ta) ta.value = "";
  const fresh = q("#chatFresh") && q("#chatFresh").checked;
  if (fresh) Store.db.chat = [];

  if (text === "__plan__") {
    requestStudyPlan();
    return;
  }

  if (UIState.chatPending) return;

  const lastMsg = Store.db.chat[Store.db.chat.length - 1];
  if (lastMsg && lastMsg.role === "user" && lastMsg.content === text) return;

  Store.db.chat.push({
    id: uid("msg"),
    role: "user",
    content: text,
    ts: Date.now(),
  });

  if (Store.db.chat.length > CFG.maxChatMessages) {
    Store.db.chat = Store.db.chat.slice(-CFG.maxChatMessages);
  }

  UIState.chatPending = true;
  Store.saveNow();
  Router.render();

  const chatHistory = Store.db.chat.slice(0, -1);
  AI.answer(text, { k: 5, chatHistory, docIds: UIState.chatSources || [] })
    .then(function (res) {
      Store.db.chat.push({
        id: uid("msg"),
        role: "assistant",
        content: res.text,
        ts: Date.now(),
        citations: (res.sources || []).slice(0, 4),
        mode: res.mode,
        model: res.model || null,
      });
      UIState.chatPending = false;
      Store.saveNow();
      Router.render();
      if (res.aiError)
        toast(
          res.aiError,
          "warn",
          "AI service busy - answered from your documents",
        );
    })
    .catch(function (e) {
      UIState.chatPending = false;
      Store.db.chat.push({
        id: uid("msg"),
        role: "assistant",
        content: "Something went wrong answering that: " + (e.message || e),
        ts: Date.now(),
        mode: "offline",
      });
      Store.saveNow();
      Router.render();
    });
}

export function requestStudyPlan() {
  Store.db.chat.push({
    id: uid("msg"),
    role: "user",
    content: "Build me a personalised study plan for the coming weeks.",
    ts: Date.now(),
  });
  UIState.chatPending = true;
  Router.render();
  AI.studyPlan()
    .then(function (res) {
      Store.db.chat.push({
        id: uid("msg"),
        role: "assistant",
        content: res.text,
        ts: Date.now(),
        mode: res.mode,
      });
      UIState.chatPending = false;
      Store.saveNow();
      Router.render();
      if (res.aiError)
        toast(
          "AI request failed, using the built-in planner. " + res.aiError,
          "warn",
        );
    })
    .catch(function () {
      UIState.chatPending = false;
      toast("Study plan request failed.", "bad");
      Router.render();
    });
}

export const assistantView = {
  title: "AI study assistant",
  fn: assistant,
  after: afterAssistant,
};
