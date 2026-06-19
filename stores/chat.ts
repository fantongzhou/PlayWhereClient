import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ThinkingStep } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** 关联的思考步骤（仅 assistant 消息） */
  steps: ThinkingStep[];
  /** 是否正在流式生成中 */
  streaming: boolean;
  timestamp: number;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /** 添加一条用户消息 */
  function addUserMessage(content: string) {
    messages.value.push({
      id: uid(),
      role: 'user',
      content,
      steps: [],
      streaming: false,
      timestamp: Date.now(),
    });
  }

  /** 创建一条空的 assistant 消息（流式填充） */
  function createAssistantMessage(): string {
    const id = uid();
    messages.value.push({
      id,
      role: 'assistant',
      content: '',
      steps: [],
      streaming: true,
      timestamp: Date.now(),
    });
    return id;
  }

  /** 追加文本到 assistant 消息 */
  function appendContent(msgId: string, text: string) {
    const msg = messages.value.find(m => m.id === msgId);
    if (msg) {
      msg.content += text;
    }
  }

  /** 追加思考步骤到 assistant 消息 */
  function appendStep(msgId: string, step: ThinkingStep) {
    const msg = messages.value.find(m => m.id === msgId);
    if (msg) {
      msg.steps.push(step);
    }
  }

  /** 标记 assistant 消息流式完成 */
  function finishMessage(msgId: string) {
    const msg = messages.value.find(m => m.id === msgId);
    if (msg) {
      msg.streaming = false;
    }
  }

  /** 添加一条系统消息 */
  function addSystemMessage(content: string) {
    messages.value.push({
      id: uid(),
      role: 'system',
      content,
      steps: [],
      streaming: false,
      timestamp: Date.now(),
    });
  }

  function clearMessages() {
    messages.value = [];
    error.value = null;
  }

  return {
    messages,
    loading,
    error,
    addUserMessage,
    createAssistantMessage,
    appendContent,
    appendStep,
    finishMessage,
    addSystemMessage,
    clearMessages,
  };
});
