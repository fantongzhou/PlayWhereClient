import { ref } from 'vue';
import { useTripStore } from '../stores/trip';
import { useAgentStore } from '../stores/agent';
import type { TripRequest, TripPlan, SSEEventType } from '../types';

export function useSSE() {
  const isStreaming = ref(false);
  const error = ref<string | null>(null);

  const tripStore = useTripStore();
  const agentStore = useAgentStore();

  async function startPlanning(request: TripRequest): Promise<TripPlan | null> {
    isStreaming.value = true;
    error.value = null;
    tripStore.loading = true;
    agentStore.thinking = true;
    agentStore.clearSteps();
    tripStore.setRequest(request);

    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
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
      let finalPlan: TripPlan | null = null;

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

              // 更新 agent 思考步骤
              const stepTypes: SSEEventType[] = ['thought', 'action', 'observation', 'plan_partial'];
              if (stepTypes.includes(event.type)) {
                agentStore.addStep({
                  type: event.type,
                  step: event.step || 0,
                  content: event.content,
                  tool: event.tool,
                  args: event.args,
                  data: event.data,
                });
              }

              // 处理最终行程
              if (event.type === 'plan_complete' && event.plan) {
                finalPlan = event.plan;
                tripStore.setPlan(event.plan);
              }

              // 处理错误
              if (event.type === 'error') {
                error.value = event.message;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      return finalPlan;
    } catch (e: any) {
      error.value = e.message;
      return null;
    } finally {
      isStreaming.value = false;
      tripStore.loading = false;
      agentStore.thinking = false;
    }
  }

  return { isStreaming, error, startPlanning };
}
