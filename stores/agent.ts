import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ThinkingStep } from '../types';

export const useAgentStore = defineStore('agent', () => {
  const thinking = ref(false);
  const steps = ref<ThinkingStep[]>([]);

  function addStep(step: ThinkingStep) {
    steps.value.push(step);
  }

  function clearSteps() {
    steps.value = [];
  }

  return { thinking, steps, addStep, clearSteps };
});
