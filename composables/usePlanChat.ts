import { ref, watch, nextTick, computed, onMounted, onBeforeUnmount } from 'vue';
import { useTripStore } from '../stores/trip';
import { useSSE } from './useSSE';
import { MarkdownRenderCache } from '../utils/incrementalMarkdown';
import type { ThinkingStep } from '../types';

/**
 * 旅行规划聊天页的通用逻辑（plan.vue 和 m.vue 共享）
 */
export function usePlanChat() {
  const tripStore = useTripStore();
  const { messages, isStreaming, error, sendMessage, stopGeneration, clearMessages } = useSSE();

  const inputText = ref('');
  const chatBodyRef = ref<HTMLDivElement>();
  const showSteps = ref<Record<string, boolean>>({});
  const hasPlan = computed(() => !!tripStore.plan && tripStore.plan.days.length > 0);

  const quickPrompts = [
    '周末两天适合去哪里玩？',
    '帮我规划北京3日游，喜欢历史文化，预算中等',
    '三亚4天海滨度假，预算不限',
    '成都美食之旅，3天，预算实惠',
  ];

  // ---- stick-to-bottom 滚动（业界标准：Claude.ai / ChatGPT / useStickToBottom 同款模式）----
  // 用户在底部 → 自动跟随新内容；用户上翻 → 停止跟随 + 出现"回到底部"药丸按钮
  const isAtBottom = ref(true);

  /** 距底 < 80px 视为在底部（容忍惯性滚动的像素误差，业界常用 20-100px） */
  const BOTTOM_THRESHOLD = 80;

  function onScroll() {
    const el = chatBodyRef.value;
    if (!el) return;
    isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
  }

  function scrollToBottom(force = false) {
    if (!force && !isAtBottom.value) return;   // 用户上翻时不拽回
    const el = chatBodyRef.value;
    if (el) el.scrollTop = el.scrollHeight;    // 瞬跳不用 smooth —— smooth 永远追不上流式内容
  }

  onMounted(() => {
    chatBodyRef.value?.addEventListener('scroll', onScroll, { passive: true });
  });
  onBeforeUnmount(() => {
    chatBodyRef.value?.removeEventListener('scroll', onScroll);
  });

  // 内容增长时跟随（isAtBottom 为 false 时 onScroll 已拦住）
  watch(
    () => [messages.value.length, messages.value.map(m => m.content).join('')],
    async () => { await nextTick(); scrollToBottom(); },
  );

  // 用户发送新消息 → 强制回到底部（新消息必须可见）
  function handleSend() {
    const text = inputText.value;
    if (!text.trim() || isStreaming.value) return;
    inputText.value = '';
    isAtBottom.value = true;
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
    isAtBottom.value = true;
    handleSend();
  }

  function handleNewChat() {
    markdownCache.clear();
    clearMessages();
    localStorage.removeItem('plan_session_id');
  }

  // ---- 思考面板生命周期（Claude.ai / DeepSeek 同款）----
  // streaming 开始 → 自动展开；完成 → 自动折叠成一行 + 耗时徽章。
  // 用户手动切换过的消息不再被自动收起（尊重用户选择）。
  const manualOverride = new Set<string>();

  /** 新 assistant 消息出现（或开始流式）时调用：自动展开思考面板 */
  function ensureAutoExpanded(msgId: string) {
    if (manualOverride.has(msgId)) return;
    showSteps.value[msgId] = true;
  }

  /** streaming 结束时调用：没手动动过的面板自动折叠 */
  function autoCollapseSteps(msgId: string) {
    if (manualOverride.has(msgId)) return;
    showSteps.value[msgId] = false;
  }

  function toggleSteps(msgId: string) {
    manualOverride.add(msgId);
    showSteps.value[msgId] = !showSteps.value[msgId];
  }

  /** 思考耗时（秒）—— streaming 期间返回实时值，完成后返回定格值 */
  function thinkingSeconds(msg: { id: string; streaming: boolean; timestamp: number; doneAt?: number }, now: number): number {
    const end = msg.streaming ? now : (msg.doneAt || Date.now());
    return Math.max(0, Math.round((end - msg.timestamp) / 1000));
  }

  // ---- Markdown 渲染 ----
  // 流式增量渲染（见 utils/incrementalMarkdown.ts）：
  //   - 未闭合语法（`**加粗` / 半截表格 / 未闭合代码块）由 remend 在原文层补全，不崩版
  //   - 块级边界推进：只有"最后一整块"每帧重算，其前 HTML 固化复用 → 每帧 O(尾部) 而非 O(全文)
  //   - 按 msgId 缓存：历史消息内容不变，直接命中，零成本
  // 旧的手写 regex 渲染器（renderMarkdown/buildTable，~90 行）已删除 —— 它既无法
  // 处理未闭合语法，也是整篇重跑正则。
  const markdownCache = new MarkdownRenderCache();

  function renderMarkdownCached(msg: { id: string; content: string }): string {
    return msg.content ? markdownCache.render(msg.id, msg.content) : '';
  }

  function getStepLabel(step: ThinkingStep): string {
    switch (step.type) {
      case 'tool': {
        // 工具卡片：运行中显示进行时，完成显示完成时（业界 ChatGPT/Claude 同款生命周期）
        const tool = step.tool;
        const names: Record<string, [string, string]> = {
          get_weather: ['正在查询目的地天气', '查询目的地天气'],
          search_meituan_travel: ['正在搜索美团旅行数据', '搜索美团旅行数据'],
          get_route: ['正在规划交通路线', '规划交通路线'],
          get_route_tool: ['正在规划交通路线', '规划交通路线'],
          recall_user_memory: ['正在检索历史记忆', '检索历史记忆'],
        };
        const [running, done] = names[tool] || [`调用 ${tool || '工具'}`, `调用 ${tool || '工具'}`];
        return step.done ? done : running;
      }
      case 'action':
        if (step.tool === 'get_weather') return '正在查询目的地天气...';
        if (step.tool === 'search_meituan_travel') return '正在搜索美团旅行数据...';
        if (step.tool === 'get_route') return '正在规划交通路线...';
        return step.tool ? `调用 ${step.tool}` : '工具调用';
      case 'observation': return '已获取数据，正在分析...';
      case 'status': return step.content || '处理中...';
      default: return '';
    }
  }

  /** 工具耗时徽章文案（<1s 不显示，信息噪音大于价值） */
  function formatElapsed(step: ThinkingStep): string {
    const ms = (step.endedAt || 0) - (step.startedAt || 0);
    if (ms < 1000) return '';
    const s = ms / 1000;
    return s >= 60 ? `${Math.floor(s / 60)}m${Math.round(s % 60)}s` : `${s.toFixed(1)}s`;
  }

  /**
   * recall_user_memory 的返回里记忆条数。
   * 非该工具、未完成、或数据结构异常时返回 null。
   */
  function memoryCount(step: ThinkingStep): number | null {
    if (step.tool !== 'recall_user_memory' || !step.done) return null;
    const mems = (step.data as { memories?: unknown } | undefined)?.memories;
    return Array.isArray(mems) ? mems.length : null;
  }

  /** 召回的记忆列表（供卡片展开区渲染），数据异常时返回空数组 */
  function recalledMemories(step: ThinkingStep): Array<{ content: string; kind: string; score: number }> {
    if (step.tool !== 'recall_user_memory' || !step.done) return [];
    const mems = (step.data as { memories?: unknown } | undefined)?.memories;
    if (!Array.isArray(mems)) return [];
    return mems.filter(
      (m): m is { content: string; kind: string; score: number } =>
        !!m && typeof (m as { content?: unknown }).content === 'string',
    );
  }

  /** 记忆类别 → 中文标签 */
  function kindLabel(kind: string): string {
    const map: Record<string, string> = {
      preference: '偏好',
      constraint: '约束',
      fact: '事实',
      profile: '画像',
    };
    return map[kind] || kind || '记忆';
  }

  function getStepMeta(step: ThinkingStep): string {
    if (step.type === 'tool') {
      const tool = step.tool;

      // 记忆检索卡片：完成态展示「已召回 N 条」—— 这是这个工具最重要的反馈
      if (tool === 'recall_user_memory') {
        if (!step.done) {
          const q = step.args?.query;
          return q ? `「${String(q).slice(0, 12)}」` : '';
        }
        const n = memoryCount(step);
        if (n === null) return formatElapsed(step);
        const elapsed = formatElapsed(step);
        if (n === 0) return '未命中记忆';
        return `已召回 ${n} 条${elapsed ? ' · ' + elapsed : ''}`;
      }

      if (!step.done) return step.args?.city ? `城市: ${step.args.city}` : '';
      return formatElapsed(step);
    }
    if (step.type === 'action' && step.args?.city) return `城市: ${step.args.city}`;
    return '';
  }

  return {
    // state
    inputText,
    chatBodyRef,
    showSteps,
    hasPlan,
    messages,
    isStreaming,
    error,
    isAtBottom,
    quickPrompts,
    // actions
    sendMessage,
    stopGeneration,
    scrollToBottom,
    handleSend,
    handleKeydown,
    handleQuickPrompt,
    handleNewChat,
    toggleSteps,
    ensureAutoExpanded,
    autoCollapseSteps,
    thinkingSeconds,
    renderMarkdown: renderMarkdownCached,
    getStepLabel,
    getStepMeta,
    memoryCount,
    recalledMemories,
    kindLabel,
  };
}
