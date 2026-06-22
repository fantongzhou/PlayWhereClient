<script setup lang="ts">
import { computed } from 'vue';
import type { RouteSegment, TransportMode } from '../types';
import { TRANSPORT_META, useRoutes } from '../composables/useRoutes';
import { useTripStore } from '../stores/trip';

const props = defineProps<{
  segment: RouteSegment;
  segIndex: number;
  dayNumber: number;
}>();

const tripStore = useTripStore();
const { selectMode: selectRouteMode } = useRoutes();

const availableModes = computed(() => {
  return (Object.keys(props.segment.routes) as TransportMode[]).sort((a, b) => {
    // 公交始终放最后
    if (a === 'transit') return 1;
    if (b === 'transit') return -1;
    const pa = props.segment.routes[a]?.price ?? 0;
    const pb = props.segment.routes[b]?.price ?? 0;
    return pa - pb;
  });
});

const isTransit = (mode: TransportMode) => mode === 'transit';
const hasRouteData = (mode: TransportMode) => (props.segment.routes[mode]?.distance ?? 0) > 0;

function selectMode(mode: TransportMode) {
  if (isTransit(mode)) {
    openAmapTransit();
    return;
  }
  const dayIdx = tripStore.plan?.days.findIndex(d => d.day === props.dayNumber) ?? 0;
  selectRouteMode(dayIdx, props.segIndex, mode);
}

function openAmapTransit() {
  const from = props.segment.from;
  const to = props.segment.to;
  const url = `https://uri.amap.com/navigation?from=${from.lng},${from.lat},${encodeURIComponent(from.name)}&to=${to.lng},${to.lat},${encodeURIComponent(to.name)}&mode=transit`;
  window.open(url, '_blank');
}

function formatDist(m: number): string {
  if (m < 1000) return `${m}米`;
  return `${(m / 1000).toFixed(1)}公里`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}分钟`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}
</script>

<template>
  <div class="pl-12 mb-0.5">
    <!-- 当前选中模式摘要 -->
    <div class="flex items-stretch">
      <div class="route-line w-0.5 mr-2 min-h-5 shrink-0" />
      <div class="flex items-center gap-1.5 text-[11px] text-slate-400 py-0.5">
        <span class="text-sm">{{ TRANSPORT_META[segment.selected]?.icon }}</span>
        <span class="font-semibold text-slate-500">{{ TRANSPORT_META[segment.selected]?.label }}</span>
        <template v-if="isTransit(segment.selected)">
          <span class="text-amber-500">点击下方按钮唤起高德地图</span>
        </template>
        <template v-else>
          <span v-if="segment.routes[segment.selected]?.distance" class="text-slate-400">{{ formatDist(segment.routes[segment.selected]?.distance ?? 0) }}</span>
          <span class="text-indigo-500 font-medium">{{ formatDuration(segment.routes[segment.selected]?.duration ?? 0) }}</span>
          <span class="text-amber-500 font-medium">{{ segment.routes[segment.selected]?.price ? `¥${segment.routes[segment.selected]?.price}` : '免费' }}</span>
        </template>
      </div>
    </div>

    <!-- 模式选择器 -->
    <div class="flex gap-1 ml-3.5 mt-1 flex-wrap">
      <button
        v-for="mode in availableModes"
        :key="mode"
        class="flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-full bg-white cursor-pointer text-[11px] transition-colors hover:border-slate-300 hover:bg-slate-50"
        :class="{ 'border-blue-500 bg-blue-50 font-semibold text-blue-600': segment.selected === mode && !isTransit(mode) }"
        @click="selectMode(mode)"
      >
        <span class="text-xs">{{ TRANSPORT_META[mode]?.icon }}</span>
        <span class="text-slate-600">{{ TRANSPORT_META[mode]?.label }}</span>
        <span v-if="isTransit(mode)" class="text-amber-500 text-[10px]">高德地图</span>
        <span v-else class="text-slate-400 text-[10px]">
          {{ formatDuration(segment.routes[mode]?.duration ?? 0) }}
          · {{ segment.routes[mode]?.price ? `¥${segment.routes[mode]?.price}` : '' }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.route-line {
  background: repeating-linear-gradient(
    to bottom,
    #cbd5e1 0px,
    #cbd5e1 4px,
    transparent 4px,
    transparent 8px
  );
}
</style>
