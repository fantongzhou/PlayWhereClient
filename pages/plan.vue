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
  quickPrompts,
  handleSend,
  handleKeydown,
  handleQuickPrompt,
  handleNewChat,
  toggleSteps,
  renderMarkdown,
  getStepLabel,
  getStepMeta,
} = usePlanChat();
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- ==================== 页面顶部导航栏 ==================== -->
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 z-20">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">S</div>
        <h1 class="text-xl font-semibold tracking-tight text-slate-800">AI 旅行规划</h1>
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
        <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref="chatBodyRef">
          <!-- 空状态 -->
          <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-center px-4 gap-4">
            <div class="text-5xl">🗺️</div>
            <div>
              <h2 class="text-lg font-bold text-slate-800 mb-1">用自然语言描述您的旅行需求</h2>
              <p class="text-sm text-slate-500 max-w-sm">我会自动分析目的地、天数、偏好，通过飞猪数据为您规划完美旅程</p>
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
                  <span class="text-base">{{ msg.streaming ? '🧠' : '✅' }}</span>
                  <span class="font-medium flex-1 text-left">{{ msg.streaming ? '深度思考中...' : `已完成深度思考 (${msg.steps.length} 步)` }}</span>
                  <span class="text-xs text-slate-400">{{ showSteps[msg.id] ? '▾' : '▸' }}</span>
                </button>
                <div class="think-body" :class="{ expanded: showSteps[msg.id] }">
                  <div v-if="msg.thinkingContent" class="px-4 py-3 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap border-b border-gray-200">{{ msg.thinkingContent }}</div>
                  <div
                    v-for="(step, si) in msg.steps" :key="si"
                    :class="['flex items-center gap-2 px-4 py-1.5 pl-6 text-xs text-slate-500 border-t border-gray-200 first:border-t-0', `step-${step.type}`]"
                  >
                    <span class="step-dot w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                    <span class="flex-1">{{ getStepLabel(step) }}</span>
                    <span class="text-[11px] text-slate-400">{{ getStepMeta(step) }}</span>
                  </div>
                </div>
              </div>

              <!-- AI 文本内容 -->
              <div class="ai-content text-sm leading-relaxed text-slate-700" :class="{ streaming: msg.streaming }" v-html="renderMarkdown(msg.content)" />
              <span v-if="msg.streaming" class="typing-cursor inline-block w-0.5 h-4 bg-blue-600 ml-0.5 align-text-bottom rounded-sm animate-cursor-blink" />
            </div>
          </div>

          <!-- 错误提示 -->
          <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">⚠️ {{ error }}</div>
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
.step-action .step-dot { background: #f59e0b; }
.step-observation .step-dot { background: #10b981; }
.step-plan_partial .step-dot { background: #3b82f6; }

/* 打字光标 */
.ai-content.streaming { display: inline; }

/* v-html 渲染 markdown 内容 */
.ai-content :deep(.md-h2) { font-size: 16px; font-weight: 700; color: #1e293b; margin: 12px 0 6px; }
.ai-content :deep(.md-h3) { font-size: 14px; font-weight: 600; color: #334155; margin: 10px 0 4px; }
.ai-content :deep(.md-h4) { font-size: 13px; font-weight: 600; color: #475569; margin: 8px 0 4px; }
.ai-content :deep(.md-hr) { border: none; border-top: 1px solid #e2e8f0; margin: 8px 0; }
.ai-content :deep(.md-image) { max-width: 100%; max-height: 300px; border-radius: 8px; margin: 6px 0; display: block; }
.ai-content :deep(.md-link) { color: #2563eb; text-decoration: underline; }
.ai-content :deep(.md-table) { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.ai-content :deep(.md-table th), .ai-content :deep(.md-table td) { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
.ai-content :deep(.md-table th) { background: #f1f5f9; font-weight: 600; color: #475569; }
.ai-content :deep(.md-tr-alt) { background: #f8fafc; }
.ai-content :deep(.md-paragraph) { margin: 4px 0; color: #334155; }
.ai-content :deep(.md-ul) { margin: 4px 0; padding-left: 20px; }
.ai-content :deep(.md-li) { margin: 2px 0; color: #475569; font-size: 13px; }
.ai-content :deep(.inline-code) { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 12px; color: #e11d48; }
</style>
