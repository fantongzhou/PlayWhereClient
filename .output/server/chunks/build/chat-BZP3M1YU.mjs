import { _ as __nuxt_component_0 } from './nuxt-link-DGXSYn1y.mjs';
import { defineComponent, ref, watch, nextTick, mergeProps, withCtx, createTextVNode, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrIncludeBooleanAttr, ssrRenderList, ssrInterpolate, ssrRenderClass, ssrRenderStyle } from 'vue/server-renderer';
import { _ as _export_sfc, d as defineStore } from './server.mjs';
import '../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '../routes/renderer.mjs';
import 'vue-bundle-renderer/runtime';
import 'unhead/server';
import 'devalue';
import 'unhead/utils';
import 'unhead/plugins';
import 'vue-router';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
const useChatStore = defineStore("chat", () => {
  const messages = ref([]);
  const loading = ref(false);
  const error = ref(null);
  function addUserMessage(content) {
    messages.value.push({
      id: uid(),
      role: "user",
      content,
      steps: [],
      streaming: false,
      timestamp: Date.now()
    });
  }
  function createAssistantMessage() {
    const id = uid();
    messages.value.push({
      id,
      role: "assistant",
      content: "",
      steps: [],
      streaming: true,
      timestamp: Date.now()
    });
    return id;
  }
  function appendContent(msgId, text) {
    const msg = messages.value.find((m) => m.id === msgId);
    if (msg) {
      msg.content += text;
    }
  }
  function appendStep(msgId, step) {
    const msg = messages.value.find((m) => m.id === msgId);
    if (msg) {
      msg.steps.push(step);
    }
  }
  function finishMessage(msgId) {
    const msg = messages.value.find((m) => m.id === msgId);
    if (msg) {
      msg.streaming = false;
    }
  }
  function addSystemMessage(content) {
    messages.value.push({
      id: uid(),
      role: "system",
      content,
      steps: [],
      streaming: false,
      timestamp: Date.now()
    });
  }
  function clearMessages() {
    messages.value = [];
    error.value = null;
  }
  return {
    messages,
    loading,
    error,
    addUserMessage,
    createAssistantMessage,
    appendContent,
    appendStep,
    finishMessage,
    addSystemMessage,
    clearMessages
  };
});
function useChatSSE() {
  const isStreaming = ref(false);
  const error = ref(null);
  const chatStore = useChatStore();
  function getOrCreateSessionId() {
    const stored = localStorage.getItem("chat_session_id");
    if (stored) return stored;
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("chat_session_id", newId);
    return newId;
  }
  async function sendMessage(message) {
    var _a, _b;
    if (!message.trim()) return;
    isStreaming.value = true;
    error.value = null;
    chatStore.loading = true;
    chatStore.addUserMessage(message);
    const assistantId = chatStore.createAssistantMessage();
    const sessionId = getOrCreateSessionId();
    try {
      const response = await fetch("/api/plan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const reader = (_a = response.body) == null ? void 0 : _a.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              switch (event.type) {
                case "start":
                  if ((_b = event.data) == null ? void 0 : _b.sessionId) {
                    localStorage.setItem("chat_session_id", event.data.sessionId);
                  }
                  break;
                case "thought":
                  if (event.content) {
                    chatStore.appendContent(assistantId, event.content);
                  }
                  chatStore.appendStep(assistantId, {
                    type: "thought",
                    step: event.step || 0,
                    content: event.content
                  });
                  break;
                case "action":
                  chatStore.appendStep(assistantId, {
                    type: "action",
                    step: event.step || 0,
                    tool: event.tool,
                    args: event.args
                  });
                  break;
                case "observation":
                  chatStore.appendStep(assistantId, {
                    type: "observation",
                    step: event.step || 0,
                    data: event.data
                  });
                  break;
                case "plan_complete":
                  chatStore.finishMessage(assistantId);
                  break;
                case "error":
                  error.value = event.message || "\u672A\u77E5\u9519\u8BEF";
                  chatStore.appendContent(assistantId, `

\u26A0\uFE0F ${event.message}`);
                  chatStore.finishMessage(assistantId);
                  break;
                default:
                  if (event.content) {
                    chatStore.appendContent(assistantId, event.content);
                  }
                  chatStore.appendStep(assistantId, {
                    type: event.type || "thought",
                    step: event.step || 0,
                    content: event.content,
                    tool: event.tool,
                    args: event.args,
                    data: event.data
                  });
              }
            } catch {
            }
          }
        }
      }
    } catch (e) {
      error.value = e.message;
      chatStore.appendContent(assistantId, `

\u26A0\uFE0F \u8BF7\u6C42\u5931\u8D25\uFF1A${e.message}`);
      chatStore.finishMessage(assistantId);
    } finally {
      isStreaming.value = false;
      chatStore.loading = false;
    }
  }
  async function clearMemory() {
    const sessionId = localStorage.getItem("chat_session_id");
    if (sessionId) {
      try {
        await fetch(`/api/plan/chat/memory?sessionId=${encodeURIComponent(sessionId)}`, {
          method: "DELETE"
        });
      } catch {
      }
    }
    localStorage.removeItem("chat_session_id");
  }
  return { isStreaming, error, sendMessage, clearMemory };
}
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "chat",
  __ssrInlineRender: true,
  setup(__props) {
    const { isStreaming, error } = useChatSSE();
    const chatStore = useChatStore();
    const inputText = ref("");
    const chatBodyRef = ref();
    const showSteps = ref({});
    const quickPrompts = [
      "\u5468\u672B\u4E24\u5929\u9002\u5408\u53BB\u54EA\u91CC\u73A9\uFF1F",
      "\u5E2E\u6211\u627E\u5317\u4EAC\u6545\u5BAB\u9644\u8FD1500\u4EE5\u5185\u7684\u9152\u5E97",
      "\u660E\u5929\u4ECE\u4E0A\u6D77\u53BB\u676D\u5DDE\u7684\u706B\u8F66\u7968",
      "\u4E0A\u6D77\u8FEA\u58EB\u5C3C\u4E24\u5927\u4E00\u5C0F\u95E8\u7968"
    ];
    watch(
      () => [chatStore.messages.length, chatStore.messages.map((m) => m.content).join("")],
      async () => {
        await nextTick();
        scrollToBottom();
      }
    );
    function scrollToBottom() {
      if (chatBodyRef.value) {
        chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight;
      }
    }
    function renderMarkdown(text) {
      if (!text) return "";
      let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
        const escapedUrl = url.replace(/"/g, "&quot;");
        return `<img src="${escapedUrl}" alt="${alt || "\u56FE\u7247"}" loading="lazy" class="md-image" onerror="this.style.display='none'" />`;
      });
      html = html.replace(
        new RegExp(`(?<!src=")(https?:\\/\\/[^\\s<>"']+\\.(?:jpg|jpeg|png|webp)(?:\\?[^\\s<>"']*)?)`, "gi"),
        (match, url) => {
          return `<img src="${url}" alt="\u56FE\u7247" loading="lazy" class="md-image" onerror="this.style.display='none'" />`;
        }
      );
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');
      html = html.replace(
        new RegExp(`(?<![">])(?<!href=")(?<!src=")(https?:\\/\\/[^\\s<>"'\\n]+)`, "g"),
        (match) => {
          if (match.endsWith(".jpg") || match.endsWith(".jpeg") || match.endsWith(".png") || match.endsWith(".webp")) {
            return match;
          }
          const display = match.length > 60 ? match.slice(0, 57) + "..." : match;
          return `<a href="${match}" target="_blank" rel="noopener" class="md-link">${display}</a>`;
        }
      );
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
      html = renderTables(html);
      html = html.split(/\n\n+/).map((para) => {
        const trimmed = para.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("<img") || trimmed.startsWith("<table")) return trimmed;
        return `<p class="md-paragraph">${trimmed.replace(/\n/g, "<br>")}</p>`;
      }).join("");
      return html;
    }
    function renderTables(html) {
      const lines = html.split("\n");
      const result = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (line.trim().startsWith("|") && line.includes("|")) {
          const tableRows = [line];
          let j = i + 1;
          while (j < lines.length && lines[j].trim().startsWith("|") && lines[j].includes("|")) {
            tableRows.push(lines[j]);
            j++;
          }
          if (tableRows.length >= 2) {
            const tableHtml = buildTable(tableRows);
            if (tableHtml) {
              result.push(tableHtml);
              i = j;
              continue;
            }
          }
        }
        result.push(line);
        i++;
      }
      return result.join("\n");
    }
    function buildTable(rows) {
      if (rows.length < 2) return null;
      const parseRow = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const isSeparator = (row) => /^\|[\s\-:]+\|[\s\-:|]*\|?$/.test(row);
      const headerCells = parseRow(rows[0]);
      let dataStart = 1;
      if (isSeparator(rows[1])) {
        dataStart = 2;
      }
      const dataRows = rows.slice(dataStart).map(parseRow);
      if (dataRows.length === 0) return null;
      let tableHtml = '<table class="md-table"><thead><tr>';
      for (const cell of headerCells) {
        tableHtml += `<th>${cell}</th>`;
      }
      tableHtml += "</tr></thead><tbody>";
      for (const row of dataRows) {
        tableHtml += "<tr>";
        for (let c = 0; c < headerCells.length; c++) {
          tableHtml += `<td>${row[c] || ""}</td>`;
        }
        tableHtml += "</tr>";
      }
      tableHtml += "</tbody></table>";
      return tableHtml;
    }
    function getStepIcon(step) {
      switch (step.type) {
        case "thought":
          return "\u{1F914}";
        case "action":
          return "\u{1F527}";
        case "observation":
          return "\u{1F4CA}";
        case "plan_partial":
          return "\u{1F4CB}";
        default:
          return "\u2022";
      }
    }
    function getStepLabel(step) {
      switch (step.type) {
        case "thought":
          return "\u601D\u8003";
        case "action":
          return `\u8C03\u7528: ${step.tool || "?"}`;
        case "observation":
          return "\u83B7\u53D6\u7ED3\u679C";
        case "plan_partial":
          return "\u884C\u7A0B\u751F\u6210\u4E2D";
        default:
          return step.type;
      }
    }
    function formatJSON(data) {
      if (!data) return "";
      try {
        return JSON.stringify(data, null, 2);
      } catch {
        return String(data);
      }
    }
    return (_ctx, _push, _parent, _attrs) => {
      const _component_NuxtLink = __nuxt_component_0;
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "chat-page" }, _attrs))} data-v-aa471ad8><header class="chat-header" data-v-aa471ad8><div class="header-left" data-v-aa471ad8>`);
      _push(ssrRenderComponent(_component_NuxtLink, {
        to: "/",
        class: "back-btn",
        title: "\u8FD4\u56DE\u884C\u7A0B\u89C4\u5212"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(` \u2190 \u8FD4\u56DE `);
          } else {
            return [
              createTextVNode(" \u2190 \u8FD4\u56DE ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`<h1 data-v-aa471ad8>\u{1F916} AI \u65C5\u884C\u52A9\u624B</h1><span class="subtitle" data-v-aa471ad8>\u57FA\u4E8E\u7F8E\u56E2\u9152\u65C5\u6570\u636E \xB7 \u652F\u6301\u9152\u5E97/\u95E8\u7968/\u673A\u7968/\u653B\u7565</span></div><div class="header-right" data-v-aa471ad8><button class="new-chat-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} title="\u5F00\u59CB\u65B0\u5BF9\u8BDD\uFF08\u6E05\u9664\u8BB0\u5FC6\uFF09" data-v-aa471ad8> \u{1F195} \u65B0\u5BF9\u8BDD </button>`);
      _push(ssrRenderComponent(_component_NuxtLink, {
        to: "/",
        class: "planner-link"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(` \u{1F4CB} \u884C\u7A0B\u89C4\u5212\u5668 `);
          } else {
            return [
              createTextVNode(" \u{1F4CB} \u884C\u7A0B\u89C4\u5212\u5668 ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div></header><div class="chat-body" data-v-aa471ad8>`);
      if (unref(chatStore).messages.length === 0) {
        _push(`<div class="welcome" data-v-aa471ad8><div class="welcome-icon" data-v-aa471ad8>\u{1F5FA}\uFE0F</div><h2 data-v-aa471ad8>AI \u65C5\u884C\u52A9\u624B</h2><p data-v-aa471ad8>\u6211\u53EF\u4EE5\u5E2E\u4F60\u67E5\u8BE2\u56FD\u5185\u9152\u5E97\u3001\u666F\u70B9\u95E8\u7968\u3001\u673A\u7968\u706B\u8F66\u7968\u3001\u5EA6\u5047\u8DDF\u56E2\u7B49</p><div class="quick-prompts" data-v-aa471ad8><!--[-->`);
        ssrRenderList(quickPrompts, (prompt) => {
          _push(`<button class="quick-prompt-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-aa471ad8>${ssrInterpolate(prompt)}</button>`);
        });
        _push(`<!--]--></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<!--[-->`);
      ssrRenderList(unref(chatStore).messages, (msg) => {
        var _a;
        _push(`<div class="${ssrRenderClass(["message-wrapper", `msg-${msg.role}`])}" data-v-aa471ad8>`);
        if (msg.role === "user") {
          _push(`<div class="user-bubble" data-v-aa471ad8>${ssrInterpolate(msg.content)}</div>`);
        } else if (msg.role === "system") {
          _push(`<div class="system-bubble" data-v-aa471ad8>${ssrInterpolate(msg.content)}</div>`);
        } else {
          _push(`<div class="ai-message" data-v-aa471ad8><div class="ai-avatar" data-v-aa471ad8>\u{1F916}</div><div class="ai-body" data-v-aa471ad8>`);
          if (msg.steps.length > 0) {
            _push(`<div class="steps-section" data-v-aa471ad8><button class="steps-toggle" data-v-aa471ad8><span data-v-aa471ad8>${ssrInterpolate(showSteps.value[msg.id] ? "\u25BE" : "\u25B8")} Agent \u601D\u8003\u8FC7\u7A0B (${ssrInterpolate(msg.steps.length)} \u6B65) </span>`);
            if (msg.streaming) {
              _push(`<span class="streaming-badge" data-v-aa471ad8>\u8FDB\u884C\u4E2D</span>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</button><div class="steps-list" style="${ssrRenderStyle(showSteps.value[msg.id] ? null : { display: "none" })}" data-v-aa471ad8><!--[-->`);
            ssrRenderList(msg.steps, (step, i) => {
              _push(`<div class="${ssrRenderClass(["step-item", `step-${step.type}`])}" data-v-aa471ad8><span class="step-icon" data-v-aa471ad8>${ssrInterpolate(getStepIcon(step))}</span><span class="step-label" data-v-aa471ad8>${ssrInterpolate(getStepLabel(step))}</span><span class="step-num" data-v-aa471ad8>#${ssrInterpolate(step.step)}</span>`);
              if (step.args) {
                _push(`<div class="step-detail" data-v-aa471ad8> \u53C2\u6570: <code data-v-aa471ad8>${ssrInterpolate(formatJSON(step.args))}</code></div>`);
              } else {
                _push(`<!---->`);
              }
              if (step.data) {
                _push(`<div class="step-detail" data-v-aa471ad8> \u7ED3\u679C: <code data-v-aa471ad8>${ssrInterpolate(formatJSON(step.data))}</code></div>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</div>`);
            });
            _push(`<!--]--></div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<div class="ai-content" data-v-aa471ad8>${(_a = renderMarkdown(msg.content)) != null ? _a : ""}</div>`);
          if (msg.streaming) {
            _push(`<span class="cursor-blink" data-v-aa471ad8>\u258C</span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div>`);
        }
        _push(`</div>`);
      });
      _push(`<!--]-->`);
      if (unref(error)) {
        _push(`<div class="error-toast" data-v-aa471ad8>${ssrInterpolate(unref(error))}</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div><footer class="chat-footer" data-v-aa471ad8><div class="input-row" data-v-aa471ad8><textarea class="chat-input" placeholder="\u8F93\u5165\u65C5\u884C\u9700\u6C42\uFF0C\u4F8B\u5982\uFF1A\u5E2E\u6211\u627E\u4E09\u4E9A\u6D77\u8FB9\u9152\u5E97\u3001\u5317\u4EAC\u5230\u4E0A\u6D77\u7684\u706B\u8F66\u7968..." rows="1"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-aa471ad8>${ssrInterpolate(inputText.value)}</textarea><button class="send-btn"${ssrIncludeBooleanAttr(unref(isStreaming) || !inputText.value.trim()) ? " disabled" : ""} data-v-aa471ad8>${ssrInterpolate(unref(isStreaming) ? "\u23F3" : "\u53D1\u9001")}</button></div><p class="input-hint" data-v-aa471ad8>\u6309 Enter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C</p></footer></div>`);
    };
  }
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/chat.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const chat = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-aa471ad8"]]);

export { chat as default };
//# sourceMappingURL=chat-BZP3M1YU.mjs.map
