import { ref } from 'vue';
import { useTripStore } from '../stores/trip';
import type { ThinkingStep } from '../types';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingContent: string;
  steps: ThinkingStep[];
  /** 思考阶段可见的状态行（工具调用时动态切换） */
  statusLine: string;
  streaming: boolean;
  timestamp: number;
}

let msgCounter = 0;
function uid() { return `msg_${Date.now()}_${msgCounter++}_${Math.random().toString(36).slice(2, 6)}`; }

/** 工具名 → 人类可读的进行时描述（展示在思考面板标题栏） */
function toolLabel(tool: string): string {
  const map: Record<string, string> = {
    get_weather: '正在查询目的地天气...',
    search_meituan_travel: '正在搜索美团旅行数据...',
    get_route: '正在规划交通路线...',
  };
  return map[tool] || `正在调用 ${tool}...`;
}

function getOrCreateSessionId(): string {
  const stored = localStorage.getItem('plan_session_id');
  if (stored) return stored;
  const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('plan_session_id', newId);
  return newId;
}

export function useSSE() {
  const tripStore = useTripStore();
  const apiBase = useApiBase();

  const messages = ref<Message[]>([]);
  const isStreaming = ref(false);
  const error = ref<string | null>(null);

  // ---- 打断控制 ----
  let abortController: AbortController | null = null;

  function stopGeneration() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', stopGeneration);
  }

  // ---- 发送消息 ----
  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming.value) return;
    error.value = null;
    isStreaming.value = true;

    messages.value.push({
      id: uid(), role: 'user', content: text,
      thinkingContent: '', steps: [], streaming: false, timestamp: Date.now(),
    });

    const assistantId = uid();
    messages.value.push({
      id: assistantId, role: 'assistant', content: '',
      thinkingContent: '', steps: [], statusLine: '', streaming: true, timestamp: Date.now(),
    });

    const sessionId = getOrCreateSessionId();
    abortController = new AbortController();

    // ---- RAF 双通道缓冲区 ----
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
        rafId = requestAnimationFrame(() => { flushAll(); lastFlush = performance.now(); });
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
                if (event.data?.sessionId) localStorage.setItem('plan_session_id', event.data.sessionId);
                if (event.message) { msg.statusLine = event.message; }
                break;
              case 'thought':
                if (event.content) { thinkingBuffer += event.content; scheduleFlush(); }
                break;
              case 'status':
                if (event.content) { thinkingBuffer += event.content; scheduleFlush(); }
                msg.steps.push({ type: 'status', step: event.step || 0, content: event.content });
                break;
              case 'response':
                if (event.content) { contentBuffer += event.content; scheduleFlush(); }
                break;
              case 'action':
                msg.statusLine = toolLabel(event.tool || 'unknown');
                msg.steps.push({ type: 'action', step: event.step || 0, tool: event.tool, args: event.args });
                break;
              case 'observation':
                msg.statusLine = '正在分析数据...';
                msg.steps.push({ type: 'observation', step: event.step || 0, data: event.data });
                break;
              case 'complete':
                msg.statusLine = '';
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
                msg.statusLine = '';
                error.value = event.message;
                msg.content += `\n\n⚠️ ${event.message}`;
                msg.streaming = false;
                break;
            }
          } catch { /* ignore */ }
        }
      }
      flushAll();
    } catch (e: any) {
      flushAll();
      const msg = messages.value.find(m => m.id === assistantId);
      if (e.name === 'AbortError') {
        if (msg && msg.content) { msg.content += '\n\n---\n⏸️ *已中断*'; }
        else if (msg) { msg.content = '⏸️ 已取消'; }
        if (msg) msg.streaming = false;
      } else {
        error.value = e.message;
        if (msg) { msg.content += `\n\n⚠️ 请求失败：${e.message}`; msg.streaming = false; }
      }
    } finally {
      abortController = null;
      isStreaming.value = false;
    }
  }

  function clearMessages() {
    messages.value = [];
    tripStore.setPlan({ city: '', days: [], totalBudget: '', tips: [] });
  }

  return { messages, isStreaming, error, sendMessage, stopGeneration, clearMessages };
}

// ---- TripPlan → Markdown 摘要 ----
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
  md += `| 日期 | 天气 | 景点 | 午餐 | 晚餐 | 酒店 |\n`;
  md += `|------|------|------|------|------|------|\n`;
  for (const day of plan.days) {
    const date = (day.date || '').slice(5);
    const w = day.weather;
    const weatherStr = w ? `${weatherIcon(w.condition)} ${w.condition} ${w.temperature?.low}~${w.temperature?.high}°` : '-';
    const attractions = (day.activities || []).filter((a: any) => a.type === 'attraction').map((a: any) => a.name).join('%%BR%%') || '-';
    const lunch = (day.activities || []).filter((a: any) => a.type === 'restaurant').map((a: any) => a.name).slice(0, 1).join('') || '-';
    const dinner = (day.activities || []).filter((a: any) => a.type === 'restaurant').map((a: any) => a.name).slice(1, 2).join('') || '-';
    const hotel = day.hotel?.name || '-';
    md += `| ${date} | ${weatherStr} | ${attractions} | ${lunch} | ${dinner} | ${hotel} |\n`;
  }
  md += `\n💵 **${plan.totalBudget || '请参考详细行程'}**\n`;
  if (plan.tips?.length > 0) {
    for (const tip of plan.tips) md += `💡 ${tip}\n`;
  }
  return md;
}
