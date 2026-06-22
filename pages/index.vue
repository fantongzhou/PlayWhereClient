<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useTripStore } from '../stores/trip';
import type { ThinkingStep } from '../types';

definePageMeta({ layout: false });

const tripStore = useTripStore();
const apiBase = useApiBase();

// ---- 本地消息状态（替代 chatStore） ----
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingContent: string;
  steps: ThinkingStep[];
  streaming: boolean;
  timestamp: number;
}
let msgCounter = 0;
function uid() { return `msg_${Date.now()}_${msgCounter++}_${Math.random().toString(36).slice(2, 6)}`; }

const messages = ref<Message[]>([]);
const isStreaming = ref(false);
const error = ref<string | null>(null);

// 短期记忆：跨请求保持 sessionId
function getOrCreateSessionId(): string {
  const stored = localStorage.getItem('plan_session_id');
  if (stored) return stored;
  const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('plan_session_id', newId);
  return newId;
}

const inputText = ref('');
const chatBodyRef = ref<HTMLDivElement>();
const showSteps = ref<Record<string, boolean>>({});
const hasPlan = computed(() => !!tripStore.plan && tripStore.plan.days.length > 0);

// 快捷提示
const quickPrompts = [
  '周末两天适合去哪里玩？',
  '帮我规划北京3日游，喜欢历史文化，预算中等',
  '三亚4天海滨度假，预算不限',
  '成都美食之旅，3天，预算实惠',
];

// 自动滚动
watch(
  () => [messages.value.length, messages.value.map(m => m.content).join('')],
  async () => { await nextTick(); scrollToBottom(); },
);

function scrollToBottom() {
  if (chatBodyRef.value) {
    chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight;
  }
}

// ---- 打断控制器 ----
let abortController: AbortController | null = null;

function stopGeneration() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

// 页面关闭时自动打断
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', stopGeneration);
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;
  inputText.value = '';
  error.value = null;
  isStreaming.value = true;

  // 添加用户消息
  messages.value.push({ id: uid(), role: 'user', content: text, thinkingContent: '', steps: [], streaming: false, timestamp: Date.now() });

  // 创建助手消息占位
  const assistantId = uid();
  messages.value.push({ id: assistantId, role: 'assistant', content: '', thinkingContent: '', steps: [], streaming: true, timestamp: Date.now() });

  const sessionId = getOrCreateSessionId();

  // 创建 AbortController
  abortController = new AbortController();

  // ---- RAF 批量更新缓冲区（双通道：response → 聊天气泡，thought → 思考面板） ----
  let contentBuffer = '';
  let thinkingBuffer = '';
  let rafId: number | null = null;
  let lastFlush = 0;

  function flushAll() {
    const msg = messages.value.find(m => m.id === assistantId);
    if (!msg) { rafId = null; return; }
    if (contentBuffer) { msg.content += contentBuffer; contentBuffer = ''; }
    if (thinkingBuffer) { msg.thinkingContent += thinkingBuffer; thinkingBuffer = ''; }
    rafId = null;
  }

  function scheduleFlush() {
    if (rafId !== null) return;
    const now = performance.now();
    if (now - lastFlush < 50) {
      rafId = requestAnimationFrame(() => {
        flushAll();
        lastFlush = performance.now();
      });
    } else {
      flushAll();
      lastFlush = now;
    }
  }

  try {
    const response = await fetch(`${apiBase}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, sessionId }),
      signal: abortController.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body not readable');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          const msg = messages.value.find(m => m.id === assistantId);
          if (!msg) continue;

          switch (event.type) {
            case 'start':
              if (event.data?.sessionId) {
                localStorage.setItem('plan_session_id', event.data.sessionId);
              }
              if (event.message) {
                contentBuffer += event.message;
                scheduleFlush();
              }
              break;
            case 'thought':
              // 推理过程 → 进思考面板（thinkingContent）
              if (event.content) {
                thinkingBuffer += event.content;
                scheduleFlush();
              }
              break;
            case 'response':
              // 最终回答 → 进聊天气泡
              if (event.content) {
                contentBuffer += event.content;
                scheduleFlush();
              }
              break;
            case 'action':
              msg.steps.push({ type: 'action', step: event.step || 0, tool: event.tool, args: event.args });
              break;
            case 'observation':
              msg.steps.push({ type: 'observation', step: event.step || 0, data: event.data });
              break;
            case 'plan_partial':
              msg.steps.push({ type: 'plan_partial', step: event.step || 0, data: event.data });
              break;
            case 'plan_complete':
              flushAll();
              msg.streaming = false;
              if (event.plan && event.plan.days?.length > 0) {
                tripStore.setPlan(event.plan);
                msg.content = buildPlanSummary(event.plan);
              } else if (msg.content.trim().startsWith('{')) {
                msg.content = '⚠️ 未能生成有效行程，请重新描述您的需求';
              }
              break;
            case 'error':
              flushAll();
              error.value = event.message;
              msg.content += `\n\n⚠️ ${event.message}`;
              msg.streaming = false;
              break;
          }
        } catch { /* ignore parse errors */ }
      }
    }
    // 流正常结束，flush 剩余内容
    flushAll();
  } catch (e: any) {
    flushAll();
    const msg = messages.value.find(m => m.id === assistantId);
    if (e.name === 'AbortError') {
      // 用户打断 — 保留已有内容，标记中断
      if (msg && msg.content) {
        msg.content += '\n\n---\n⏸️ *已中断*';
      } else if (msg) {
        msg.content = '⏸️ 已取消';
      }
      msg && (msg.streaming = false);
    } else {
      error.value = e.message;
      if (msg) {
        msg.content += `\n\n⚠️ 请求失败：${e.message}`;
        msg.streaming = false;
      }
    }
  } finally {
    abortController = null;
    isStreaming.value = false;
    scrollToBottom();
  }
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

function handleNewChat() {
  messages.value = [];
  tripStore.setPlan({ city: '', days: [], totalBudget: '', tips: [] });
  localStorage.removeItem('plan_session_id');
}

function toggleSteps(msgId: string) {
  showSteps.value[msgId] = !showSteps.value[msgId];
}

// ---- 从 TripPlan 生成可读摘要（替代原始 JSON） ----
function buildPlanSummary(plan: any): string {
  const weatherIcon = (c: string) => {
    if (c.includes('晴')) return '☀️';
    if (c.includes('多云')) return '⛅';
    if (c.includes('阴')) return '☁️';
    if (c.includes('雨')) return '🌧️';
    if (c.includes('雪')) return '❄️';
    return '🌤️';
  };

  let md = `✅ 已为您规划好 **${plan.city}** **${plan.days.length}** 日行程！\n\n`;

  // 每日概览表
  md += `| 日期 | 天气 | 景点 | 午餐 | 晚餐 | 酒店 |\n`;
  md += `|------|------|------|------|------|------|\n`;
  for (const day of plan.days) {
    const date = (day.date || '').slice(5); // MM-DD
    const w = day.weather;
    const weatherStr = w ? `${weatherIcon(w.condition)} ${w.condition} ${w.temperature?.low}~${w.temperature?.high}°` : '-';
    const attractions = (day.activities || []).filter((a: any) => a.type === 'attraction').map((a: any) => a.name).join('<br>');
    const lunch = (day.activities || []).filter((a: any) => a.type === 'restaurant').map((a: any) => a.name).slice(0, 1).join('') || '-';
    const dinner = (day.activities || []).filter((a: any) => a.type === 'restaurant').map((a: any) => a.name).slice(1, 2).join('') || '-';
    const hotel = day.hotel?.name || '-';
    md += `| ${date} | ${weatherStr} | ${attractions} | ${lunch} | ${dinner} | ${hotel} |\n`;
  }

  md += `\n💵 **${plan.totalBudget || '请参考详细行程'}**\n`;

  if (plan.tips?.length > 0) {
    for (const tip of plan.tips) {
      md += `💡 ${tip}\n`;
    }
  }

  return md;
}

// ---- Markdown 渲染 ----
function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 1. 图片 ![](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) =>
    `<img src="${url.replace(/"/g, '&quot;')}" alt="${alt || '图片'}" loading="lazy" class="md-image" onerror="this.style.display='none'" />`);

  // 2. 裸图片 URL
  html = html.replace(/(?<!src=")(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|webp)(?:\?[^\s<>"']*)?)/gi,
    (_, url) => `<img src="${url}" alt="图片" loading="lazy" class="md-image" onerror="this.style.display='none'" />`);

  // 3. 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');

  // 4. 裸 URL → 链接
  html = html.replace(/(?<![">])(?<!href=")(?<!src=")(https?:\/\/[^\s<>"'\n]+)/g, (match) => {
    if (/\.(jpg|jpeg|png|webp)/i.test(match)) return match;
    const d = match.length > 60 ? match.slice(0, 57) + '...' : match;
    return `<a href="${match}" target="_blank" rel="noopener" class="md-link">${d}</a>`;
  });

  // 5. 粗体 **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 6. 行内代码 `code`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 7. 表格
  html = renderTables(html);

  // 8. 段落
  html = html.split(/\n\n+/).map(para => {
    const t = para.trim();
    if (!t) return '';
    if (t.startsWith('<img') || t.startsWith('<table')) return t;
    return `<p class="md-paragraph">${t.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

function renderTables(html: string): string {
  const lines = html.split('\n');
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|') && line.includes('|')) {
      const rows: string[] = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].includes('|')) { rows.push(lines[j]); j++; }
      if (rows.length >= 2) {
        const tbl = buildTable(rows);
        if (tbl) { result.push(tbl); i = j; continue; }
      }
    }
    result.push(line); i++;
  }
  return result.join('\n');
}

function buildTable(rows: string[]): string | null {
  if (rows.length < 2) return null;
  const parse = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const isSep = (r: string) => /^\|[\s\-:]+\|[\s\-:|]*\|?$/.test(r);
  const hdr = parse(rows[0]);
  let start = isSep(rows[1]) ? 2 : 1;
  const data = rows.slice(start).map(parse);
  if (!data.length) return null;
  let t = '<table class="md-table"><thead><tr>';
  for (const c of hdr) t += `<th>${c}</th>`;
  t += '</tr></thead><tbody>';
  for (const r of data) {
    t += '<tr>';
    for (let c = 0; c < hdr.length; c++) t += `<td>${r[c] || ''}</td>`;
    t += '</tr>';
  }
  t += '</tbody></table>';
  return t;
}

function getStepLabel(step: ThinkingStep): string {
  switch (step.type) {
    case 'action':
      if (step.tool === 'get_weather') return '正在查询目的地天气...';
      if (step.tool === 'search_meituan_travel') return '正在搜索美团旅行数据...';
      if (step.tool === 'get_route') return '正在规划交通路线...';
      return step.tool ? `调用 ${step.tool}` : '工具调用';
    case 'observation': return '已获取数据，正在分析...';
    case 'plan_partial': return step.data?.day ? `第 ${step.data.day} 天行程已生成` : '生成行程中...';
    default: return '';
  }
}
function getStepMeta(step: ThinkingStep): string {
  if (step.type === 'action' && step.args?.city) return `城市: ${step.args.city}`;
  if (step.type === 'observation') return '';
  if (step.type === 'plan_partial' && step.data?.date) return step.data.date;
  return '';
}
function formatJSON(obj: any): string {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}

// 初始化 routes（side effect）
useRoutes();
</script>

<template>
  <div class="planner">
    <!-- 聊天区域 -->
    <div class="chat-area" :class="{ shrunk: hasPlan }">
      <!-- 头部 -->
      <header class="chat-header">
        <div class="header-left">
          <h1>🤖 AI 旅行规划</h1>
          <span class="subtitle">基于美团酒旅真实数据 · 高德天气 · 实时对话</span>
        </div>
        <button class="new-chat-btn" @click="handleNewChat" :disabled="isStreaming">
          新对话
        </button>
      </header>

      <!-- 消息列表 -->
      <div class="chat-body" ref="chatBodyRef">
        <!-- 空状态 -->
        <div class="welcome" v-if="messages.length === 0">
          <div class="welcome-icon">🗺️</div>
          <h2>用自然语言描述您的旅行需求</h2>
          <p>我会自动分析目的地、天数、偏好，通过美团数据为您规划完美旅程</p>
          <div class="quick-prompts">
            <button
              v-for="qp in quickPrompts" :key="qp"
              class="quick-btn" @click="handleQuickPrompt(qp)"
            >{{ qp }}</button>
          </div>
        </div>

        <!-- 消息气泡 -->
        <div
          v-for="msg in messages" :key="msg.id"
          :class="['msg-row', `msg-${msg.role}`]"
        >
          <!-- 用户消息 -->
          <div v-if="msg.role === 'user'" class="user-bubble">
            {{ msg.content }}
          </div>

          <!-- AI 消息 -->
          <div v-else-if="msg.role === 'assistant'" class="ai-message">
            <div class="ai-avatar">🤖</div>
            <div class="ai-body">
              <!-- 深度思考（DeepSeek 风格折叠面板） -->
              <div v-if="msg.thinkingContent || msg.steps.length > 0" class="deep-think">
                <button class="think-header" @click="toggleSteps(msg.id)">
                  <span class="think-icon">{{ msg.streaming ? '🧠' : '✅' }}</span>
                  <span class="think-title">
                    {{ msg.streaming ? '深度思考中...' : `已完成深度思考 (${msg.steps.length} 步)` }}
                  </span>
                  <span class="think-chevron">{{ showSteps[msg.id] ? '▾' : '▸' }}</span>
                </button>
                <div :class="['think-body', { expanded: showSteps[msg.id] }]">
                  <!-- 思考文本内容 -->
                  <div v-if="msg.thinkingContent" class="think-text">{{ msg.thinkingContent }}</div>
                  <!-- 工具步骤 -->
                  <div
                    v-for="(step, si) in msg.steps" :key="si"
                    :class="['think-step', `step-${step.type}`]"
                  >
                    <span class="step-dot"></span>
                    <span class="step-text">{{ getStepLabel(step) }}</span>
                    <span class="step-meta">{{ getStepMeta(step) }}</span>
                  </div>
                </div>
              </div>

              <!-- AI 内容 -->
              <div :class="['ai-content', { streaming: msg.streaming }]" v-html="renderMarkdown(msg.content)" />
              <span v-if="msg.streaming" class="typing-cursor"></span>
            </div>
          </div>

          <!-- 系统消息 -->
          <div v-else-if="msg.role === 'system'" class="system-bubble">
            {{ msg.content }}
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="error-toast">⚠️ {{ error }}</div>
      </div>

      <!-- 输入框 -->
      <footer class="chat-footer">
        <div class="input-row">
          <textarea
            v-model="inputText"
            class="chat-input"
            placeholder="输入您的旅行需求，Enter 发送，Shift+Enter 换行..."
            :disabled="isStreaming"
            rows="2"
            @keydown="handleKeydown"
          />
          <!-- 流式输出中 → 显示打断按钮 -->
          <button
            v-if="isStreaming"
            class="stop-btn"
            @click="stopGeneration"
          >
            ⏹ 停止
          </button>
          <!-- 空闲 → 显示发送按钮 -->
          <button
            v-else
            class="send-btn"
            @click="handleSend"
            :disabled="!inputText.trim()"
          >
            发送
          </button>
        </div>
        <div class="input-hint">Agent 会自动分析城市、天数、偏好 · 信息不足时会追问</div>
      </footer>
    </div>

    <!-- 地图+时间线面板（规划完成后从右侧滑出） -->
    <div class="plan-panel" :class="{ visible: hasPlan }">
      <div class="map-section">
        <ClientOnly fallback-tag="div" fallback="地图加载中...">
          <TravelMap />
        </ClientOnly>
      </div>
      <div class="timeline-section">
        <TimelinePanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.planner {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

/* ---- 聊天区域 ---- */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: flex 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--bg);
}
.chat-area.shrunk {
  flex: 0 0 55%;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
  flex-shrink: 0;
}
.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.header-left h1 {
  font-size: 17px;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}
.subtitle {
  font-size: 11px;
  color: var(--text-secondary);
}
.new-chat-btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-panel);
  font-size: 13px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;
}
.new-chat-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.new-chat-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ---- 消息列表 ---- */
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 40px 20px;
}
.welcome-icon { font-size: 56px; }
.welcome h2 {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.welcome p { color: var(--text-secondary); font-size: 14px; max-width: 420px; }

.quick-prompts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; justify-content: center; }
.quick-btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--bg-card);
  font-size: 13px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;
}
.quick-btn:hover { border-color: var(--primary); color: var(--primary); }

/* ---- 消息气泡 ---- */
.msg-row { display: flex; }
.msg-user { justify-content: flex-end; }
.msg-assistant { justify-content: flex-start; }
.msg-system { justify-content: center; }

.user-bubble {
  max-width: 80%;
  padding: 10px 18px;
  border-radius: 18px 18px 4px 18px;
  background: linear-gradient(135deg, var(--primary), #7c3aed);
  color: white;
  font-size: 14px;
  line-height: 1.5;
}

.ai-message {
  display: flex;
  gap: 10px;
  max-width: 92%;
  width: 100%;
  animation: msg-fade-in 0.3s ease;
}
@keyframes msg-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ai-avatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: var(--bg-card);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  border: 1px solid var(--border);
}
.ai-body { flex: 1; min-width: 0; }

/* ---- DeepSeek 风格深度思考面板 ---- */
.deep-think {
  margin-bottom: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  background: #f9fafb;
}
.think-header {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 10px 14px;
  border: none; background: none;
  font-size: 13px; cursor: pointer;
  color: #6b7280; transition: background 0.15s;
}
.think-header:hover { background: #f3f4f6; }
.think-icon { font-size: 15px; }
.think-title { font-weight: 500; flex: 1; text-align: left; }
.think-chevron { font-size: 11px; color: #9ca3af; transition: transform 0.2s; }

.think-body {
  max-height: 0; overflow: hidden;
  transition: max-height 0.3s ease;
}
.think-body.expanded {
  max-height: 600px;
  overflow-y: auto;
}
.think-text {
  padding: 10px 14px;
  font-size: 13px; line-height: 1.6;
  color: #4b5563;
  white-space: pre-wrap;
  border-bottom: 1px solid #f3f4f6;
}

.think-step {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 14px 6px 24px;
  font-size: 12px; color: #6b7280;
  border-top: 1px solid #f3f4f6;
  position: relative;
}
.think-step:first-child { border-top: none; }
.step-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #d1d5db; flex-shrink: 0;
}
.step-action .step-dot { background: #f59e0b; }
.step-observation .step-dot { background: #10b981; }
.step-plan_partial .step-dot { background: #3b82f6; }
.step-text { flex: 1; }
.step-meta { font-size: 11px; color: #9ca3af; }

/* AI 内容 */
.ai-content { font-size: 14px; line-height: 1.6; color: var(--text); }
.ai-content :deep(.md-image) {
  max-width: 100%; max-height: 300px; border-radius: 8px; margin: 6px 0;
  display: block;
}
.ai-content :deep(.md-link) { color: var(--primary); text-decoration: underline; }
.ai-content :deep(.md-table) { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.ai-content :deep(.md-table th), .ai-content :deep(.md-table td) {
  border: 1px solid var(--border); padding: 6px 10px; text-align: left;
}
.ai-content :deep(.md-table th) { background: var(--bg-panel); font-weight: 600; }
.ai-content :deep(.md-paragraph) { margin: 4px 0; }
.ai-content :deep(.inline-code) {
  background: var(--bg-panel); padding: 1px 5px; border-radius: 4px; font-size: 12px;
}
/* DeepSeek 风格打字光标 */
.typing-cursor {
  display: inline-block;
  width: 2px; height: 18px;
  background: var(--primary);
  margin-left: 2px;
  vertical-align: text-bottom;
  border-radius: 1px;
  animation: cursor-blink 1s ease-in-out infinite;
}
@keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.ai-content.streaming {
  display: inline;
}

.system-bubble {
  padding: 8px 16px; border-radius: 8px;
  background: #fefce8; color: #a16207;
  font-size: 12px; max-width: 80%;
}

.error-toast {
  padding: 10px 16px; background: #fef2f2; color: #dc2626;
  border-radius: 8px; font-size: 13px;
}

/* ---- 输入框 ---- */
.chat-footer { padding: 12px 20px; border-top: 1px solid var(--border); background: var(--bg-card); flex-shrink: 0; }
.input-row { display: flex; gap: 8px; align-items: flex-end; }
.chat-input {
  flex: 1; padding: 10px 14px;
  border: 1px solid var(--border); border-radius: 12px;
  font-size: 14px; font-family: inherit; line-height: 1.5;
  resize: none; outline: none;
  background: var(--bg-panel); color: var(--text);
  min-height: 44px; max-height: 120px;
  transition: border-color 0.2s;
}
.chat-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
.chat-input:disabled { opacity: 0.6; }

.send-btn {
  padding: 10px 22px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, var(--primary), #7c3aed);
  color: white; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all 0.2s; flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
.send-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.stop-btn {
  padding: 10px 22px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all 0.2s; flex-shrink: 0;
  animation: pulse-stop 1.5s ease-in-out infinite;
}
.stop-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
@keyframes pulse-stop { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }

.input-hint { font-size: 11px; color: var(--text-secondary); opacity: 0.5; margin-top: 6px; }

/* ---- 地图+时间线侧边面板 ---- */
.plan-panel {
  width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--bg-card);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.plan-panel.visible {
  width: 45%;
}
.map-section {
  height: 55%;
  border-bottom: 1px solid var(--border);
}
.timeline-section {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
