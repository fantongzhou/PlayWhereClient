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
  <div>
    <!-- Day Header（匹配 reference: uppercase tracking-wider） -->
    <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
      Day {{ day.day }}<template v-if="day.weather"> · {{ day.weather.condition }} {{ day.weather.temperature.low }}°~{{ day.weather.temperature.high }}°</template>
    </h3>
    <p v-if="day.weather?.suggestion" class="text-[11px] text-slate-400 -mt-2 mb-3">{{ day.weather.suggestion }}</p>

    <!-- 活动列表 -->
    <div class="space-y-1">
      <template v-for="(activity, i) in day.activities" :key="i">
        <ActivityItem
          :activity="activity"
          :index="i"
          :is-last="i === day.activities.length - 1"
        />
        <RouteCard
          v-if="i < day.activities.length - 1 && dayRoutes[i]"
          :segment="dayRoutes[i]"
          :seg-index="i"
          :day-number="day.day"
        />
      </template>

      <RouteCard
        v-if="day.hotel && day.activities.length > 0 && dayRoutes[day.activities.length - 1]"
        :segment="dayRoutes[day.activities.length - 1]"
        :seg-index="day.activities.length - 1"
        :day-number="day.day"
      />
    </div>

    <!-- 酒店 -->
    <div v-if="day.hotel" class="flex items-center gap-3 mt-3 p-3 border border-gray-100 rounded-xl hover:bg-slate-50 transition-colors">
      <span class="text-xl shrink-0">🏨</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-slate-800 truncate">{{ day.hotel.name }}</p>
        <p class="text-xs text-slate-500">¥{{ day.hotel.pricePerNight }}/晚</p>
      </div>
      <a
        v-if="day.hotel.bookingUrl"
        :href="day.hotel.bookingUrl"
        target="_blank"
        rel="noopener"
        class="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors no-underline"
      >
        预订
      </a>
    </div>
  </div>
</template>
