<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useTripStore } from '../stores/trip';
import { useSSE } from '../composables/useSSE';
import type { ThinkingStep } from '../types';

definePageMeta({ layout: false });

const tripStore = useTripStore();
const { messages, isStreaming, error, sendMessage, stopGeneration, clearMessages } = useSSE();

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

function handleSend() {
  const text = inputText.value;
  if (!text.trim() || isStreaming.value) return;
  inputText.value = '';
  sendMessage(text);
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
  clearMessages();
  localStorage.removeItem('plan_session_id');
}

function toggleSteps(msgId: string) {
  showSteps.value[msgId] = !showSteps.value[msgId];
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

// 路线规划由 TravelMap 组件内通过高德 Driving API 直接完成
</script>

<template>
  <div class="h-screen flex overflow-hidden">
    <!-- 聊天区域 -->
    <div class="chat-area flex-1 flex flex-col min-w-0 transition-[flex] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-bg" :class="{ shrunk: hasPlan }">
      <!-- 头部 -->
      <header class="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-card shrink-0">
        <div class="flex flex-col gap-0.5">
          <h1 class="text-[17px] font-bold m-0 text-text-primary">🤖 AI 旅行规划</h1>
          <span class="text-[11px] text-text-secondary">基于美团酒旅真实数据 · 高德天气 · 实时对话</span>
        </div>
        <button class="px-3.5 py-1.5 border border-border rounded-lg bg-bg-panel text-[13px] cursor-pointer text-text-secondary transition-all duration-150 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed" @click="handleNewChat" :disabled="isStreaming">
          新对话
        </button>
      </header>

      <!-- 消息列表 -->
      <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-4" ref="chatBodyRef">
        <!-- 空状态 -->
        <div class="flex-1 flex flex-col items-center justify-center gap-2.5 text-center px-5 py-10" v-if="messages.length === 0">
          <div class="text-[56px]">🗺️</div>
          <h2 class="text-xl font-bold gradient-text">用自然语言描述您的旅行需求</h2>
          <p class="text-text-secondary text-sm max-w-[420px]">我会自动分析目的地、天数、偏好，通过美团数据为您规划完美旅程</p>
          <div class="flex flex-wrap gap-2 mt-3 justify-center">
            <button
              v-for="qp in quickPrompts" :key="qp"
              class="px-4 py-2 border border-border rounded-[20px] bg-bg-card text-[13px] cursor-pointer text-text-secondary transition-all duration-150 hover:border-primary hover:text-primary"
              @click="handleQuickPrompt(qp)"
            >{{ qp }}</button>
          </div>
        </div>

        <!-- 消息气泡 -->
        <div
          v-for="msg in messages" :key="msg.id"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'"
        >
          <!-- 用户消息 -->
          <div v-if="msg.role === 'user'" class="max-w-[80%] px-[18px] py-2.5 rounded-[18px_18px_4px_18px] bg-gradient-to-br from-primary to-[#7c3aed] text-white text-sm leading-relaxed">
            {{ msg.content }}
          </div>

          <!-- AI 消息 -->
          <div v-else-if="msg.role === 'assistant'" class="flex gap-2.5 max-w-[92%] w-full animate-msg-fade-in">
            <div class="w-[34px] h-[34px] rounded-full bg-bg-card flex items-center justify-center text-lg shrink-0 border border-border">🤖</div>
            <div class="flex-1 min-w-0">
              <!-- 深度思考（DeepSeek 风格折叠面板） -->
              <div v-if="msg.thinkingContent || msg.steps.length > 0" class="mb-3 border border-[#e5e7eb] rounded-lg overflow-hidden bg-[#f9fafb]">
                <button class="flex items-center gap-2 w-full px-3.5 py-2.5 border-0 bg-transparent text-[13px] cursor-pointer text-[#6b7280] transition-colors duration-150 hover:bg-[#f3f4f6]" @click="toggleSteps(msg.id)">
                  <span class="text-[15px]">{{ msg.streaming ? '🧠' : '✅' }}</span>
                  <span class="font-medium flex-1 text-left">
                    {{ msg.streaming ? '深度思考中...' : `已完成深度思考 (${msg.steps.length} 步)` }}
                  </span>
                  <span class="text-[11px] text-[#9ca3af] transition-transform duration-200">{{ showSteps[msg.id] ? '▾' : '▸' }}</span>
                </button>
                <div class="think-body" :class="{ expanded: showSteps[msg.id] }">
                  <!-- 思考文本内容 -->
                  <div v-if="msg.thinkingContent" class="px-3.5 py-2.5 text-[13px] leading-relaxed text-[#4b5563] whitespace-pre-wrap border-b border-[#f3f4f6]">{{ msg.thinkingContent }}</div>
                  <!-- 工具步骤 -->
                  <div
                    v-for="(step, si) in msg.steps" :key="si"
                    :class="['flex items-center gap-2 px-3.5 py-1.5 pl-6 text-xs text-[#6b7280] border-t border-[#f3f4f6] relative first:border-t-0', `step-${step.type}`]"
                  >
                    <span class="step-dot w-1.5 h-1.5 rounded-full bg-[#d1d5db] shrink-0" />
                    <span class="flex-1">{{ getStepLabel(step) }}</span>
                    <span class="text-[11px] text-[#9ca3af]">{{ getStepMeta(step) }}</span>
                  </div>
                </div>
              </div>

              <!-- AI 内容 -->
              <div class="ai-content text-sm leading-relaxed text-text-primary" :class="{ streaming: msg.streaming }" v-html="renderMarkdown(msg.content)" />
              <span v-if="msg.streaming" class="typing-cursor inline-block w-0.5 h-[18px] bg-primary ml-0.5 align-text-bottom rounded-sm animate-cursor-blink" />
            </div>
          </div>

          <!-- 系统消息 -->
          <div v-else-if="msg.role === 'system'" class="px-4 py-2 rounded-lg bg-[#fefce8] text-[#a16207] text-xs max-w-[80%]">
            {{ msg.content }}
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="px-4 py-2.5 bg-[#fef2f2] text-[#dc2626] rounded-lg text-[13px]">⚠️ {{ error }}</div>
      </div>

      <!-- 输入框 -->
      <footer class="px-5 py-3 border-t border-border bg-bg-card shrink-0">
        <div class="flex gap-2 items-end">
          <textarea
            v-model="inputText"
            class="flex-1 px-3.5 py-2.5 border border-border rounded-xl text-sm font-[inherit] leading-relaxed resize-none outline-none bg-bg-panel text-text-primary min-h-[44px] max-h-[120px] transition-[border-color] duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] disabled:opacity-60"
            placeholder="输入您的旅行需求，Enter 发送，Shift+Enter 换行..."
            :disabled="isStreaming"
            rows="2"
            @keydown="handleKeydown"
          />
          <!-- 流式输出中 → 显示打断按钮 -->
          <button
            v-if="isStreaming"
            class="px-[22px] py-2.5 border-0 rounded-lg bg-gradient-to-br from-[#ef4444] to-[#dc2626] text-white text-sm font-semibold cursor-pointer transition-all duration-200 shrink-0 animate-pulse-stop hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(239,68,68,0.3)]"
            @click="stopGeneration"
          >
            ⏹ 停止
          </button>
          <!-- 空闲 → 显示发送按钮 -->
          <button
            v-else
            class="px-[22px] py-2.5 border-0 rounded-lg bg-gradient-to-br from-primary to-[#7c3aed] text-white text-sm font-semibold cursor-pointer transition-all duration-200 shrink-0 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(37,99,235,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
            @click="handleSend"
            :disabled="!inputText.trim()"
          >
            发送
          </button>
        </div>
        <div class="text-[11px] text-text-secondary opacity-50 mt-1.5">Agent 会自动分析城市、天数、偏好 · 信息不足时会追问</div>
      </footer>
    </div>

    <!-- 地图区域（规划完成后滑出） -->
    <div class="map-area flex-[0_0_0] overflow-hidden border-l border-border bg-bg-card transition-[flex] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]" :class="{ visible: hasPlan }">
      <ClientOnly fallback-tag="div" fallback="地图加载中...">
        <TravelMap />
      </ClientOnly>
    </div>

    <!-- 时间线区域（规划完成后滑出） -->
    <div class="timeline-area flex-[0_0_0] overflow-y-auto border-l border-border bg-bg-card transition-[flex] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]" :class="{ visible: hasPlan }">
      <TimelinePanel />
    </div>
  </div>
</template>

<style scoped>
/* 三列布局面板滑出过渡（flex-basis calc 无法用 Tailwind 表达） */
.chat-area.shrunk {
  flex: 0 0 calc(100% * 2 / 7);
}
.map-area.visible {
  flex: 0 0 calc(100% * 3 / 7);
}
.timeline-area.visible {
  flex: 0 0 calc(100% * 2 / 7);
}

/* 思考面板折叠过渡 */
.think-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.think-body.expanded {
  max-height: 600px;
  overflow-y: auto;
}

/* 深度思考步骤类型标识 */
.step-action .step-dot {
  background: #f59e0b;
}
.step-observation .step-dot {
  background: #10b981;
}
.step-plan_partial .step-dot {
  background: #3b82f6;
}

/* 欢迎标题渐变色文字 */
.gradient-text {
  background: linear-gradient(135deg, #2563eb, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 打字光标 */
.ai-content.streaming {
  display: inline;
}

/* v-html 渲染内联代码 */
.ai-content :deep(.inline-code) {
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}

/* v-html 渲染的 markdown 内容 */
.ai-content :deep(.md-image) {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  margin: 6px 0;
  display: block;
}
.ai-content :deep(.md-link) {
  color: #2563eb;
  text-decoration: underline;
}
.ai-content :deep(.md-table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}
.ai-content :deep(.md-table th),
.ai-content :deep(.md-table td) {
  border: 1px solid #e2e8f0;
  padding: 6px 10px;
  text-align: left;
}
.ai-content :deep(.md-table th) {
  background: #f1f5f9;
  font-weight: 600;
}
.ai-content :deep(.md-paragraph) {
  margin: 4px 0;
}
</style>
