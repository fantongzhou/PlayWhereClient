<script setup lang="ts">
import type { DayPlan } from '../types';
import ActivityItem from './ActivityItem.vue';

defineProps<{ day: DayPlan }>();
</script>

<template>
  <div class="day-card">
    <!-- 天气条 -->
    <div class="weather-bar" v-if="day.weather">
      <div class="weather-main">
        <span class="weather-condition">{{ day.weather.condition }}</span>
        <span class="weather-temp">
          {{ day.weather.temperature.low }}° ~ {{ day.weather.temperature.high }}°
        </span>
      </div>
      <div class="weather-suggestion">{{ day.weather.suggestion }}</div>
    </div>

    <!-- 时间线 -->
    <div class="timeline">
      <ActivityItem
        v-for="(activity, i) in day.activities"
        :key="i"
        :activity="activity"
        :index="i"
        :is-last="i === day.activities.length - 1"
      />
    </div>

    <!-- 酒店 -->
    <div class="hotel-bar" v-if="day.hotel">
      <span class="hotel-icon">🏨</span>
      <div class="hotel-info">
        <strong>{{ day.hotel.name }}</strong>
        <span class="hotel-price">¥{{ day.hotel.pricePerNight }}/晚</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.day-card {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
}

.weather-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.weather-condition {
  font-size: 18px;
  font-weight: 700;
}

.weather-temp {
  font-size: 14px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.weather-suggestion {
  font-size: 12px;
  color: var(--text-secondary);
}

.timeline {
  position: relative;
}

.hotel-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  padding-left: 4px;
  border-top: 1px dashed var(--border);
}

.hotel-icon {
  font-size: 20px;
}

.hotel-info {
  display: flex;
  flex-direction: column;
}

.hotel-info strong {
  font-size: 13px;
}

.hotel-price {
  font-size: 12px;
  color: var(--primary);
  font-weight: 500;
}
</style>
