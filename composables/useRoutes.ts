import { useTripStore } from '../stores/trip';
import type { TransportMode, RouteInfo, RouteSegment } from '../types';

// ==================== 高德 REST API 端点 ====================
const API = {
  driving: 'https://restapi.amap.com/v5/direction/driving',
  walking: 'https://restapi.amap.com/v5/direction/walking',
  bicycling: 'https://restapi.amap.com/v5/direction/bicycling',
  transit: 'https://restapi.amap.com/v5/direction/transit/integrated',
} as const;

// ==================== 交通方式元信息 ====================
export const TRANSPORT_META: Record<TransportMode, { label: string; icon: string; color: string }> = {
  walking:    { label: '步行',   icon: '🚶', color: '#10b981' },
  bicycling:  { label: '骑行',   icon: '🚲', color: '#06b6d4' },
  driving:    { label: '打车',   icon: '🚗', color: '#6366f1' },
  transit:    { label: '公交',   icon: '🚌', color: '#f59e0b' },
};

// ==================== 自动推荐 ====================
function recommendMode(
  distanceMeters: number,
  budget: string,
  availableModes: TransportMode[],
): TransportMode {
  const km = distanceMeters / 1000;

  // 预算权重
  const budgetWeight = budget === 'budget' ? 1 : budget === 'moderate' ? 0.5 : 0;

  // 每种模式评分（越低越好）
  const scores: Partial<Record<TransportMode, number>> = {};

  for (const mode of availableModes) {
    let score = 0;
    switch (mode) {
      case 'walking':
        score = km > 2 ? 999 : km * 10; // >2km 不推荐步行
        break;
      case 'bicycling':
        score = km > 8 ? 999 : km * 3 + budgetWeight * 2; // >8km 不推荐骑行
        break;
      case 'transit':
        score = 20 + km * 1 + budgetWeight * 5; // 基础等待成本
        break;
      case 'driving':
        score = 15 + km * 0.5 - budgetWeight * 20; // 舒适但贵，预算越低分越高（越不推荐）
        break;
    }
    scores[mode] = score;
  }

  // 选最低分
  let best: TransportMode = availableModes[0];
  let bestScore = Infinity;
  for (const mode of availableModes) {
    const s = scores[mode] ?? Infinity;
    if (s < bestScore) { bestScore = s; best = mode; }
  }
  return best;
}

// ==================== 解析 polyline ====================
function parsePolyline(polyStr: string): [number, number][] {
  if (!polyStr) return [];
  return polyStr.split(';').map(pair => {
    const [lng, lat] = pair.split(',').map(Number);
    return [lng, lat] as [number, number];
  });
}

// ==================== 调用高德 API ====================
async function fetchAmapRoute(
  mode: TransportMode,
  origin: string,
  destination: string,
  key: string,
  city?: string,
): Promise<RouteInfo | null> {
  const params = new URLSearchParams({ key, origin, destination, output: 'JSON' });

  if (mode === 'driving') {
    params.set('strategy', '32');
    params.set('show_fields', 'polyline,cost,duration');
  }
  if (mode === 'walking') {
    params.set('show_fields', 'polyline,cost,duration');
  }
  if (mode === 'bicycling') {
    params.set('show_fields', 'polyline,cost,duration');
  }
  if (mode === 'transit') {
    params.set('show_fields', 'polyline,cost,duration');
    if (city) params.set('city', city);
  }

  const url = `${API[mode]}?${params.toString()}`;

  try {
    const resp = await fetch(url);
    const data: any = await resp.json();

    if (data.status !== '1') return null;

    let path: [number, number][] = [];
    let distance = 0;
    let duration = 0;
    let price = 0;

    // 从 API 响应中提取费用（只取打车费，高德字段值均为 string）
    const extractCost = (routeObj: any): number => Number(routeObj?.taxi_cost) || 0;

    if (mode === 'transit') {
      const transit = data.route?.transits?.[0];
      if (!transit) return null;
      distance = Number(transit.distance) || 0;
      duration = Number(transit.cost?.duration) || Number(transit.duration) || 0;
      price = extractCost(data.route);
      // 合并各段 polyline
      for (const seg of transit.segments || []) {
        if (seg.walking?.polyline) path.push(...parsePolyline(seg.walking.polyline));
        if (seg.bus?.polyline) path.push(...parsePolyline(seg.bus.polyline));
        if (seg.railway?.polyline) path.push(...parsePolyline(seg.railway.polyline));
      }
    } else {
      const route = data.route?.paths?.[0];
      if (!route) return null;
      distance = Number(route.distance) || 0;
      duration = Number(route.cost?.duration) || Number(route.duration) || 0;
      price = extractCost(data.route);
      for (const step of route.steps || []) {
        if (step.polyline) path.push(...parsePolyline(step.polyline));
      }
    }

    if (distance === 0) return null;

    return { mode, distance, duration, price, polyline: path };
  } catch {
    return null;
  }
}

// ==================== 计算单段多模式路线 ====================
async function computeSegment(
  from: { name: string; lat: number; lng: number },
  to: { name: string; lat: number; lng: number },
  key: string,
  wsKey: string,
  budget: string,
  city?: string,
): Promise<RouteSegment | null> {
  const origin = `${from.lng},${from.lat}`;
  const destination = `${to.lng},${to.lat}`;
  const routeKey = wsKey || key;

  // 先用打车距离判断该查哪些模式
  const drivingInfo = await fetchAmapRoute('driving', origin, destination, routeKey, city);

  if (!drivingInfo) {
    // 打车不可达，尝试步行
    const walkInfo = await fetchAmapRoute('walking', origin, destination, routeKey);
    if (!walkInfo) return null;
    return {
      from, to,
      recommended: 'walking',
      selected: 'walking',
      routes: { walking: walkInfo },
    };
  }

  const dist = drivingInfo.distance;
  const modes: TransportMode[] = ['driving'];

  if (dist <= 3000) modes.push('walking');
  if (dist <= 10000) modes.push('bicycling');

  // 并行查询步行/骑行
  const promises: Promise<RouteInfo | null>[] = [];
  const modeOrder: TransportMode[] = [];
  for (const m of modes) {
    if (m === 'driving') continue;
    modeOrder.push(m);
    promises.push(fetchAmapRoute(m, origin, destination, routeKey, city));
  }

  const results = await Promise.all(promises);
  const routes: Partial<Record<TransportMode, RouteInfo>> = { driving: drivingInfo };

  for (let i = 0; i < modeOrder.length; i++) {
    const info = results[i];
    if (info) routes[modeOrder[i]] = info;
  }

  // 公交不调 API，始终保留入口（点击后唤起高德地图）
  routes.transit = {
    mode: 'transit',
    distance: 0,
    duration: 0,
    price: 0,
    polyline: [],
  };

  const availableModes = Object.keys(routes) as TransportMode[];
  const recommended = recommendMode(dist, budget, availableModes.filter(m => m !== 'transit'));
  // 公交不做推荐，保持推荐结果在步行/骑行/打车中选

  return {
    from, to,
    recommended,
    selected: recommended,
    routes,
  };
}

// ==================== 主入口：计算一天所有路线段 ====================
export function useRoutes() {
  const tripStore = useTripStore();
  const config = useRuntimeConfig();

  async function computeAndStoreRoutes() {
    const plan = tripStore.plan;
    if (!plan) return;

    const key = config.public.amapKey as string;
    const wsKey = config.public.amapWsKey as string;
    const routeKey = wsKey || key;
    if (!routeKey) {
      console.warn('[useRoutes] 缺少高德 API Key');
      return;
    }

    const budget = plan.totalBudget?.includes('经济') ? 'budget'
      : plan.totalBudget?.includes('奢华') ? 'luxury'
      : 'moderate';

    for (const day of plan.days) {
      const waypoints: { name: string; lat: number; lng: number }[] = [];

      for (const a of day.activities) {
        if (a.lat && a.lng) {
          waypoints.push({ name: a.name, lat: a.lat, lng: a.lng });
        }
      }
      // 酒店作为最后一个途经点
      if (day.hotel?.lat && day.hotel?.lng) {
        waypoints.push({ name: day.hotel.name, lat: day.hotel.lat, lng: day.hotel.lng });
      }

      if (waypoints.length < 2) continue;

      const segments: RouteSegment[] = [];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const seg = await computeSegment(
          waypoints[i], waypoints[i + 1],
          key, wsKey, budget, plan.city,
        );
        if (seg) segments.push(seg);
      }

      tripStore.setRoutesForDay(day.day, segments);
    }
  }

  /** 用户切换某段的交通方式 */
  function selectMode(dayIndex: number, segIndex: number, mode: TransportMode) {
    const day = tripStore.plan?.days[dayIndex];
    if (!day) return;
    const routes = tripStore.getRoutesForDay(day.day);
    if (segIndex < 0 || segIndex >= routes.length) return;
    routes[segIndex].selected = mode;
    // 触发响应式更新
    tripStore.setRoutesForDay(day.day, [...routes]);
  }

  return { computeAndStoreRoutes, selectMode };
}
