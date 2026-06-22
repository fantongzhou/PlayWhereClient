<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue';

/**
 * 全屏图片预览（相册）组件
 * - v-model: number | null  (null = 关闭，数字 = 当前展示的图片索引)
 * - 多图支持「上一张/下一张」+ 键盘 ←/→/Esc
 * - 点击背景层关闭，点击图片不关闭
 */
const props = defineProps<{
  images: string[];
  modelValue: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
}>();

const hasMultiple = computed(() => props.images.length > 1);
const current = computed(() => props.modelValue ?? 0);

function clampIndex(i: number): number {
  const len = props.images.length;
  if (len === 0) return 0;
  return ((i % len) + len) % len;
}

function prev() {
  if (!hasMultiple.value) return;
  emit('update:modelValue', clampIndex(current.value - 1));
}

function next() {
  if (!hasMultiple.value) return;
  emit('update:modelValue', clampIndex(current.value + 1));
}

function close() {
  emit('update:modelValue', null);
}

function onKeydown(e: KeyboardEvent) {
  if (props.modelValue === null) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prev();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    next();
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown);
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center cursor-zoom-out" @click="close">
      <!-- 计数器 -->
      <div v-if="hasMultiple" class="absolute top-5 left-1/2 -translate-x-1/2 text-white text-sm font-medium bg-white/10 px-3.5 py-1 rounded-2xl tabular-nums" @click.stop>
        {{ current + 1 }} / {{ images.length }}
      </div>

      <!-- 关闭按钮 -->
      <button class="absolute top-4 right-5 w-10 h-10 border-0 rounded-full bg-white/10 text-white text-2xl leading-none cursor-pointer flex items-center justify-center transition-colors duration-150 hover:bg-white/25" title="关闭 (Esc)" @click.stop="close">×</button>

      <!-- 上一张 -->
      <button
        v-if="hasMultiple"
        class="nav-btn nav-prev left-5"
        title="上一张 (←)"
        @click.stop="prev"
      >
        ‹
      </button>

      <!-- 图片 -->
      <img
        v-if="images[current]"
        :src="images[current]"
        class="max-w-[90vw] max-h-[85vh] object-contain rounded-md shadow-2xl cursor-default"
        :key="images[current]"
        @click.stop
        @error="($event.target as HTMLImageElement).style.opacity = '0.2'"
      />

      <!-- 下一张 -->
      <button
        v-if="hasMultiple"
        class="nav-btn nav-next right-5"
        title="下一张 (→)"
        @click.stop="next"
      >
        ›
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.nav-btn {
  @apply absolute top-1/2 -translate-y-1/2 w-12 h-16 border-0 rounded-lg bg-white/10 text-white text-4xl leading-none cursor-pointer flex items-center justify-center transition-all duration-150;
}
.nav-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}
.nav-prev:hover {
  transform: translateY(-50%) translateX(-2px);
}
.nav-next:hover {
  transform: translateY(-50%) translateX(2px);
}
</style>
