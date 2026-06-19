import { ref } from 'vue';
import { useChatStore } from '../stores/chat';
import type { SSEEventType, ThinkingStep } from '../types';

export function useChatSSE() {
  const isStreaming = ref(false);
  const error = ref<string | null>(null);

  const chatStore = useChatStore();

  /** 从 localStorage 获取或生成 sessionId */
  function getOrCreateSessionId(): string {
    const stored = localStorage.getItem('chat_session_id');
    if (stored) return stored;

    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('chat_session_id', newId);
    return newId;
  }

  async function sendMessage(message: string): Promise<void> {
    if (!message.trim()) return;

    isStreaming.value = true;
    error.value = null;
    chatStore.loading = true;

    // 添加用户消息
    chatStore.addUserMessage(message);

    // 创建 assistant 消息占位
    const assistantId = chatStore.createAssistantMessage();

    const sessionId = getOrCreateSessionId();

    try {
      const response = await fetch('/api/plan/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type as SSEEventType) {
                case 'start':
                  // 服务器可能返回新的 sessionId
                  if (event.data?.sessionId) {
                    localStorage.setItem('chat_session_id', event.data.sessionId);
                  }
                  break;

                case 'thought':
                  // LLM 的思考/回复内容 — 追加到消息
                  if (event.content) {
                    chatStore.appendContent(assistantId, event.content);
                  }
                  // 同时记录为思考步骤
                  chatStore.appendStep(assistantId, {
                    type: 'thought',
                    step: event.step || 0,
                    content: event.content,
                  });
                  break;

                case 'action':
                  // 工具调用 — 记录步骤
                  chatStore.appendStep(assistantId, {
                    type: 'action',
                    step: event.step || 0,
                    tool: event.tool,
                    args: event.args,
                  });
                  break;

                case 'observation':
                  // 工具结果 — 记录步骤
                  chatStore.appendStep(assistantId, {
                    type: 'observation',
                    step: event.step || 0,
                    data: event.data,
                  });
                  break;

                case 'plan_complete':
                  // 对话回合完成
                  chatStore.finishMessage(assistantId);
                  break;

                case 'error':
                  error.value = event.message || '未知错误';
                  chatStore.appendContent(assistantId, `\n\n⚠️ ${event.message}`);
                  chatStore.finishMessage(assistantId);
                  break;

                default:
                  // 处理未知事件类型：尝试作为 thought 追加内容
                  if (event.content) {
                    chatStore.appendContent(assistantId, event.content);
                  }
                  chatStore.appendStep(assistantId, {
                    type: (event.type as SSEEventType) || 'thought',
                    step: event.step || 0,
                    content: event.content,
                    tool: event.tool,
                    args: event.args,
                    data: event.data,
                  });
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (e: any) {
      error.value = e.message;
      chatStore.appendContent(assistantId, `\n\n⚠️ 请求失败：${e.message}`);
      chatStore.finishMessage(assistantId);
    } finally {
      isStreaming.value = false;
      chatStore.loading = false;
    }
  }

  /** 清除当前会话记忆（开始新对话） */
  async function clearMemory(): Promise<void> {
    const sessionId = localStorage.getItem('chat_session_id');
    if (sessionId) {
      try {
        await fetch(`/api/plan/chat/memory?sessionId=${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
        });
      } catch {
        // 忽略清理失败
      }
    }
    localStorage.removeItem('chat_session_id');
  }

  return { isStreaming, error, sendMessage, clearMemory };
}
