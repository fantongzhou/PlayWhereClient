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
  | 'start' | 'thought' | 'action' | 'observation'
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
export const CITIES = ['京都', '东京', '大阪'] as const;

export const PREFERENCES = [
  { label: '文化历史', icon: '🏛️' },
  { label: '自然风光', icon: '🏔️' },
  { label: '美食购物', icon: '🍣' },
  { label: '娱乐休闲', icon: '🎢' },
  { label: '亲子游', icon: '👨‍👩‍👧' },
] as const;

// ---- 路线导航 ----
export interface RouteSegment {
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
  path: [number, number][];
  distance: number;
  mode: string;
  duration: number;
  price: number;
}

export const BUDGETS = [
  { label: '经济', value: 'budget', icon: '💰' },
  { label: '适中', value: 'moderate', icon: '💎' },
  { label: '奢华', value: 'luxury', icon: '👑' },
] as const;
