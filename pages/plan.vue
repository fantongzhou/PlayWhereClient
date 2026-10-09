<script setup lang="ts">
import { ref, watch } from 'vue';
import { usePlanChat } from '../composables/usePlanChat';

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

// 流式期间的心跳（驱动"深度思考中 Xs"实时计数；结束后停止）
const nowTick = ref(Date.now());
let heartbeat: ReturnType<typeof setInterval> | null = null;
watch(isStreaming, (streaming) => {
  if (streaming) {
    // 新一轮开始：自动展开最新 assistant 消息的思考面板
    const last = messages.value[messages.value.length - 1];
    if (last?.role === 'assistant') ensureAutoExpanded(last.id);
    heartbeat = setInterval(() => { nowTick.value = Date.now(); }, 1000);
  } else {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
    // 结束：未手动操作过的面板自动折叠
    for (const m of messages.value) {
      if (m.role === 'assistant') autoCollapseSteps(m.id);
    }
  }
}, { immediate: true });
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- ==================== 页面顶部导航栏 ==================== -->
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 z-20">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">S</div>
        <h1 class="text-xl font-semibold tracking-tight text-slate-800">上哪玩旅游助手</h1>
      </div>
      <div class="flex items-center gap-2">
        <a href="/m/plan" class="text-xs text-slate-400 hover:text-slate-600 md:hidden">📱</a>
        <button
          class="px-4 py-1.5 border border-gray-200 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          @click="handleNewChat"
          :disabled="isStreaming"
        >
          新对话
        </button>
      </div>
    </header>

    <!-- ==================== 主内容区（三列布局） ==================== -->
    <main class="flex-1 flex overflow-hidden p-4 gap-4">
      <!-- ======= 左侧：AI 对话面板 ======= -->
      <aside class="chat-panel flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]" :class="hasPlan ? 'w-[calc(100%*2/7)]' : 'flex-1'">
        <div class="px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 class="font-semibold text-slate-800">AI Chat Assistant</h2>
        </div>

        <!-- 消息列表 -->
        <div class="relative flex-1 overflow-hidden">
          <div class="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar" ref="chatBodyRef">
            <!-- 空状态 -->
            <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-center px-4 gap-4">
            <div class="text-5xl">🗺️</div>
            <div>
              <h2 class="text-lg font-bold text-slate-800 mb-1">用自然语言描述您的旅行需求</h2>
              <p class="text-sm text-slate-500 max-w-sm">我会自动分析目的地、天数、偏好，通过美团数据为您规划完美旅程</p>
            </div>
            <div class="flex flex-wrap gap-2 justify-center mt-2">
              <button
                v-for="qp in quickPrompts" :key="qp"
                class="px-4 py-2 border border-gray-200 rounded-full text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
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
            <div v-if="msg.role === 'user'" class="max-w-[85%] bg-blue-50 border border-blue-100 rounded-2xl rounded-tr-none px-4 py-2.5 shadow-sm">
              <p class="text-sm text-slate-700 leading-relaxed">
                <span class="font-bold text-blue-600">Me:</span> {{ msg.content }}
              </p>
            </div>

            <!-- 系统消息 -->
            <div v-else-if="msg.role === 'system'" class="max-w-[85%] bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-700">
              {{ msg.content }}
            </div>

            <!-- AI 消息 -->
            <div v-else-if="msg.role === 'assistant'" class="max-w-[92%] w-full animate-msg-fade-in">
              <!-- 深度思考 -->
              <div v-if="msg.thinkingContent || msg.steps.length > 0" class="mb-3 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                <button class="flex items-center gap-2 w-full px-4 py-2.5 border-0 bg-transparent text-sm cursor-pointer text-slate-500 hover:bg-gray-100 transition-colors" @click="toggleSteps(msg.id)">
                  <span class="text-base">{{ msg.streaming ? '🧠' : '✓' }}</span>
                  <span class="font-medium flex-1 text-left">{{ msg.streaming ? `深度思考中 ${thinkingSeconds(msg, nowTick)}s` : `已深度思考 ${thinkingSeconds(msg, nowTick)}s` }}</span>
                  <span class="text-xs text-slate-400">{{ showSteps[msg.id] ? '▾' : '▸' }}</span>
                </button>
                <div class="think-body" :class="{ expanded: showSteps[msg.id] }">
                  <div v-if="msg.thinkingContent" class="px-4 py-3 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap border-b border-gray-200">{{ msg.thinkingContent }}</div>

                  <!-- 工具卡片：action/observation 合并生命周期（运行中 spinner → 完成 ✓+耗时+可展开） -->
                  <details
                    v-for="(step, si) in msg.steps" :key="si"
                    v-show="step.type === 'tool' || step.type === 'status' || step.type === 'action' || step.type === 'observation'"
                    :class="['border-t border-gray-200 first:border-t-0 group/tool', step.type === 'tool' ? '' : `step-${step.type}`]"
                  >
                    <!-- 非工具卡片：保持原步骤行 -->
                    <div v-if="step.type !== 'tool'" class="flex items-center gap-2 px-4 py-1.5 pl-6 text-xs text-slate-500">
                      <span class="step-dot w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <span class="flex-1">{{ getStepLabel(step) }}</span>
                      <span class="text-[11px] text-slate-400">{{ getStepMeta(step) }}</span>
                    </div>

                    <!-- 工具卡片 -->
                    <summary v-else class="flex items-center gap-2 px-4 py-1.5 pl-6 text-xs cursor-pointer list-none select-none text-slate-500 hover:bg-gray-100/70 transition-colors">
                      <!-- 状态图标：运行中转圈 / 完成 ✓ -->
                      <svg v-if="!step.done" class="w-3 h-3 shrink-0 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-90" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
                      </svg>
                      <svg v-else class="w-3 h-3 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                      <span class="flex-1" :class="step.done ? '' : 'text-slate-600 font-medium'">{{ getStepLabel(step) }}</span>
                      <span v-if="getStepMeta(step)" class="text-[11px] text-slate-400 tabular-nums">{{ getStepMeta(step) }}</span>
                      <span v-if="step.done && step.data !== undefined" class="text-[10px] text-slate-300 group-open/tool:text-slate-400 transition-colors">{{ '' }}</span>
                    </summary>
                    <!-- 完成的卡片可展开查看工具参数与返回 -->
                    <div v-if="step.type === 'tool' && step.done" class="hidden group-open/tool:block px-4 pb-2 pl-10">
                      <!-- 记忆检索：渲染成可读列表（原始 JSON 对用户没意义） -->
                      <template v-if="step.tool === 'recall_user_memory'">
                        <div v-if="recalledMemories(step).length" class="space-y-1">
                          <div
                            v-for="(mem, mi) in recalledMemories(step)" :key="mi"
                            class="flex items-start gap-2 text-[11px] bg-white border border-gray-100 rounded-lg px-2 py-1.5"
                          >
                            <span class="shrink-0 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">{{ kindLabel(mem.kind) }}</span>
                            <span class="flex-1 text-slate-600 leading-relaxed">{{ mem.content }}</span>
                          </div>
                        </div>
                        <p v-else class="text-[11px] text-slate-400">暂无相关记忆</p>
                      </template>
                      <template v-else>
                        <pre v-if="step.args" class="text-[11px] text-slate-500 bg-white border border-gray-100 rounded-lg p-2 mb-1 overflow-x-auto">参数: {{ JSON.stringify(step.args) }}</pre>
                        <pre class="text-[11px] text-slate-500 bg-white border border-gray-100 rounded-lg p-2 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">{{ JSON.stringify(step.data, null, 0)?.slice(0, 600) }}{{ (JSON.stringify(step.data) || '').length > 600 ? '…' : '' }}</pre>
                      </template>
                    </div>
                  </details>
                </div>
              </div>

              <!-- 思考状态行（工具调用时动态切换） -->
              <div v-if="msg.statusLine" class="mb-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-600 font-medium flex items-center gap-2 animate-pulse">
                <span class="text-base">🔍</span>
                <span>{{ msg.statusLine }}</span>
              </div>

              <!-- AI 文本内容 -->
              <!-- 首 token 等待态（TTFT 窗口）：三点脉冲 -->
              <div v-if="!msg.content && msg.streaming" class="flex items-center gap-1.5 py-1.5" aria-label="正在思考">
                <span class="typing-dot" /><span class="typing-dot" style="animation-delay: 0.15s" /><span class="typing-dot" style="animation-delay: 0.3s" />
              </div>
              <div v-else class="ai-content text-sm leading-relaxed text-slate-700" :class="{ streaming: msg.streaming }" v-html="renderMarkdown(msg)" />
              <span v-if="msg.streaming" class="typing-cursor inline-block w-0.5 h-4 bg-blue-600 ml-0.5 align-text-bottom rounded-sm animate-cursor-blink" />
            </div>
          </div>

          <!-- 错误提示 -->
          <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">⚠️ {{ error }}</div>
          </div>

          <!-- 回到底部药丸按钮（用户上翻离开底部时出现） -->
          <Transition name="pill-fade">
            <button
              v-if="!isAtBottom"
              class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-200 rounded-full shadow-md text-xs text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors"
              aria-label="回到底部"
              @click="scrollToBottom(true)"
            >
              <span class="text-[10px]">↓</span>
              <span v-if="isStreaming">回到底部（生成中）</span>
              <span v-else>回到底部</span>
            </button>
          </Transition>
        </div>

        <!-- 输入框 -->
        <div class="p-4 border-t border-gray-100 shrink-0">
          <div class="bg-slate-50 rounded-xl border border-gray-200 p-2">
            <textarea
              v-model="inputText"
              class="w-full bg-transparent border-0 outline-none focus:ring-0 text-sm resize-none h-20 placeholder:text-slate-400"
              placeholder="输入您的旅行需求，Enter 发送，Shift+Enter 换行..."
              :disabled="isStreaming"
              @keydown="handleKeydown"
            />
            <div class="flex items-center justify-between mt-2">
              <span class="text-[11px] text-slate-400">Agent 会自动分析城市、天数、偏好</span>
              <button
                v-if="isStreaming"
                class="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors animate-pulse-stop"
                @click="stopGeneration"
              >⏹ 停止</button>
              <button
                v-else
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="handleSend"
                :disabled="!inputText.trim()"
              >发送</button>
            </div>
          </div>
        </div>
      </aside>

      <!-- ======= 中间：地图面板 ======= -->
      <section v-if="hasPlan" class="flex-[0_0_calc(100%*3/7)] bg-slate-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative">
        <ClientOnly fallback-tag="div" fallback="地图加载中...">
          <TravelMap />
        </ClientOnly>
      </section>

      <!-- ======= 右侧：行程面板 ======= -->
      <aside
        class="itinerary-panel flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        :class="hasPlan ? 'flex-[0_0_calc(100%*2/7)]' : 'flex-[0_0_0]'"
      >
        <TimelinePanel />
      </aside>
    </main>
  </div>
</template>

<style scoped>
/* 药丸按钮淡入淡出 */
.pill-fade-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.pill-fade-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.pill-fade-enter-from,
.pill-fade-leave-to { opacity: 0; transform: translate(-50%, 4px); }

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

/* 深度思考步骤类型标识（非工具卡片） */
.step-action .step-dot { background: #f59e0b; }
.step-observation .step-dot { background: #10b981; }
.step-status .step-dot { background: #3b82f6; }

/* 工具卡片 details marker 跨浏览器隐藏 */
details > summary::-webkit-details-marker { display: none; }

/* 打字光标 */
.ai-content.streaming { display: inline; }

/* 首 token 三点脉冲 */
.typing-dot {
  width: 6px; height: 6px; border-radius: 9999px;
  background: #94a3b8;
  animation: typing-pulse 1.2s ease-in-out infinite;
}
@keyframes typing-pulse {
  0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

/* v-html 渲染 markdown 内容 */
.ai-content :deep(.md-h2) { font-size: 16px; font-weight: 700; color: #1e293b; margin: 12px 0 6px; }
.ai-content :deep(.md-h3) { font-size: 14px; font-weight: 600; color: #334155; margin: 10px 0 4px; }
.ai-content :deep(.md-h4) { font-size: 13px; font-weight: 600; color: #475569; margin: 8px 0 4px; }
.ai-content :deep(.md-hr) { border: none; border-top: 1px solid #e2e8f0; margin: 8px 0; }
.ai-content :deep(.md-image) { max-width: 100%; max-height: 300px; border-radius: 8px; margin: 6px 0; display: block; }
.ai-content :deep(.md-link) { color: #2563eb; text-decoration: underline; }
.ai-content :deep(.md-table) {
  width: 100%; border-collapse: separate; border-spacing: 0;
  margin: 10px 0; font-size: 13px; border-radius: 8px;
  overflow: hidden; box-shadow: 0 0 0 1px #e2e8f0;
}
.ai-content :deep(.md-table th) {
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
  font-weight: 600; color: #1e293b; padding: 8px 12px;
  text-align: left; font-size: 12px; text-transform: uppercase;
  letter-spacing: 0.02em; border-bottom: 2px solid #cbd5e1;
}
.ai-content :deep(.md-table td) {
  padding: 7px 12px; border-bottom: 1px solid #f1f5f9; color: #475569;
}
.ai-content :deep(.md-table tbody tr:last-child td) { border-bottom: none; }
.ai-content :deep(.md-table .md-tr-alt td) { background: #f8fafc; }
.ai-content :deep(.md-tr-alt) { background: transparent; }
.ai-content :deep(.md-paragraph) { margin: 4px 0; line-height: 1.7; font-size: 14px; color: #334155; }
.ai-content :deep(.md-ul) { margin: 4px 0; padding-left: 20px; }
.ai-content :deep(.md-li) { margin: 2px 0; color: #475569; font-size: 13px; }
.ai-content :deep(.md-li)::marker { color: #2563eb; }
.ai-content :deep(.inline-code) { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 12px; color: #e11d48; font-family: 'SF Mono','Fira Code',monospace; }
</style>
