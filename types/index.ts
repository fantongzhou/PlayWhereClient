// ============================================================
// 共享类型 — 与 server/src/types.ts 保持一致
// ============================================================

export interface TripRequest {
  city: string;
  days: number;
  preferences: string[];
  budget: 'budget' | 'moderate' | 'luxury';
}

export interface Activity {
  time: string;
  name: string;
  lat: number;
  lng: number;
  type: 'attraction' | 'restaurant' | 'hotel';
  duration: string;
  note: string;
  /** 购票/预订链接（飞猪返回） */
  bookingUrl?: string;
  /** 景点图片（飞猪返回） */
  imageUrls?: string[];
}

export interface DayPlan {
  day: number;
  date: string;
  weather: {
    condition: string;
    temperature: { low: number; high: number };
    suggestion: string;
  } | null;
  activities: Activity[];
  hotel: {
    name: string;
    lat: number;
    lng: number;
    pricePerNight: number;
    /** 预订链接（飞猪返回） */
    bookingUrl?: string;
  } | null;
}

export interface TripPlan {
  city: string;
  days: DayPlan[];
  totalBudget: string;
  tips: string[];
}

// ---- SSE 事件 ----
export type SSEEventType =
  | 'start' | 'thought' | 'response' | 'action' | 'observation'
  | 'plan_partial' | 'plan_complete' | 'error';

export interface ThinkingStep {
  type: SSEEventType;
  step: number;
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  data?: unknown;
}

// ---- 预设选项 ----
export const CITIES = ['北京', '上海', '三亚', '成都', '西安', '杭州'] as const;

export const PREFERENCES = [
  { label: '文化历史', icon: '🏛️' },
  { label: '自然风光', icon: '🏔️' },
  { label: '美食购物', icon: '🍜' },
  { label: '娱乐休闲', icon: '🎢' },
  { label: '亲子游', icon: '👨‍👩‍👧' },
] as const;

// ---- 路线导航 ----
export type TransportMode = 'walking' | 'bicycling' | 'driving' | 'transit';

/** 单条路线信息 */
export interface RouteInfo {
  mode: TransportMode;
  distance: number;   // 米
  duration: number;   // 秒
  price: number;      // 预估费用（元）
  polyline: [number, number][];
}

/** 两点间的路线段（含多模式 + 推荐） */
export interface RouteSegment {
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
  recommended: TransportMode;
  selected: TransportMode;
  routes: Partial<Record<TransportMode, RouteInfo>>;
}

export const BUDGETS = [
  { label: '经济', value: 'budget', icon: '💰' },
  { label: '适中', value: 'moderate', icon: '💎' },
  { label: '奢华', value: 'luxury', icon: '👑' },
] as const;

// 城市中心坐标（国内）
export const CITY_CENTERS: Record<string, [number, number]> = {
  '北京': [39.9042, 116.4074],
  '上海': [31.2304, 121.4737],
  '三亚': [18.2528, 109.5120],
  '成都': [30.5728, 104.0668],
  '西安': [34.3416, 108.9398],
  '杭州': [30.2741, 120.1551],
};

// 中国地图默认中心与边界
export const CHINA_CENTER: [number, number] = [35.86, 104.19];
export const CHINA_BOUNDS: [[number, number], [number, number]] = [[18, 73], [54, 135]];
