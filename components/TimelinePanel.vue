<script setup lang="ts">
import { useTripStore } from '../stores/trip';
import DayCard from './DayCard.vue';

const props = withDefaults(defineProps<{
  /** 平铺模式：不设 flex-1 和内滚，由外层容器统一滚动（移动端 drawer 使用） */
  flat?: boolean;
}>(), { flat: false });

const tripStore = useTripStore();

function getWeatherIcon(condition: string): string {
  if (!condition) return '🌤️';
  if (condition.includes('晴')) return '☀️';
  if (condition.includes('多云')) return '⛅';
  if (condition.includes('阴')) return '☁️';
  if (condition.includes('雨')) return '🌧️';
  if (condition.includes('雪')) return '❄️';
  return '🌤️';
}
</script>

<template>
  <div :class="['flex flex-col', props.flat ? '' : 'h-full']" v-if="tripStore.plan">
    <!-- 头部 -->
    <div class="px-4 py-3 border-b border-gray-100 shrink-0">
      <h2 class="text-base font-bold text-slate-900">
        Your Itinerary: {{ tripStore.plan.city }}
      </h2>
      <p class="text-xs text-slate-500 mt-0.5">{{ tripStore.plan.days.length }} 天行程 · {{ tripStore.plan.totalBudget }}</p>
    </div>

    <!-- 日期切换 pills -->
    <div class="flex gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-gray-100 shrink-0">
      <button
        v-for="day in tripStore.plan.days"
        :key="day.day"
        class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        :class="tripStore.activeDay === day.day
          ? 'bg-blue-600 text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'"
        @click="tripStore.activeDay = day.day"
      >
        Day {{ day.day }} {{ getWeatherIcon(day.weather?.condition || '') }}
      </button>
    </div>

    <!-- 行程内容（flat 模式下不设 flex-1 和 overflow，由外层滚动） -->
    <div :class="props.flat ? 'p-4 space-y-6' : 'flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar'">
      <DayCard
        v-for="day in tripStore.plan.days.filter(d => d.day === tripStore.activeDay)"
        :key="day.day"
        :day="day"
      />
    </div>

    <!-- 底部：旅行贴士 -->
    <div v-if="tripStore.plan.tips.length > 0" class="px-4 py-3 border-t border-gray-100 shrink-0 space-y-2">
      <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">💡 旅行贴士</h4>
      <ul class="space-y-1.5">
        <li v-for="(tip, i) in tripStore.plan.tips" :key="i" class="tip-item text-xs text-slate-500 pl-4 relative">
          {{ tip }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.tip-item::before {
  content: '•';
  position: absolute;
  left: 2px;
  color: #2563eb;
}
</style>
