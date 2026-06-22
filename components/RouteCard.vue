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
    const pa = props.segment.routes[a]?.price ?? 0;
    const pb = props.segment.routes[b]?.price ?? 0;
    return pa - pb;
  });
});

function selectMode(mode: TransportMode) {
  const dayIdx = tripStore.plan?.days.findIndex(d => d.day === props.dayNumber) ?? 0;
  selectRouteMode(dayIdx, props.segIndex, mode);
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
  <div class="pl-14 mb-0.5">
    <!-- 当前选中模式的摘要 -->
    <div class="flex items-stretch">
      <div class="route-line w-0.5 mr-2.5 min-h-6 shrink-0" />
      <div class="flex items-center gap-1.5 text-xs text-[#64748b] py-1">
        <span class="text-sm">{{ TRANSPORT_META[segment.selected]?.icon }}</span>
        <span class="font-semibold text-[#475569]">{{ TRANSPORT_META[segment.selected]?.label }}</span>
        <span class="text-[#94a3b8]">{{ formatDist(segment.routes[segment.selected]?.distance ?? 0) }}</span>
        <span class="text-[#6366f1] font-medium">{{ formatDuration(segment.routes[segment.selected]?.duration ?? 0) }}</span>
        <span v-if="segment.routes[segment.selected]?.price" class="text-warning font-medium">
          ¥{{ segment.routes[segment.selected]?.price }}
        </span>
      </div>
    </div>

    <!-- 模式选择器 -->
    <div class="flex gap-1 mt-1 flex-wrap">
      <button
        v-for="mode in availableModes"
        :key="mode"
        class="flex items-center gap-[3px] px-2 py-[3px] border-[1.5px] border-border rounded-2xl bg-white cursor-pointer text-[11px] transition-all duration-150 whitespace-nowrap hover:border-[#94a3b8]"
        :class="{ 'border-2 font-semibold': segment.selected === mode }"
        :style="segment.selected === mode ? { borderColor: TRANSPORT_META[mode]?.color, background: TRANSPORT_META[mode]?.color + '15' } : {}"
        @click="selectMode(mode)"
        :title="`${TRANSPORT_META[mode]?.label}: ${formatDist(segment.routes[mode]?.distance ?? 0)} · ${formatDuration(segment.routes[mode]?.duration ?? 0)}${segment.routes[mode]?.price ? ' · ¥' + segment.routes[mode]?.price : ''}`"
      >
        <span class="text-[13px]">{{ TRANSPORT_META[mode]?.icon }}</span>
        <span class="text-[#475569]">{{ TRANSPORT_META[mode]?.label }}</span>
        <span class="text-[#94a3b8] text-[10px]">
          {{ formatDuration(segment.routes[mode]?.duration ?? 0) }}
          <template v-if="segment.routes[mode]?.price"> · ¥{{ segment.routes[mode]?.price }}</template>
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
