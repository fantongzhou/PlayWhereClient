<script setup lang="ts">
import { ref, watch } from 'vue';
import { usePlanChat } from '~/composables/usePlanChat';

definePageMeta({ layout: false, middleware: ['device-redirect'] });

const {
  inputText,
  chatBodyRef,
  showSteps,
  hasPlan,
  messages,
  isStreaming,
  error,
  isAtBottom,
  quickPrompts,
  handleSend,
  handleKeydown,
  handleQuickPrompt,
  handleNewChat,
  toggleSteps,
  ensureAutoExpanded,
  autoCollapseSteps,
  thinkingSeconds,
  renderMarkdown,
  getStepLabel,
  getStepMeta,
  recalledMemories,
  kindLabel,
  scrollToBottom,
  stopGeneration
} = usePlanChat();

const drawerOpen = ref(false);

// 流式期间心跳：驱动"深度思考中 Xs"实时计数 + 面板自动展开/折叠
const nowTick = ref(Date.now());
let heartbeat: ReturnType<typeof setInterval> | null = null;
watch(isStreaming, (streaming) => {
  if (streaming) {
    const last = messages.value[messages.value.length - 1];
    if (last?.role === 'assistant') ensureAutoExpanded(last.id);
    heartbeat = setInterval(() => { nowTick.value = Date.now(); }, 1000);
  } else {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
    for (const m of messages.value) {
      if (m.role === 'assistant') autoCollapseSteps(m.id);
    }
  }
}, { immediate: true });

// 规划完成后自动打开 drawer
watch(hasPlan, (val) => {
  if (val) drawerOpen.value = true;
});

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value;
}

function newChat() {
  handleNewChat();
  drawerOpen.value = false;
}
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-bg">
    <!-- ==================== Header ==================== -->
    <header class="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0 z-30">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">S</div>
        <h1 class="text-base font-semibold text-slate-800">上哪玩旅游助手</h1>
      </div>
      <div class="flex items-center gap-2">
        <a href="/" class="text-xs text-slate-400 hover:text-slate-600">首页</a>
        <a href="/plan" class="text-xs text-slate-400 hover:text-slate-600">桌面版</a>
        <button
          class="px-2.5 py-1 border border-gray-200 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
          @click="newChat"
          :disabled="isStreaming"
        >新对话</button>
      </div>
    </header>

    <!-- ==================== Chat Area ==================== -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Messages -->
      <div class="relative flex-1 overflow-hidden">
        <div class="h-full overflow-y-auto px-4 py-3 space-y-3" ref="chatBodyRef">
        <!-- 空状态 -->
        <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-center px-2 gap-3">
          <div class="text-4xl">🗺️</div>
          <div>
            <h2 class="text-base font-bold text-slate-800 mb-1">用自然语言描述您的旅行需求</h2>
            <p class="text-xs text-slate-500">AI 自动分析目的地、天数、偏好，基于美团数据规划完美旅程</p>
          </div>
          <div class="flex flex-wrap gap-1.5 justify-center mt-1">
            <button
              v-for="qp in quickPrompts" :key="qp"
              class="px-3 py-1.5 border border-gray-200 rounded-full text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              @click="handleQuickPrompt(qp)"
            >{{ qp.length > 10 ? qp.slice(0, 10) + '...' : qp }}</button>
          </div>
        </div>

        <!-- Messages -->
        <div
          v-for="msg in messages" :key="msg.id"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'"
        >
          <div v-if="msg.role === 'user'" class="max-w-[88%] bg-blue-50 border border-blue-100 rounded-2xl rounded-tr-none px-3 py-2">
            <p class="text-sm text-slate-700 leading-relaxed"><span class="font-bold text-blue-600 text-xs">Me:</span> {{ msg.content }}</p>
          </div>
          <div v-else-if="msg.role === 'system'" class="max-w-[88%] bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
            {{ msg.content }}
          </div>
          <div v-else-if="msg.role === 'assistant'" class="max-w-[95%] w-full animate-msg-fade-in">
            <div v-if="msg.thinkingContent || msg.steps.length > 0" class="mb-2 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <button class="flex items-center gap-1.5 w-full px-3 py-2 border-0 bg-transparent text-xs cursor-pointer text-slate-500 hover:bg-gray-100 transition-colors" @click="toggleSteps(msg.id)">
                <span>{{ msg.streaming ? '🧠' : '✓' }}</span>
                <span class="font-medium flex-1 text-left">{{ msg.streaming ? `深度思考中 ${thinkingSeconds(msg, nowTick)}s` : `已深度思考 ${thinkingSeconds(msg, nowTick)}s` }}</span>
                <span class="text-[10px] text-slate-400">{{ showSteps[msg.id] ? '▾' : '▸' }}</span>
              </button>
              <div class="think-body" :class="{ expanded: showSteps[msg.id] }">
                <div v-if="msg.thinkingContent" class="px-3 py-2 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap border-b border-gray-200">{{ msg.thinkingContent }}</div>

                <!-- 工具卡片：action/observation 合并生命周期 -->
                <details
                  v-for="(step, si) in msg.steps" :key="si"
                  v-show="step.type === 'tool' || step.type === 'status' || step.type === 'action' || step.type === 'observation'"
                  :class="['border-t border-gray-200 first:border-t-0 group/tool', step.type === 'tool' ? '' : `step-${step.type}`]"
                >
                  <div v-if="step.type !== 'tool'" class="flex items-center gap-1.5 px-3 py-1 pl-5 text-[11px] text-slate-500">
                    <span class="step-dot w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                    <span class="flex-1">{{ getStepLabel(step) }}</span>
                    <span class="text-[10px] text-slate-400">{{ getStepMeta(step) }}</span>
                  </div>

                  <summary v-else class="flex items-center gap-1.5 px-3 py-1 pl-5 text-[11px] cursor-pointer list-none select-none text-slate-500 active:bg-gray-100/70">
                    <svg v-if="!step.done" class="w-3 h-3 shrink-0 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-90" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
                    </svg>
                    <svg v-else class="w-3 h-3 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <span class="flex-1" :class="step.done ? '' : 'text-slate-600 font-medium'">{{ getStepLabel(step) }}</span>
                    <span v-if="getStepMeta(step)" class="text-[10px] text-slate-400 tabular-nums">{{ getStepMeta(step) }}</span>
                  </summary>
                  <div v-if="step.type === 'tool' && step.done" class="hidden group-open/tool:block px-3 pb-1.5 pl-8">
                    <!-- 记忆检索：渲染成可读列表（原始 JSON 对用户没意义） -->
                    <template v-if="step.tool === 'recall_user_memory'">
                      <div v-if="recalledMemories(step).length" class="space-y-1">
                        <div
                          v-for="(mem, mi) in recalledMemories(step)" :key="mi"
                          class="flex items-start gap-1.5 text-[10px] bg-white border border-gray-100 rounded-lg px-1.5 py-1"
                        >
                          <span class="shrink-0 px-1 rounded bg-indigo-50 text-indigo-600 font-medium">{{ kindLabel(mem.kind) }}</span>
                          <span class="flex-1 text-slate-600 leading-relaxed">{{ mem.content }}</span>
                        </div>
                      </div>
                      <p v-else class="text-[10px] text-slate-400">暂无相关记忆</p>
                    </template>
                    <template v-else>
                      <pre v-if="step.args" class="text-[10px] text-slate-500 bg-white border border-gray-100 rounded-lg p-1.5 mb-1 overflow-x-auto">参数: {{ JSON.stringify(step.args) }}</pre>
                      <pre class="text-[10px] text-slate-500 bg-white border border-gray-100 rounded-lg p-1.5 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">{{ JSON.stringify(step.data, null, 0)?.slice(0, 400) }}{{ (JSON.stringify(step.data) || '').length > 400 ? '…' : '' }}</pre>
                    </template>
                  </div>
                </details>
              </div>
            </div>
            <!-- 思考状态行 -->
            <div v-if="msg.statusLine" class="mb-1.5 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-600 font-medium flex items-center gap-1.5 animate-pulse">
              <span>🔍</span>
              <span>{{ msg.statusLine }}</span>
            </div>

            <!-- 首 token 等待态：三点脉冲 -->
            <div v-if="!msg.content && msg.streaming" class="flex items-center gap-1.5 py-1.5" aria-label="正在思考">
              <span class="typing-dot" /><span class="typing-dot" style="animation-delay: 0.15s" /><span class="typing-dot" style="animation-delay: 0.3s" />
            </div>
            <div v-else class="ai-content text-sm leading-relaxed text-slate-700" :class="{ streaming: msg.streaming }" v-html="renderMarkdown(msg)" />
            <span v-if="msg.streaming" class="typing-cursor inline-block w-0.5 h-4 bg-blue-600 ml-0.5 align-text-bottom rounded-sm animate-cursor-blink" />
          </div>
        </div>
        <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs">⚠️ {{ error }}</div>
        </div>

        <!-- 回到底部药丸按钮（用户上翻离开底部时出现） -->
        <Transition name="pill-fade">
          <button
            v-if="!isAtBottom"
            class="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-md text-xs text-slate-600 active:text-blue-600 transition-colors"
            aria-label="回到底部"
            @click="scrollToBottom(true)"
          >
            <span class="text-[10px]">↓</span>
            <span v-if="isStreaming">回到底部（生成中）</span>
            <span v-else>回到底部</span>
          </button>
        </Transition>
      </div>

      <!-- Input -->
      <div class="px-3 py-2.5 border-t border-gray-200 bg-white shrink-0">
        <div class="bg-slate-50 rounded-xl border border-gray-200 p-2">
          <textarea
            v-model="inputText"
            class="w-full bg-transparent border-0 outline-none focus:ring-0 text-sm resize-none h-14 placeholder:text-slate-400"
            placeholder="输入旅行需求，Enter 发送..."
            :disabled="isStreaming"
            @keydown="handleKeydown"
          />
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-slate-400">Agent 自动分析城市、天数、偏好</span>
            <button
              v-if="isStreaming"
              class="bg-red-500 hover:bg-red-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors animate-pulse-stop"
              @click="stopGeneration"
            >⏹ 停止</button>
            <button
              v-else
              class="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              @click="handleSend"
              :disabled="!inputText.trim()"
            >发送</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 浮动按钮：触发 Drawer ==================== -->
    <button
      v-if="hasPlan"
      class="fixed bottom-20 right-4 z-40 bg-blue-600 text-white px-4 py-2.5 rounded-full shadow-lg shadow-blue-300 flex items-center gap-2 text-sm font-medium active:scale-95 transition-transform"
      @click="toggleDrawer"
    >
      <span>{{ drawerOpen ? '▼' : '▲' }}</span>
      {{ drawerOpen ? '收起' : '地图 & 行程' }}
    </button>

    <!-- ==================== 遮罩层 ==================== -->
    <Transition name="drawer-fade">
      <div
        v-if="drawerOpen && hasPlan"
        class="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        @click="drawerOpen = false"
      />
    </Transition>

    <!-- ==================== 底部 Drawer ==================== -->
    <Transition name="drawer-slide">
      <div
        v-if="drawerOpen && hasPlan"
        class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col drawer-height max-h-[88vh]"
      >
        <!-- Handle Bar -->
        <div class="shrink-0 pt-3 pb-2 flex flex-col items-center cursor-pointer" @click="toggleDrawer">
          <div class="w-10 h-1 bg-gray-300 rounded-full" />
          <span class="text-[10px] text-slate-400 mt-1">下拉收起</span>
        </div>

        <!-- Drawer Content：地图 + 分隔线固定，行程 + 贴士滚动 -->
        <div class="flex-1 flex flex-col overflow-hidden px-3">
          <!-- 地图区域（固定） -->
          <div class="h-52 shrink-0 rounded-xl overflow-hidden border border-gray-200 mb-2">
            <ClientOnly fallback-tag="div" fallback="地图加载中...">
              <TravelMap />
            </ClientOnly>
          </div>

          <!-- 分隔 + 标签（固定） -->
          <div class="flex items-center gap-2 py-2 shrink-0">
            <div class="flex-1 h-px bg-gray-200" />
            <span class="text-xs text-slate-400 font-medium">行程时间线</span>
            <div class="flex-1 h-px bg-gray-200" />
          </div>

          <!-- 行程 + 贴士（可滚动） -->
          <div class="flex-1 overflow-y-auto pb-6">
            <TimelinePanel flat />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 药丸按钮淡入淡出 */
.pill-fade-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.pill-fade-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.pill-fade-enter-from,
.pill-fade-leave-to { opacity: 0; transform: translate(-50%, 4px); }

/* 思考面板 */
.think-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.think-body.expanded {
  max-height: 400px;
  overflow-y: auto;
}

/* 步骤类型标识（非工具卡片） */
.step-action .step-dot { background: #f59e0b; }
.step-observation .step-dot { background: #10b981; }
.step-status .step-dot { background: #3b82f6; }
details > summary::-webkit-details-marker { display: none; }
.ai-content.streaming { display: inline; }

/* 首 token 三点脉冲 */
.typing-dot {
  width: 5px; height: 5px; border-radius: 9999px;
  background: #94a3b8;
  animation: typing-pulse 1.2s ease-in-out infinite;
}
@keyframes typing-pulse {
  0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

/* Drawer 过渡动画 */
.drawer-slide-enter-active { transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-slide-leave-active { transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-slide-enter-from,
.drawer-slide-leave-to { transform: translateY(100%); }

.drawer-fade-enter-active { transition: opacity 0.3s ease; }
.drawer-fade-leave-active { transition: opacity 0.2s ease; }
.drawer-fade-enter-from,
.drawer-fade-leave-to { opacity: 0; }

/* Drawer 高度：地图 ~45% + itinerary ~55%，移动端撑满 */
.drawer-height {
  height: 88vh;
}

/* v-html 渲染 markdown 内容 */
.ai-content :deep(.md-h2) { font-size: 15px; font-weight: 700; color: #1e293b; margin: 10px 0 4px; }
.ai-content :deep(.md-h3) { font-size: 13px; font-weight: 600; color: #334155; margin: 8px 0 4px; }
.ai-content :deep(.md-h4) { font-size: 12px; font-weight: 600; color: #475569; margin: 6px 0 2px; }
.ai-content :deep(.md-hr) { border: none; border-top: 1px solid #e2e8f0; margin: 6px 0; }
.ai-content :deep(.md-image) { max-width: 100%; max-height: 240px; border-radius: 8px; margin: 4px 0; display: block; }
.ai-content :deep(.md-link) { color: #2563eb; text-decoration: underline; }
.ai-content :deep(.md-table) { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; }
.ai-content :deep(.md-table th), .ai-content :deep(.md-table td) { border: 1px solid #e2e8f0; padding: 4px 8px; text-align: left; }
.ai-content :deep(.md-table th) { background: #f1f5f9; font-weight: 600; color: #475569; }
.ai-content :deep(.md-tr-alt) { background: #f8fafc; }
.ai-content :deep(.md-paragraph) { margin: 3px 0; color: #334155; }
.ai-content :deep(.md-ul) { margin: 3px 0; padding-left: 18px; }
.ai-content :deep(.md-li) { margin: 1px 0; color: #475569; font-size: 12px; }
.ai-content :deep(.inline-code) { background: #f1f5f9; padding: 1px 4px; border-radius: 4px; font-size: 11px; color: #e11d48; }
</style>
