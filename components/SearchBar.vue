<script setup lang="ts">
import { ref } from 'vue';
import { useSSE } from '../composables/useSSE';
import { CITIES, PREFERENCES, BUDGETS } from '../types';

const { startPlanning, isStreaming, error } = useSSE();

const city = ref('京都');
const days = ref(5);
const selectedPrefs = ref<string[]>([]);
const budget = ref<string>('moderate');

function togglePref(pref: string) {
  const idx = selectedPrefs.value.indexOf(pref);
  if (idx === -1) {
    selectedPrefs.value.push(pref);
  } else {
    selectedPrefs.value.splice(idx, 1);
  }
}

async function handleSubmit() {
  await startPlanning({
    city: city.value,
    days: days.value,
    preferences: selectedPrefs.value,
    budget: budget.value as 'budget' | 'moderate' | 'luxury',
  });
}
</script>

<template>
  <header class="search-bar">
    <div class="search-row">
      <!-- 城市选择 -->
      <div class="field-group">
        <label>目的地</label>
        <div class="city-tabs">
          <button
            v-for="c in CITIES"
            :key="c"
            :class="['city-btn', { active: city === c }]"
            @click="city = c"
          >
            {{ c }}
          </button>
        </div>
      </div>

      <!-- 天数 -->
      <div class="field-group">
        <label>天数</label>
        <div class="days-control">
          <button class="days-btn" @click="days > 1 && days--" :disabled="isStreaming">−</button>
          <span class="days-value">{{ days }} 天</span>
          <button class="days-btn" @click="days < 7 && days++" :disabled="isStreaming">+</button>
        </div>
      </div>

      <!-- 偏好 -->
      <div class="field-group">
        <label>偏好</label>
        <div class="pref-tags">
          <button
            v-for="p in PREFERENCES"
            :key="p.label"
            :class="['pref-tag', { active: selectedPrefs.includes(p.label) }]"
            @click="togglePref(p.label)"
          >
            {{ p.icon }} {{ p.label }}
          </button>
        </div>
      </div>

      <!-- 预算 -->
      <div class="field-group">
        <label>预算</label>
        <div class="budget-tabs">
          <button
            v-for="b in BUDGETS"
            :key="b.value"
            :class="['budget-btn', { active: budget === b.value }]"
            @click="budget = b.value"
          >
            {{ b.icon }} {{ b.label }}
          </button>
        </div>
      </div>

      <!-- 提交 -->
      <button class="submit-btn" @click="handleSubmit" :disabled="isStreaming">
        {{ isStreaming ? '规划中...' : '开始规划 🚀' }}
      </button>

      <!-- 对话模式入口 -->
      <NuxtLink to="/chat" class="chat-mode-link" title="自由对话模式（美团酒店/门票/机票）">
        💬
      </NuxtLink>
    </div>

    <div class="error-msg" v-if="error">{{ error }}</div>
  </header>
</template>

<style scoped>
.search-bar {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
  flex-shrink: 0;
}

.search-row {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.city-tabs, .budget-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-panel);
  border-radius: 8px;
  padding: 3px;
}

.city-btn, .budget-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.city-btn.active, .budget-btn.active {
  background: var(--bg-card);
  color: var(--primary);
  box-shadow: var(--shadow);
}

.pref-tags {
  display: flex;
  gap: 6px;
}

.pref-tag {
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.15s;
  white-space: nowrap;
}

.pref-tag.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.days-control {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-panel);
  border-radius: 8px;
  padding: 4px 12px;
}

.days-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: var(--bg-card);
  font-size: 16px;
  cursor: pointer;
  color: var(--text);
  box-shadow: var(--shadow);
}

.days-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.days-value {
  font-size: 14px;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
}

.submit-btn {
  padding: 8px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, var(--primary), #7c3aed);
  color: white;
  transition: all 0.2s;
  white-space: nowrap;
  margin-left: auto;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-msg {
  margin-top: 10px;
  padding: 8px 16px;
  background: #fef2f2;
  color: var(--error);
  border-radius: 8px;
  font-size: 13px;
}

.chat-mode-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--bg-panel);
  font-size: 18px;
  text-decoration: none;
  transition: all 0.15s;
  flex-shrink: 0;
}

.chat-mode-link:hover {
  background: #eff6ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}
</style>
