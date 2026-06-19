<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useChatSSE } from '../composables/useChatSSE';
import { useChatStore } from '../stores/chat';
import type { ThinkingStep } from '../types';

definePageMeta({ layout: false });

const { sendMessage, isStreaming, error } = useChatSSE();
const chatStore = useChatStore();

const inputText = ref('');
const chatBodyRef = ref<HTMLDivElement>();
const showSteps = ref<Record<string, boolean>>({});

// 快捷提问示例
const quickPrompts = [
  '周末两天适合去哪里玩？',
  '帮我找北京故宫附近500以内的酒店',
  '明天从上海去杭州的火车票',
  '上海迪士尼两大一小门票',
];

// 自动滚动到底部
watch(
  () => [chatStore.messages.length, chatStore.messages.map(m => m.content).join('')],
  async () => {
    await nextTick();
    scrollToBottom();
  },
);

function scrollToBottom() {
  if (chatBodyRef.value) {
    chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight;
  }
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;
  inputText.value = '';
  await sendMessage(text);
  scrollToBottom();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleQuickPrompt(prompt: string) {
  inputText.value = prompt;
  handleSend();
}

function toggleSteps(msgId: string) {
  showSteps.value[msgId] = !showSteps.value[msgId];
}

// ---- Markdown 渲染 ----
function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = text
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 图片 ![](url) — 必须在链接之前处理
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    return `<img src="${url}" alt="${alt}" loading="lazy" class="md-image" onerror="this.style.display='none'" />`;
  });

  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');

  // 粗体 **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 行内代码 `code`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 处理换行：双换行变段落，单换行变 <br>
  html = html
    .split(/\n\n+/)
    .map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      // 跳过已经是块级元素的段落（图片、表格等）
      if (trimmed.startsWith('<img')) return trimmed;
      return `<p class="md-paragraph">${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  return html;
}

// ---- 工具步骤格式化 ----
function getStepIcon(step: ThinkingStep): string {
  switch (step.type) {
    case 'thought': return '🤔';
    case 'action': return '🔧';
    case 'observation': return '📊';
    case 'plan_partial': return '📋';
    default: return '•';
  }
}

function getStepLabel(step: ThinkingStep): string {
  switch (step.type) {
    case 'thought': return '思考';
    case 'action': return `调用: ${step.tool || '?'}`;
    case 'observation': return '获取结果';
    case 'plan_partial': return '行程生成中';
    default: return step.type;
  }
}

function formatJSON(data: unknown): string {
  if (!data) return '';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
</script>

<template>
  <div class="chat-page">
    <!-- Header -->
    <header class="chat-header">
      <div class="header-left">
        <NuxtLink to="/" class="back-btn" title="返回行程规划">
          ← 返回
        </NuxtLink>
        <h1>🤖 AI 旅行助手</h1>
        <span class="subtitle">基于美团酒旅数据 · 支持酒店/门票/机票/攻略</span>
      </div>
      <NuxtLink to="/" class="planner-link">
        📋 行程规划器
      </NuxtLink>
    </header>

    <!-- 消息列表 -->
    <div class="chat-body" ref="chatBodyRef">
      <!-- 空状态 / 欢迎 -->
      <div class="welcome" v-if="chatStore.messages.length === 0">
        <div class="welcome-icon">🗺️</div>
        <h2>AI 旅行助手</h2>
        <p>我可以帮你查询国内酒店、景点门票、机票火车票、度假跟团等</p>
        <div class="quick-prompts">
          <button
            v-for="prompt in quickPrompts"
            :key="prompt"
            class="quick-prompt-btn"
            @click="handleQuickPrompt(prompt)"
            :disabled="isStreaming"
          >
            {{ prompt }}
          </button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div
        v-for="msg in chatStore.messages"
        :key="msg.id"
        :class="['message-wrapper', `msg-${msg.role}`]"
      >
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="user-bubble">
          {{ msg.content }}
        </div>

        <!-- 系统消息 -->
        <div v-else-if="msg.role === 'system'" class="system-bubble">
          {{ msg.content }}
        </div>

        <!-- AI 消息 -->
        <div v-else class="ai-message">
          <div class="ai-avatar">🤖</div>
          <div class="ai-body">
            <!-- 思考步骤（可折叠） -->
            <div v-if="msg.steps.length > 0" class="steps-section">
              <button class="steps-toggle" @click="toggleSteps(msg.id)">
                <span>
                  {{ showSteps[msg.id] ? '▾' : '▸' }}
                  Agent 思考过程 ({{ msg.steps.length }} 步)
                </span>
                <span v-if="msg.streaming" class="streaming-badge">进行中</span>
              </button>
              <div v-show="showSteps[msg.id]" class="steps-list">
                <div
                  v-for="(step, i) in msg.steps"
                  :key="i"
                  :class="['step-item', `step-${step.type}`]"
                >
                  <span class="step-icon">{{ getStepIcon(step) }}</span>
                  <span class="step-label">{{ getStepLabel(step) }}</span>
                  <span class="step-num">#{{ step.step }}</span>
                  <div v-if="step.args" class="step-detail">
                    参数: <code>{{ formatJSON(step.args) }}</code>
                  </div>
                  <div v-if="step.data" class="step-detail">
                    结果: <code>{{ formatJSON(step.data) }}</code>
                  </div>
                </div>
              </div>
            </div>

            <!-- AI 文本内容（Markdown 渲染） -->
            <div
              class="ai-content"
              v-html="renderMarkdown(msg.content)"
            ></div>

            <!-- 流式加载光标 -->
            <span v-if="msg.streaming" class="cursor-blink">▌</span>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div class="error-toast" v-if="error">
        {{ error }}
      </div>
    </div>

    <!-- 输入栏 -->
    <footer class="chat-footer">
      <div class="input-row">
        <textarea
          v-model="inputText"
          class="chat-input"
          placeholder="输入旅行需求，例如：帮我找三亚海边酒店、北京到上海的火车票..."
          rows="1"
          @keydown="handleKeydown"
          :disabled="isStreaming"
        ></textarea>
        <button
          class="send-btn"
          @click="handleSend"
          :disabled="isStreaming || !inputText.trim()"
        >
          {{ isStreaming ? '⏳' : '发送' }}
        </button>
      </div>
      <p class="input-hint">按 Enter 发送，Shift+Enter 换行</p>
    </footer>
  </div>
</template>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

/* ---- Header ---- */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--bg-panel);
  transition: all 0.15s;
}

.back-btn:hover {
  color: var(--primary);
  background: #eff6ff;
}

.chat-header h1 {
  font-size: 18px;
  font-weight: 700;
}

.subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 4px;
}

.planner-link {
  font-size: 13px;
  color: var(--primary);
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 6px;
  background: #eff6ff;
  transition: all 0.15s;
  font-weight: 500;
}

.planner-link:hover {
  background: #dbeafe;
}

/* ---- Body ---- */
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Welcome */
.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  text-align: center;
}

.welcome-icon {
  font-size: 56px;
}

.welcome h2 {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome p {
  color: var(--text-secondary);
  font-size: 14px;
  max-width: 460px;
}

.quick-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
  max-width: 600px;
}

.quick-prompt-btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--bg-card);
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s;
}

.quick-prompt-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: #eff6ff;
}

.quick-prompt-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Messages ---- */
.message-wrapper {
  max-width: 85%;
}

.msg-user {
  align-self: flex-end;
}

.msg-assistant {
  align-self: flex-start;
}

.msg-system {
  align-self: center;
}

.user-bubble {
  background: linear-gradient(135deg, var(--primary), #7c3aed);
  color: white;
  padding: 10px 18px;
  border-radius: 18px 18px 4px 18px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.system-bubble {
  background: #fef3c7;
  color: #92400e;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  text-align: center;
}

/* AI message */
.ai-message {
  display: flex;
  gap: 10px;
}

.ai-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-panel);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.ai-body {
  flex: 1;
  min-width: 0;
}

.ai-content {
  font-size: 14px;
  line-height: 1.65;
  color: var(--text);
}

/* AI content rendered markdown styles */
.ai-content :deep(.md-paragraph) {
  margin-bottom: 8px;
}

.ai-content :deep(.md-link) {
  color: var(--primary);
  text-decoration: underline;
}

.ai-content :deep(.md-image) {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  margin: 8px 0;
  border: 1px solid var(--border);
}

.ai-content :deep(.inline-code) {
  background: var(--bg-panel);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, monospace;
}

.ai-content :deep(strong) {
  font-weight: 600;
}

.cursor-blink {
  animation: blink 1s step-end infinite;
  color: var(--primary);
  font-weight: 700;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* ---- Steps ---- */
.steps-section {
  margin-bottom: 8px;
}

.steps-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-panel);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.steps-toggle:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.streaming-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #dbeafe;
  color: var(--primary);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.steps-list {
  margin-top: 6px;
  padding: 6px 0;
  border-left: 2px solid var(--border);
  margin-left: 6px;
  padding-left: 12px;
}

.step-item {
  padding: 4px 0;
  font-size: 11px;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 4px;
  color: var(--text-secondary);
}

.step-icon {
  flex-shrink: 0;
}

.step-label {
  font-weight: 500;
}

.step-num {
  color: #94a3b8;
  font-size: 10px;
}

.step-detail {
  width: 100%;
  margin-top: 2px;
}

.step-detail code {
  display: block;
  font-size: 10px;
  background: rgba(0,0,0,.03);
  padding: 4px 8px;
  border-radius: 4px;
  max-height: 80px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.step-thought { border-left: 2px solid #8b5cf6; margin-left: -14px; padding-left: 12px; }
.step-action  { border-left: 2px solid #f59e0b; margin-left: -14px; padding-left: 12px; }
.step-observation { border-left: 2px solid #10b981; margin-left: -14px; padding-left: 12px; }

/* ---- Footer ---- */
.chat-footer {
  padding: 12px 20px 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.input-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  background: var(--bg-panel);
  color: var(--text);
  line-height: 1.5;
  max-height: 120px;
  transition: border-color 0.15s;
}

.chat-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.chat-input:disabled {
  opacity: 0.6;
}

.send-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, var(--primary), #7c3aed);
  color: white;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.input-hint {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 6px;
  margin-left: 4px;
}

.error-toast {
  padding: 10px 16px;
  background: #fef2f2;
  color: var(--error);
  border-radius: 8px;
  font-size: 13px;
  align-self: center;
}
</style>
