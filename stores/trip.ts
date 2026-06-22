import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TripPlan, DayPlan, RouteSegment } from '../types';

export const useTripStore = defineStore('trip', () => {
  const loading = ref(false);
  const request = ref<string | null>(null);
  const plan = ref<TripPlan | null>(null);
  const activeDay = ref(1);
  const routesByDay = ref<Record<number, RouteSegment[]>>({});
  const focusActivity = ref<{ name: string; city: string } | null>(null);

  function setFocus(name: string, city: string) {
    focusActivity.value = { name, city };
  }

  function setRequest(msg: string) {
    request.value = msg;
    plan.value = null;
    activeDay.value = 1;
    routesByDay.value = {};
  }

  function setPlan(p: TripPlan) {
    plan.value = p;
    loading.value = false;
  }

  function setRoutesForDay(day: number, routes: RouteSegment[]) {
    routesByDay.value[day] = routes;
  }

  function getRoutesForDay(day: number): RouteSegment[] {
    return routesByDay.value[day] || [];
  }

  function getActiveDay(): DayPlan | null {
    if (!plan.value) return null;
    return plan.value.days.find(d => d.day === activeDay.value) || null;
  }

  function reorderActivity(dayIndex: number, fromIndex: number, toIndex: number) {
    if (!plan.value) return;
    const day = plan.value.days[dayIndex];
    const [moved] = day.activities.splice(fromIndex, 1);
    day.activities.splice(toIndex, 0, moved);
  }

  return {
    loading,
    request,
    plan,
    activeDay,
    routesByDay,
    focusActivity,
    setFocus,
    setRequest,
    setPlan,
    setRoutesForDay,
    getRoutesForDay,
    getActiveDay,
    reorderActivity,
  };
});
