import { ref, watch, nextTick, computed } from 'vue';
import { useTripStore } from '../stores/trip';
import { useSSE } from './useSSE';
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

    const tablePlaceholders: string[] = [];
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    html = html.replace(/(?:^\|.+\|$\n?)+/gm, (match) => {
      const idx = tablePlaceholders.length;
      tablePlaceholders.push(match.trim());
      // 用双换行包裹，确保表格在段落阶段被识别为独立块
      return `\n\n%%TABLE_${idx}%%\n\n`;
    });

    html = html.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^---+\s*$/gm, '<hr class="md-hr">');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) =>
      `<img src="${url.replace(/"/g, '&quot;')}" alt="${alt || '图片'}" loading="lazy" class="md-image" onerror="this.style.display='none'" />`);
    html = html.replace(/(?<!src=")(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|webp)(?:\?[^\s<>"']*)?)/gi,
      (_, url) => `<img src="${url}" alt="图片" loading="lazy" class="md-image" onerror="this.style.display='none'" />`);
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');
    html = html.replace(/(?<![">])(?<!href=")(?<!src=")(https?:\/\/[^\s<>"'\n]+)/g, (match) => {
      if (/\.(jpg|jpeg|png|webp)/i.test(match)) return match;
      const d = match.length > 60 ? match.slice(0, 57) + '...' : match;
      return `<a href="${match}" target="_blank" rel="noopener" class="md-link">${d}</a>`;
    });
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/^[\-\*] (.+)$/gm, '<li class="md-li">$1</li>');
    html = html.replace(/((?:<li class="md-li">.+<\/li>\n?)+)/g, '<ul class="md-ul">$1</ul>');

    html = html.replace(/%%TABLE_(\d+)%%/g, (_, i) => buildTable(tablePlaceholders[parseInt(i)]));

    html = html.split(/\n\n+/).map(block => {
      const t = block.trim();
      if (!t) return '';
      if (/^<(h[2-4]|hr|ul|table|img|li|div)\b/.test(t)) return t;
      return `<p class="md-paragraph">${t.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
  }

  function buildTable(mdTable: string): string {
    const rows = mdTable.split('\n').filter(r => r.trim());
    if (rows.length < 2) return mdTable;

    const parse = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const isSep = (r: string) => /^\|[\s\-:]+\|[\s\-:|]*\|?$/.test(r);

    let hdr: string[];
    let data: string[][];
    if (isSep(rows[1])) {
      hdr = parse(rows[0]);
      data = rows.slice(2).map(parse);
    } else {
      hdr = parse(rows[0]);
      data = rows.slice(1).map(parse);
    }

    if (!data.length) return mdTable;

    let t = '<table class="md-table"><thead><tr>';
    for (const c of hdr) t += `<th>${c}</th>`;
    t += '</tr></thead><tbody>';
    for (let i = 0; i < data.length; i++) {
      const rowClass = i % 2 === 0 ? '' : ' class="md-tr-alt"';
      t += `<tr${rowClass}>`;
      for (let c = 0; c < hdr.length; c++) t += `<td>${(data[i][c] || '').replace(/%%BR%%/g, '<br>')}</td>`;
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
      case 'status': return step.content || '处理中...';
      default: return '';
    }
  }

  function getStepMeta(step: ThinkingStep): string {
    if (step.type === 'action' && step.args?.city) return `城市: ${step.args.city}`;
    if (step.type === 'observation') return '';
    if (step.type === 'status') return '';
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
    renderMarkdown,
    getStepLabel,
    getStepMeta,
  };
}
