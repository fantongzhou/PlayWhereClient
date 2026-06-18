<script setup lang="ts">
import { useTripStore } from '../stores/trip';
import { useAgentStore } from '../stores/agent';

const tripStore = useTripStore();
const agentStore = useAgentStore();
</script>

<template>
  <div class="overlay">
    <div class="loading-card">
      <div class="loading-icon">🤖</div>
      <h3>AI Agent 正在规划行程</h3>
      <p class="loading-detail">
        {{ tripStore.request?.city }} {{ tripStore.request?.days }}日游
        <span v-if="tripStore.request?.preferences?.length">
          · {{ tripStore.request.preferences.join('、') }}
        </span>
      </p>

      <div class="progress-track">
        <div class="progress-fill" />
      </div>

      <div class="current-step" v-if="agentStore.steps.length > 0">
        <span class="step-dot"></span>
        <span class="step-text">
          {{ agentStore.steps[agentStore.steps.length - 1]?.type === 'thought' ? '思考中...' :
             agentStore.steps[agentStore.steps.length - 1]?.type === 'action' ? `正在调用 ${agentStore.steps[agentStore.steps.length - 1]?.tool}...` :
             agentStore.steps[agentStore.steps.length - 1]?.type === 'observation' ? '分析数据中...' :
             '生成行程中...' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 40px 48px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  max-width: 380px;
  width: 90%;
}

.loading-icon {
  font-size: 48px;
  animation: float 2s ease-in-out infinite;
  margin-bottom: 16px;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}

.loading-detail {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.progress-track {
  width: 100%;
  height: 4px;
  background: var(--bg-panel);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, var(--primary), #7c3aed);
  border-radius: 2px;
  animation: progress 2s ease-in-out infinite;
}

@keyframes progress {
  0% { width: 10%; transform: translateX(0); }
  50% { width: 60%; transform: translateX(20%); }
  100% { width: 10%; transform: translateX(100%); }
}

.current-step {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.step-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.step-text {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
