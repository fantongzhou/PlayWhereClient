<script setup lang="ts">
import { computed } from 'vue';
import type { DayPlan } from '../types';
import { useTripStore } from '../stores/trip';
import ActivityItem from './ActivityItem.vue';
import RouteCard from './RouteCard.vue';

const props = defineProps<{ day: DayPlan }>();
const tripStore = useTripStore();

const dayRoutes = computed(() => tripStore.getRoutesForDay(props.day.day));
</script>

<template>
  <div class="bg-bg-card rounded-lg p-4 shadow">
    <!-- 天气条 -->
    <div class="flex flex-col gap-1 pb-3 mb-3 border-b border-border" v-if="day.weather">
      <div class="flex items-center gap-3">
        <span class="text-lg font-bold">{{ day.weather.condition }}</span>
        <span class="text-sm text-text-secondary tabular-nums">
          {{ day.weather.temperature.low }}° ~ {{ day.weather.temperature.high }}°
        </span>
      </div>
      <div class="text-xs text-text-secondary">{{ day.weather.suggestion }}</div>
    </div>

    <!-- 时间线 -->
    <div class="relative">
      <template v-for="(activity, i) in day.activities" :key="i">
        <ActivityItem
          :activity="activity"
          :index="i"
          :is-last="i === day.activities.length - 1"
        />
        <!-- 两个活动之间的路线卡片 -->
        <RouteCard
          v-if="i < day.activities.length - 1 && dayRoutes[i]"
          :segment="dayRoutes[i]"
          :seg-index="i"
          :day-number="day.day"
        />
      </template>

      <!-- 最后一个活动到酒店的路线 -->
      <RouteCard
        v-if="day.hotel && day.activities.length > 0 && dayRoutes[day.activities.length - 1]"
        :segment="dayRoutes[day.activities.length - 1]"
        :seg-index="day.activities.length - 1"
        :day-number="day.day"
      />
    </div>

    <!-- 酒店 -->
    <div class="flex items-center gap-2.5 mt-3 pt-3 pl-1 border-t border-dashed border-border" v-if="day.hotel">
      <span class="text-[20px]">🏨</span>
      <div class="flex flex-col">
        <strong class="text-[13px]">{{ day.hotel.name }}</strong>
        <span class="text-xs text-primary font-medium">¥{{ day.hotel.pricePerNight }}/晚</span>
        <a
          v-if="day.hotel.bookingUrl"
          :href="day.hotel.bookingUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-0.5 mt-1 px-2.5 py-[3px] text-[11px] font-medium text-white rounded bg-gradient-to-br from-success to-[#059669] no-underline transition-all duration-150 hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(16,185,129,0.3)]"
        >
          🏨 立即预订
        </a>
      </div>
    </div>
  </div>
</template>
