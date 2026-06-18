<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useAgentStore } from '../stores/agent';
import type { ThinkingStep as TStep } from '../types';

const agentStore = useAgentStore();
const expanded = ref(true);
const listRef = ref<HTMLDivElement>();

// 自动滚动
watch(() => agentStore.steps.length, async () => {
  await nextTick();
  if (listRef.value) {
    listRef.value.scrollTop = listRef.value.scrollHeight;
  }
});

function getStepTitle(step: TStep): string {
  switch (step.type) {
    case 'thought': return '🤔 思考';
    case 'action': return `🔧 调用工具: ${step.tool}`;
    case 'observation': return '📊 获取结果';
    case 'plan_partial': return `📋 第${(step.data as any)?.day || '?'}天行程生成中`;
    default: return step.type;
  }
}

function formatData(data: unknown): string {
  if (!data) return '';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
</script>

<template>
  <div class="thinking-panel" :class="{ collapsed: !expanded }">
    <div class="panel-header" @click="expanded = !expanded">
      <div class="header-left">
        <span class="pulse" v-if="agentStore.thinking"></span>
        <h3>🧠 Agent 思考过程</h3>
        <span class="step-count">{{ agentStore.steps.length }} 步</span>
      </div>
      <button class="toggle-btn">{{ expanded ? '收起 ▲' : '展开 ▼' }}</button>
    </div>

    <div class="steps-list" ref="listRef" v-show="expanded">
      <!-- 空状态 -->
      <div class="empty-hint" v-if="!agentStore.thinking && agentStore.steps.length === 0">
        点击"开始规划"查看 Agent 的思考过程
      </div>

      <!-- 步骤列表 -->
      <div
        v-for="(step, i) in agentStore.steps"
        :key="i"
        class="step"
        :class="`step-${step.type}`"
      >
        <div class="step-header">
          <span class="step-number">#{{ step.step }}</span>
          <span class="step-title">{{ getStepTitle(step) }}</span>
        </div>

        <!-- 思考内容 -->
        <div class="step-content" v-if="step.content">
          {{ step.content }}
        </div>

        <!-- 工具参数 -->
        <div class="step-args" v-if="step.args && step.type === 'action'">
          <div class="args-label">参数:</div>
          <pre class="args-json">{{ formatData(step.args) }}</pre>
        </div>

        <!-- 工具结果 -->
        <div class="step-obs" v-if="step.data && step.type === 'observation'">
          <div class="obs-label">结果:</div>
          <pre class="obs-json">{{ formatData(step.data) }}</pre>
        </div>
      </div>

      <!-- 加载动画 -->
      <div class="loading-dots" v-if="agentStore.thinking">
        <span></span><span></span><span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.thinking-panel {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  transition: all 0.3s;
  flex-shrink: 0;
}

.thinking-panel.collapsed {
  max-height: 44px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  cursor: pointer;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
}

.step-count {
  font-size: 11px;
  background: var(--bg-panel);
  padding: 2px 8px;
  border-radius: 10px;
  color: var(--text-secondary);
}

.pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.toggle-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.steps-list {
  max-height: 260px;
  overflow-y: auto;
  padding: 0 20px 16px;
}

.empty-hint {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.step {
  margin-bottom: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--bg-panel);
  border-left: 3px solid var(--primary);
}

.step-thought {
  border-left-color: #8b5cf6;
}

.step-action {
  border-left-color: #f59e0b;
}

.step-observation {
  border-left-color: #10b981;
}

.step-plan_partial {
  border-left-color: #3b82f6;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-number {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.step-title {
  font-size: 13px;
  font-weight: 600;
}

.step-content {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  line-height: 1.5;
}

.step-args, .step-obs {
  margin-top: 6px;
}

.args-label, .obs-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.args-json, .obs-json {
  font-size: 11px;
  background: rgba(0,0,0,.03);
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
  max-height: 120px;
  overflow-y: auto;
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.loading-dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 12px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
