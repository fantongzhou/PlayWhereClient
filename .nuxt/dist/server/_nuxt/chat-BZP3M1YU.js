import { _ as __nuxt_component_0 } from "./nuxt-link-DGXSYn1y.js";
import { ref, defineComponent, watch, nextTick, mergeProps, withCtx, createTextVNode, unref, useSSRContext } from "vue";
import { ssrRenderAttrs, ssrRenderComponent, ssrIncludeBooleanAttr, ssrRenderList, ssrInterpolate, ssrRenderClass, ssrRenderStyle } from "vue/server-renderer";
import { d as defineStore, _ as _export_sfc } from "../server.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/hookable/dist/index.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/ufo/dist/index.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/defu/dist/defu.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/ofetch/dist/node.mjs";
import "#internal/nuxt/paths";
import "/Users/tongzhoufan/travel-agent/client/node_modules/unctx/dist/index.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/h3/dist/index.mjs";
import "vue-router";
import "/Users/tongzhoufan/travel-agent/client/node_modules/klona/dist/index.mjs";
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
      const reader = response.body?.getReader();
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
                  if (event.data?.sessionId) {
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
                  error.value = event.message || "未知错误";
                  chatStore.appendContent(assistantId, `

⚠️ ${event.message}`);
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

⚠️ 请求失败：${e.message}`);
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
      "周末两天适合去哪里玩？",
      "帮我找北京故宫附近500以内的酒店",
      "明天从上海去杭州的火车票",
      "上海迪士尼两大一小门票"
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
        return `<img src="${escapedUrl}" alt="${alt || "图片"}" loading="lazy" class="md-image" onerror="this.style.display='none'" />`;
      });
      html = html.replace(
        new RegExp(`(?<!src=")(https?:\\/\\/[^\\s<>"']+\\.(?:jpg|jpeg|png|webp)(?:\\?[^\\s<>"']*)?)`, "gi"),
        (match, url) => {
          return `<img src="${url}" alt="图片" loading="lazy" class="md-image" onerror="this.style.display='none'" />`;
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
          return "🤔";
        case "action":
          return "🔧";
        case "observation":
          return "📊";
        case "plan_partial":
          return "📋";
        default:
          return "•";
      }
    }
    function getStepLabel(step) {
      switch (step.type) {
        case "thought":
          return "思考";
        case "action":
          return `调用: ${step.tool || "?"}`;
        case "observation":
          return "获取结果";
        case "plan_partial":
          return "行程生成中";
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
        title: "返回行程规划"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(` ← 返回 `);
          } else {
            return [
              createTextVNode(" ← 返回 ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`<h1 data-v-aa471ad8>🤖 AI 旅行助手</h1><span class="subtitle" data-v-aa471ad8>基于美团酒旅数据 · 支持酒店/门票/机票/攻略</span></div><div class="header-right" data-v-aa471ad8><button class="new-chat-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} title="开始新对话（清除记忆）" data-v-aa471ad8> 🆕 新对话 </button>`);
      _push(ssrRenderComponent(_component_NuxtLink, {
        to: "/",
        class: "planner-link"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(` 📋 行程规划器 `);
          } else {
            return [
              createTextVNode(" 📋 行程规划器 ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div></header><div class="chat-body" data-v-aa471ad8>`);
      if (unref(chatStore).messages.length === 0) {
        _push(`<div class="welcome" data-v-aa471ad8><div class="welcome-icon" data-v-aa471ad8>🗺️</div><h2 data-v-aa471ad8>AI 旅行助手</h2><p data-v-aa471ad8>我可以帮你查询国内酒店、景点门票、机票火车票、度假跟团等</p><div class="quick-prompts" data-v-aa471ad8><!--[-->`);
        ssrRenderList(quickPrompts, (prompt) => {
          _push(`<button class="quick-prompt-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-aa471ad8>${ssrInterpolate(prompt)}</button>`);
        });
        _push(`<!--]--></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<!--[-->`);
      ssrRenderList(unref(chatStore).messages, (msg) => {
        _push(`<div class="${ssrRenderClass(["message-wrapper", `msg-${msg.role}`])}" data-v-aa471ad8>`);
        if (msg.role === "user") {
          _push(`<div class="user-bubble" data-v-aa471ad8>${ssrInterpolate(msg.content)}</div>`);
        } else if (msg.role === "system") {
          _push(`<div class="system-bubble" data-v-aa471ad8>${ssrInterpolate(msg.content)}</div>`);
        } else {
          _push(`<div class="ai-message" data-v-aa471ad8><div class="ai-avatar" data-v-aa471ad8>🤖</div><div class="ai-body" data-v-aa471ad8>`);
          if (msg.steps.length > 0) {
            _push(`<div class="steps-section" data-v-aa471ad8><button class="steps-toggle" data-v-aa471ad8><span data-v-aa471ad8>${ssrInterpolate(showSteps.value[msg.id] ? "▾" : "▸")} Agent 思考过程 (${ssrInterpolate(msg.steps.length)} 步) </span>`);
            if (msg.streaming) {
              _push(`<span class="streaming-badge" data-v-aa471ad8>进行中</span>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</button><div class="steps-list" style="${ssrRenderStyle(showSteps.value[msg.id] ? null : { display: "none" })}" data-v-aa471ad8><!--[-->`);
            ssrRenderList(msg.steps, (step, i) => {
              _push(`<div class="${ssrRenderClass(["step-item", `step-${step.type}`])}" data-v-aa471ad8><span class="step-icon" data-v-aa471ad8>${ssrInterpolate(getStepIcon(step))}</span><span class="step-label" data-v-aa471ad8>${ssrInterpolate(getStepLabel(step))}</span><span class="step-num" data-v-aa471ad8>#${ssrInterpolate(step.step)}</span>`);
              if (step.args) {
                _push(`<div class="step-detail" data-v-aa471ad8> 参数: <code data-v-aa471ad8>${ssrInterpolate(formatJSON(step.args))}</code></div>`);
              } else {
                _push(`<!---->`);
              }
              if (step.data) {
                _push(`<div class="step-detail" data-v-aa471ad8> 结果: <code data-v-aa471ad8>${ssrInterpolate(formatJSON(step.data))}</code></div>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</div>`);
            });
            _push(`<!--]--></div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<div class="ai-content" data-v-aa471ad8>${renderMarkdown(msg.content) ?? ""}</div>`);
          if (msg.streaming) {
            _push(`<span class="cursor-blink" data-v-aa471ad8>▌</span>`);
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
      _push(`</div><footer class="chat-footer" data-v-aa471ad8><div class="input-row" data-v-aa471ad8><textarea class="chat-input" placeholder="输入旅行需求，例如：帮我找三亚海边酒店、北京到上海的火车票..." rows="1"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-aa471ad8>${ssrInterpolate(inputText.value)}</textarea><button class="send-btn"${ssrIncludeBooleanAttr(unref(isStreaming) || !inputText.value.trim()) ? " disabled" : ""} data-v-aa471ad8>${ssrInterpolate(unref(isStreaming) ? "⏳" : "发送")}</button></div><p class="input-hint" data-v-aa471ad8>按 Enter 发送，Shift+Enter 换行</p></footer></div>`);
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
export {
  chat as default
};
//# sourceMappingURL=chat-BZP3M1YU.js.map
