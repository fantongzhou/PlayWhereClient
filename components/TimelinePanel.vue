<script setup lang="ts">
import { useTripStore } from '../stores/trip';
import DayCard from './DayCard.vue';

const tripStore = useTripStore();
</script>

<template>
  <div class="timeline-panel">
    <div class="panel-header">
      <h3>
        <span class="header-icon">📋</span>
        {{ tripStore.plan?.city }} {{ tripStore.plan?.days.length }}日行程
      </h3>
    </div>

    <!-- 日期切换 tabs -->
    <div class="day-tabs">
      <button
        v-for="day in tripStore.plan?.days"
        :key="day.day"
        :class="['day-tab', { active: tripStore.activeDay === day.day }]"
        @click="tripStore.activeDay = day.day"
      >
        Day {{ day.day }}
        <span class="day-weather-icon">
          {{ day.weather?.condition === '晴' ? '☀️' :
             day.weather?.condition === '多云' ? '⛅' :
             day.weather?.condition === '阴' ? '☁️' :
             day.weather?.condition === '小雨' ? '🌧️' : '🌤️' }}
        </span>
      </button>
    </div>

    <!-- 当前天的详细行程 -->
    <div class="day-content" v-if="tripStore.plan?.days">
      <DayCard
        v-for="day in tripStore.plan.days.filter(d => d.day === tripStore.activeDay)"
        :key="day.day"
        :day="day"
      />
    </div>

    <!-- 预算与提示 -->
    <div class="trip-footer" v-if="tripStore.plan">
      <div class="budget-box">
        <span class="budget-icon">💵</span>
        <span>{{ tripStore.plan.totalBudget }}</span>
      </div>
      <div class="tips-box" v-if="tripStore.plan.tips.length > 0">
        <div class="tips-title">💡 旅行贴士</div>
        <ul>
          <li v-for="(tip, i) in tripStore.plan.tips" :key="i">{{ tip }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}

.panel-header {
  padding: 16px 0 12px;
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 20px;
}

.day-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.day-tab {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: var(--bg-card);
  color: var(--text-secondary);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.day-tab.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.day-weather-icon {
  font-size: 14px;
}

.day-content {
  min-height: 200px;
}

.trip-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.budget-box {
  padding: 12px 16px;
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  border-radius: var(--radius);
  font-size: 13px;
  color: #065f46;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.budget-icon {
  font-size: 16px;
}

.tips-box {
  padding: 12px 16px;
  background: var(--bg-panel);
  border-radius: var(--radius);
}

.tips-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.tips-box ul {
  list-style: none;
  padding: 0;
}

.tips-box li {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 0;
  padding-left: 16px;
  position: relative;
}

.tips-box li::before {
  content: '•';
  position: absolute;
  left: 2px;
  color: var(--primary);
}
</style>
