import { watch } from 'vue';
import { useTripStore } from '../stores/trip';
import type { RouteSegment, Activity } from '../types';

export function useRoutes() {
  const tripStore = useTripStore();

  async function fetchRoutesForDay(day: number): Promise<RouteSegment[]> {
    const dayPlan = tripStore.plan?.days.find(d => d.day === day);
    if (!dayPlan) return [];

    // 收集有坐标的 activities（景点/餐厅）+ 酒店
    const waypoints: { name: string; lat: number; lng: number }[] = [];

    for (const a of dayPlan.activities) {
      if (a.lat && a.lng) {
        waypoints.push({ name: a.name, lat: a.lat, lng: a.lng });
      }
    }

    // 最后加入酒店作为终点
    if (dayPlan.hotel && dayPlan.hotel.lat && dayPlan.hotel.lng) {
      waypoints.push({
        name: dayPlan.hotel.name,
        lat: dayPlan.hotel.lat,
        lng: dayPlan.hotel.lng,
      });
    }

    if (waypoints.length < 2) return [];

    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints }),
      });

      if (!res.ok) return [];

      const data = await res.json();
      return data.segments || [];
    } catch {
      return [];
    }
  }

  async function loadAllRoutes() {
    if (!tripStore.plan) return;

    for (const day of tripStore.plan.days) {
      const routes = await fetchRoutesForDay(day.day);
      tripStore.setRoutesForDay(day.day, routes);
    }
  }

  // 行程生成完成后自动加载路线
  watch(() => tripStore.plan, (plan) => {
    if (plan) {
      loadAllRoutes();
    }
  });

  return { fetchRoutesForDay, loadAllRoutes };
}
