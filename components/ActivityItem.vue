<script setup lang="ts">
import type { Activity } from '../types';

defineProps<{ activity: Activity; index: number; isLast: boolean }>();

const typeConfig: Record<string, { icon: string; color: string }> = {
  attraction: { icon: '📍', color: '#2563eb' },
  restaurant: { icon: '🍽️', color: '#f59e0b' },
  hotel: { icon: '🏨', color: '#10b981' },
};
</script>

<template>
  <div class="activity" :class="{ 'is-last': isLast }">
    <!-- 时间 -->
    <div class="time-column">
      <span class="time">{{ activity.time }}</span>
      <div class="time-line" />
    </div>

    <!-- 内容 -->
    <div class="content-column">
      <div class="activity-card">
        <div class="activity-header">
          <span
            class="type-badge"
            :style="{ background: typeConfig[activity.type]?.color || '#666' }"
          >
            {{ typeConfig[activity.type]?.icon || '📍' }}
          </span>
          <strong class="activity-name">{{ activity.name }}</strong>
          <span class="duration">{{ activity.duration }}</span>
        </div>
        <p class="activity-note" v-if="activity.note">{{ activity.note }}</p>

        <!-- 购票/预订链接 -->
        <a
          v-if="activity.bookingUrl"
          :href="activity.bookingUrl"
          target="_blank"
          rel="noopener"
          class="booking-link"
        >
          🎫 {{ activity.type === 'restaurant' ? '订座/外卖' : activity.type === 'hotel' ? '立即预订' : '购票/预订' }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity {
  display: flex;
  gap: 12px;
  padding-bottom: 4px;
}

.activity.is-last .time-line {
  display: none;
}

.time-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 44px;
  flex-shrink: 0;
}

.time {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  padding: 2px 0;
}

.time-line {
  width: 2px;
  flex: 1;
  background: var(--border);
  min-height: 20px;
  margin: 2px 0;
}

.content-column {
  flex: 1;
  min-width: 0;
}

.activity-card {
  background: var(--bg-panel);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 8px;
  transition: all 0.15s;
}

.activity-card:hover {
  background: #e8ecf4;
}

.activity-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-badge {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.activity-name {
  font-size: 14px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duration {
  font-size: 11px;
  color: var(--text-secondary);
  background: rgba(0,0,0,.05);
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.activity-note {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  padding-left: 30px;
}

.booking-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s;
}

.booking-link:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}
</style>
