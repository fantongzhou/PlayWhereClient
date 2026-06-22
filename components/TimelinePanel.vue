<script setup lang="ts">
import { useTripStore } from '../stores/trip';
import DayCard from './DayCard.vue';

const tripStore = useTripStore();
</script>

<template>
  <div class="flex-1 overflow-y-auto px-5 pb-5">
    <div class="py-4">
      <h3 class="text-base font-semibold flex items-center gap-2">
        <span class="text-[20px]">📋</span>
        {{ tripStore.plan?.city }} {{ tripStore.plan?.days.length }}日行程
      </h3>
    </div>

    <!-- 日期切换 tabs -->
    <div class="flex gap-1.5 mb-4 flex-wrap">
      <button
        v-for="day in tripStore.plan?.days"
        :key="day.day"
        class="px-4 py-2 border border-border rounded-lg text-[13px] font-medium cursor-pointer bg-bg-card text-text-secondary transition-all duration-150 flex items-center gap-1.5"
        :class="{ '!bg-primary !text-white !border-primary': tripStore.activeDay === day.day }"
        @click="tripStore.activeDay = day.day"
      >
        Day {{ day.day }}
        <span class="text-sm">
          {{ day.weather?.condition === '晴' ? '☀️' :
             day.weather?.condition === '多云' ? '⛅' :
             day.weather?.condition === '阴' ? '☁️' :
             day.weather?.condition === '小雨' ? '🌧️' : '🌤️' }}
        </span>
      </button>
    </div>

    <!-- 当前天的详细行程 -->
    <div class="min-h-[200px]" v-if="tripStore.plan?.days">
      <DayCard
        v-for="day in tripStore.plan.days.filter(d => d.day === tripStore.activeDay)"
        :key="day.day"
        :day="day"
      />
    </div>

    <!-- 预算与提示 -->
    <div class="mt-5 pt-4 border-t border-border" v-if="tripStore.plan">
      <div class="px-4 py-3 bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] rounded-lg text-[13px] text-[#065f46] flex items-center gap-2 mb-3">
        <span class="text-base">💵</span>
        <span>{{ tripStore.plan.totalBudget }}</span>
      </div>
      <div class="px-4 py-3 bg-bg-panel rounded-lg" v-if="tripStore.plan.tips.length > 0">
        <div class="text-[13px] font-semibold mb-2">💡 旅行贴士</div>
        <ul class="list-none p-0">
          <li v-for="(tip, i) in tripStore.plan.tips" :key="i" class="tip-item text-xs text-text-secondary py-1 pl-4 relative">
            {{ tip }}
          </li>
        </ul>
      </div>
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
