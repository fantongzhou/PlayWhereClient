<script setup lang="ts">
import type { Activity } from '../types';
import { ref, computed } from 'vue';
import { useTripStore } from '../stores/trip';
import ImagePreview from './ImagePreview.vue';

const props = defineProps<{ activity: Activity; index: number; isLast: boolean }>();
const tripStore = useTripStore();

const typeConfig: Record<string, { icon: string }> = {
  attraction: { icon: '📍' },
  restaurant: { icon: '🍽️' },
  hotel: { icon: '🏨' },
};

const images = computed(() => props.activity.imageUrls?.filter(u => !!u) ?? []);
const previewIndex = ref<number | null>(null);

function focusOnMap() {
  if (props.activity.name) {
    tripStore.setFocus(props.activity.name, tripStore.plan?.city || '');
  }
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}
</script>

<template>
  <div class="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer" @click="focusOnMap">
    <!-- 时间列 -->
    <div class="flex flex-col items-center shrink-0 w-11">
      <span class="text-xs font-bold text-slate-400 tabular-nums">{{ activity.time }}</span>
    </div>

    <!-- 内容 -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-slate-800 truncate">
        <span class="mr-1.5">{{ typeConfig[activity.type]?.icon || '📍' }}</span>
        {{ activity.name }}
      </p>
      <p v-if="activity.note" class="text-[11px] text-slate-500 truncate mt-0.5">{{ activity.note }}</p>
      <span class="text-[11px] text-slate-400 mt-0.5 inline-block">{{ activity.duration }}</span>

      <!-- 图片缩略图 -->
      <div v-if="images.length" class="flex gap-1.5 mt-2 overflow-x-auto">
        <img
          v-for="(img, i) in images"
          :key="i"
          :src="img"
          :alt="activity.name"
          loading="lazy"
          class="w-14 h-11 object-cover rounded-md border border-gray-200 cursor-pointer shrink-0 hover:shadow-md transition-shadow"
          @click.stop="previewIndex = i"
          @error="onImgError"
        />
      </div>
    </div>

    <!-- 预订链接 -->
    <a
      v-if="activity.bookingUrl"
      :href="activity.bookingUrl"
      target="_blank"
      rel="noopener"
      class="shrink-0 text-slate-400 hover:text-blue-500 transition-colors"
      @click.stop
      title="预订/购票"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
    </a>

    <!-- 图片预览 -->
    <ImagePreview
      v-if="previewIndex !== null"
      :images="images"
      v-model="previewIndex"
    />
  </div>
</template>
