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
    <div class="image-preview-overlay" @click="close">
      <!-- 计数器 -->
      <div v-if="hasMultiple" class="counter" @click.stop>
        {{ current + 1 }} / {{ images.length }}
      </div>

      <!-- 关闭按钮 -->
      <button class="close-btn" title="关闭 (Esc)" @click.stop="close">×</button>

      <!-- 上一张 -->
      <button
        v-if="hasMultiple"
        class="nav-btn nav-prev"
        title="上一张 (←)"
        @click.stop="prev"
      >
        ‹
      </button>

      <!-- 图片 -->
      <img
        v-if="images[current]"
        :src="images[current]"
        class="preview-image"
        :key="images[current]"
        @click.stop
        @error="($event.target as HTMLImageElement).style.opacity = '0.2'"
      />

      <!-- 下一张 -->
      <button
        v-if="hasMultiple"
        class="nav-btn nav-next"
        title="下一张 (→)"
        @click.stop="next"
      >
        ›
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.preview-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  cursor: default;
}

.counter {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.12);
  padding: 4px 14px;
  border-radius: 14px;
  font-variant-numeric: tabular-nums;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 64px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 36px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, transform 0.15s;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.nav-prev {
  left: 20px;
}

.nav-next {
  right: 20px;
}

.nav-prev:hover {
  transform: translateY(-50%) translateX(-2px);
}

.nav-next:hover {
  transform: translateY(-50%) translateX(2px);
}
</style>
