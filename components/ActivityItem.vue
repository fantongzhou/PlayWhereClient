<script setup lang="ts">
import type { Activity } from '../types';
import { ref, computed } from 'vue';
import { useTripStore } from '../stores/trip';
import ImagePreview from './ImagePreview.vue';

const props = defineProps<{ activity: Activity; index: number; isLast: boolean }>();
const tripStore = useTripStore();

const typeConfig: Record<string, { icon: string; color: string }> = {
  attraction: { icon: '📍', color: '#2563eb' },
  restaurant: { icon: '🍽️', color: '#f59e0b' },
  hotel: { icon: '🏨', color: '#10b981' },
};

const images = computed(() => props.activity.imageUrls?.filter(u => !!u) ?? []);
const previewIndex = ref<number | null>(null);

function focusOnMap() {
  if (props.activity.name) {
    tripStore.setFocus(props.activity.name, tripStore.plan?.city || '');
  }
}
</script>

<template>
  <div class="flex gap-3 pb-1">
    <!-- 时间 -->
    <div class="flex flex-col items-center w-[44px] shrink-0">
      <span class="text-xs font-semibold text-primary tabular-nums py-0.5">{{ activity.time }}</span>
      <div v-if="!isLast" class="w-0.5 flex-1 bg-border min-h-[20px] my-0.5" />
    </div>

    <!-- 内容 -->
    <div class="flex-1 min-w-0">
      <div class="bg-bg-panel rounded-lg px-3.5 py-2.5 mb-2 transition-all duration-150 cursor-pointer hover:bg-[#e8ecf4]" @click="focusOnMap">
        <div class="flex items-center gap-2">
          <span
            class="w-[22px] h-[22px] rounded-md flex items-center justify-center text-xs shrink-0"
            :style="{ background: typeConfig[activity.type]?.color || '#666' }"
          >
            {{ typeConfig[activity.type]?.icon || '📍' }}
          </span>
          <strong class="text-sm flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ activity.name }}</strong>
          <span class="text-[11px] text-text-secondary bg-black/5 px-2 py-0.5 rounded-[10px] shrink-0">{{ activity.duration }}</span>
        </div>
        <p class="text-xs text-text-secondary mt-1 pl-[30px]" v-if="activity.note">{{ activity.note }}</p>

        <!-- 景点图片缩略图（横向滚动） -->
        <div class="flex gap-1.5 mt-2 pl-[30px] overflow-x-auto" v-if="images.length">
          <img
            v-for="(img, i) in images"
            :key="i"
            :src="img"
            :alt="activity.name"
            loading="lazy"
            class="w-16 h-[54px] object-cover rounded-md border border-border cursor-pointer shrink-0 bg-bg-panel transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
            @click="previewIndex = i"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
        </div>

        <!-- 购票/预订链接 -->
        <a
          v-if="activity.bookingUrl"
          :href="activity.bookingUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1 mt-1.5 px-3 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-br from-warning to-error no-underline transition-all duration-150 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(245,158,11,0.3)]"
        >
          🎫 {{ activity.type === 'restaurant' ? '订座/外卖' : activity.type === 'hotel' ? '立即预订' : '购票/预订' }}
        </a>
      </div>

      <!-- 图片预览（相册） -->
      <ImagePreview
        v-if="previewIndex !== null"
        :images="images"
        v-model="previewIndex"
      />
    </div>
  </div>
</template>
