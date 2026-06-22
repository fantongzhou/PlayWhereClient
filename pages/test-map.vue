<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

// ==================== 类型定义 ====================
interface Waypoint {
  id: number;
  name: string;
  address: string;
  lng: number;
  lat: number;
}

interface RouteSegment {
  from: Waypoint;
  to: Waypoint;
  distance: number;   // 米
  duration: number;   // 秒
  path: [number, number][];  // 路线坐标
}

// 高德 v5 驾车路径规划 REST API 响应结构
interface AmapRouteStep {
  polyline: string;  // "lng,lat;lng,lat;..."
}

interface AmapRoutePath {
  distance: string;   // 米
  duration: string;   // 秒
  steps: AmapRouteStep[];
}

interface AmapRouteResponse {
  status: string;    // "1" 成功
  info: string;
  route: {
    paths: AmapRoutePath[];
  };
}

interface Suggestion {
  id: string;
  name: string;
  district: string;
  address: string;
  location: { lng: number; lat: number };
}

// ==================== 响应式状态 ====================
const config = useRuntimeConfig();
const mapContainer = ref<HTMLDivElement>();
const searchInput = ref<HTMLInputElement>();
const searchQuery = ref('');
const suggestions = ref<Suggestion[]>([]);
const showSuggestions = ref(false);
const isSearching = ref(false);
const waypoints = ref<Waypoint[]>([]);
const selectedWaypointId = ref<number | null>(null);
const mapLoaded = ref(false);
const isRouting = ref(false);
const routeSegments = ref<RouteSegment[]>([]);
const routeError = ref('');
const waypointCount = computed(() => waypoints.value.length);
const canPlanRoute = computed(() => waypoints.value.length >= 2);

const totalDistance = computed(() => {
  const d = routeSegments.value.reduce((s, seg) => s + seg.distance, 0);
  return (d / 1000).toFixed(1);
});

const totalDuration = computed(() => {
  const d = routeSegments.value.reduce((s, seg) => s + seg.duration, 0);
  const mins = Math.round(d / 60);
  if (mins < 60) return `${mins} 分钟`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} 小时 ${m} 分钟`;
});

function formatDistance(m: number): string {
  if (m < 1000) return `${m} 米`;
  return `${(m / 1000).toFixed(1)} 公里`;
}

function formatDuration(s: number): string {
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} 分钟`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} 小时 ${m} 分钟`;
}

let nextId = 1;
let map: any = null;
let mapMakers: any[] = [];
let mapPolylines: any[] = [];
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// ==================== 搜索 ====================
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  const q = searchQuery.value.trim();
  if (!q) {
    suggestions.value = [];
    showSuggestions.value = false;
    return;
  }
  searchTimer = setTimeout(() => performSearch(q), 300);
}

async function performSearch(query: string) {
  if (!map) return;
  isSearching.value = true;
  const ps = new AMap.PlaceSearch({ city: '全国', pageSize: 6 });
  ps.search(query, (status: string, result: any) => {
    isSearching.value = false;
    if (status === 'complete' && result.poiList?.pois) {
      suggestions.value = result.poiList.pois.map((poi: any, idx: number) => ({
        id: poi.id || `sug-${idx}`,
        name: poi.name,
        district: poi.district || '',
        address: poi.address || '',
        location: { lng: poi.location.lng, lat: poi.location.lat },
      }));
      showSuggestions.value = true;
    } else {
      suggestions.value = [];
    }
  });
}

function selectSuggestion(sug: Suggestion) {
  waypoints.value.push({
    id: nextId++,
    name: sug.name,
    address: `${sug.district} ${sug.address}`.trim(),
    lng: sug.location.lng,
    lat: sug.location.lat,
  });
  searchQuery.value = '';
  suggestions.value = [];
  showSuggestions.value = false;
  searchInput.value?.focus();
  map?.setZoomAndCenter(13, [sug.location.lng, sug.location.lat]);
  renderWaypoints();
}

function handleSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    showSuggestions.value = false;
  }
}

// ==================== 途经点管理 ====================
function removeWaypoint(id: number) {
  waypoints.value = waypoints.value.filter(w => w.id !== id);
  if (selectedWaypointId.value === id) selectedWaypointId.value = null;
  routeSegments.value = [];
  renderWaypoints();
}

function moveWaypoint(id: number, dir: 'up' | 'down') {
  const idx = waypoints.value.findIndex(w => w.id === id);
  if (idx < 0) return;
  const target = dir === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= waypoints.value.length) return;
  const list = [...waypoints.value];
  [list[idx], list[target]] = [list[target], list[idx]];
  waypoints.value = list;
  routeSegments.value = [];
  renderWaypoints();
}

function clearAllWaypoints() {
  waypoints.value = [];
  selectedWaypointId.value = null;
  routeSegments.value = [];
  clearMap();
}

// ==================== 路线规划 ====================
async function planRoute() {
  if (waypoints.value.length < 2 || !map) return;
  isRouting.value = true;
  routeError.value = '';

  try {
    const key = config.public.amapKey as string;
    const wp = waypoints.value;
    const segments: RouteSegment[] = [];

    for (let i = 0; i < wp.length - 1; i++) {
      const from = wp[i];
      const to = wp[i + 1];
      const url = `https://restapi.amap.com/v5/direction/driving?key=${key}&origin=${from.lng},${from.lat}&destination=${to.lng},${to.lat}&showpolyline=1&strategy=0`;
      const resp = await fetch(url);
      const data: AmapRouteResponse = await resp.json();
      if (data.status !== '1' || !data.route.paths?.[0]) {
        routeError.value = `路线规划失败: ${from.name} → ${to.name}`;
        continue;
      }
      const path = data.route.paths[0];
      const polyline: [number, number][] = [];
      for (const step of path.steps) {
        const pts = step.polyline.split(';').filter(Boolean);
        for (const pt of pts) {
          const [lng, lat] = pt.split(',').map(Number);
          if (!isNaN(lng) && !isNaN(lat)) polyline.push([lng, lat]);
        }
      }
      segments.push({
        from,
        to,
        distance: parseInt(path.distance),
        duration: parseInt(path.duration),
        path: polyline,
      });
    }

    routeSegments.value = segments;
    renderRouteOnMap();
  } catch (e: any) {
    routeError.value = e?.message || '规划失败';
  } finally {
    isRouting.value = false;
  }
}

// ==================== 地图渲染 ====================
function clearMap() {
  if (!map) return;
  map.clearMap();
  mapMakers = [];
  mapPolylines = [];
}

function renderWaypoints() {
  clearMap();
  waypoints.value.forEach((wp, idx) => {
    const content = document.createElement('div');
    content.innerHTML = `<div style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);">${idx + 1}</div>`;
    const marker = new AMap.Marker({
      position: [wp.lng, wp.lat],
      content,
      offset: new AMap.Pixel(-14, -14),
    });
    map.add(marker);
    mapMakers.push(marker);
  });
}

function renderRouteOnMap() {
  clearMap();
  renderWaypoints();

  routeSegments.value.forEach((seg) => {
    if (seg.path.length < 2) return;
    const poly = new AMap.Polyline({
      path: seg.path,
      strokeColor: '#6366f1',
      strokeWeight: 3,
      strokeOpacity: 0.7,
    });
    map.add(poly);
    mapPolylines.push(poly);
  });

  if (routeSegments.value.length > 0) {
    map.setFitView(null, false, [100, 100, 400, 100]);
  }
}

// ==================== 初始化 ====================
onMounted(async () => {
  const key = config.public.amapKey as string;
  if (!key) return;

  const securityCode = config.public.amapSecurityCode as string;
  if (securityCode) {
    (window as any)._AMapSecurityConfig = { securityJsCode: securityCode };
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.PlaceSearch`;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  } catch (e: any) {
    console.warn('高德地图加载失败:', e.message || e);
    return;
  }

  map = new AMap.Map(mapContainer.value!, {
    zoom: 5,
    mapStyle: 'amap://styles/light',
    resizeEnable: true,
  });
  mapLoaded.value = true;
});

onUnmounted(() => {
  if (map) { map.destroy(); map = null; }
});
</script>

<template>
  <div class="flex h-screen overflow-hidden font-sans">
    <!-- 左侧面板 -->
    <aside class="w-[380px] min-w-[380px] flex flex-col bg-white border-r border-border overflow-y-auto z-10 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">
      <div class="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h2 class="text-lg font-bold text-text-primary m-0">🗺️ 多地点路线规划</h2>
        <span class="text-[11px] bg-[#eff6ff] text-primary px-2.5 py-[3px] rounded-xl font-semibold">高德地图</span>
      </div>

      <!-- 搜索框 -->
      <div class="px-4 py-3 border-b border-border relative shrink-0">
        <div class="search-box flex items-center gap-2 bg-bg-panel border-[1.5px] border-border rounded-lg px-3 transition-all duration-200 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] focus-within:bg-white">
          <span class="text-base shrink-0">🔍</span>
          <input
            ref="searchInput"
            v-model="searchQuery"
            class="flex-1 py-2.5 border-0 bg-transparent text-sm text-text-primary outline-none placeholder:text-[#94a3b8] disabled:opacity-50"
            type="text"
            placeholder="输入地点名称，按 Enter 搜索..."
            :disabled="!mapLoaded"
            @input="onSearchInput"
            @keydown="handleSearchKeydown"
            @focus="suggestions.length > 0 && (showSuggestions = true)"
          />
          <span v-if="isSearching" class="text-sm animate-spin">⏳</span>
        </div>

        <!-- 搜索建议下拉 -->
        <ul v-if="showSuggestions && suggestions.length > 0" class="absolute left-4 right-4 top-[calc(100%-4px)] bg-white border border-border rounded-lg shadow-xl max-h-[280px] overflow-y-auto z-[100] list-none py-1 m-0">
          <li
            v-for="sug in suggestions"
            :key="sug.id"
            class="px-3.5 py-2.5 cursor-pointer transition-colors duration-100 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#eff6ff]"
            @mousedown.prevent="selectSuggestion(sug)"
          >
            <div class="text-sm font-semibold text-text-primary">{{ sug.name }}</div>
            <div class="text-xs text-text-secondary mt-0.5">{{ sug.district }} {{ sug.address }}</div>
          </li>
        </ul>
      </div>

      <!-- 途经点列表 -->
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div class="flex items-center justify-between px-4 pt-3 pb-1.5 shrink-0">
          <span class="text-sm font-semibold text-[#475569]">
            📍 途经点 <span class="inline-flex items-center justify-center bg-primary text-white text-[11px] min-w-[20px] h-5 rounded-[10px] px-1.5 ml-1">{{ waypointCount }}</span>
          </span>
          <button
            v-if="waypoints.length > 0"
            class="px-3 py-1 border border-border rounded-md bg-white text-xs text-error cursor-pointer transition-all duration-150 hover:bg-[#fef2f2] hover:border-[#fecaca]"
            @click="clearAllWaypoints"
          >
            清空
          </button>
        </div>

        <!-- 空状态 -->
        <div v-if="waypoints.length === 0" class="flex-1 flex flex-col items-center justify-center px-5 py-[30px] text-[#94a3b8] text-center">
          <div class="text-[40px] mb-2">📍</div>
          <p class="text-sm m-0">在上方搜索并添加地点</p>
          <p class="text-xs !mt-1 text-[#cbd5e1]">支持搜索城市、景点、地址等</p>
        </div>

        <!-- 途经点列表 -->
        <TransitionGroup name="wp-list" tag="ul" class="flex-1 overflow-y-auto px-3 pb-3 list-none m-0">
          <li
            v-for="(wp, idx) in waypoints"
            :key="wp.id"
            class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1.5 bg-[#f8fafc] border-[1.5px] border-border cursor-pointer transition-all duration-150"
            :class="{
              '!border-primary !bg-[#eff6ff] !shadow-[0_0_0_3px_rgba(37,99,235,0.1)]': selectedWaypointId === wp.id,
              'hover:border-[#93c5fd] hover:bg-[#eff6ff]': selectedWaypointId !== wp.id
            }"
            @click="selectedWaypointId = wp.id"
          >
            <div class="wp-marker w-[30px] h-[30px] rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-white text-xs font-bold flex items-center justify-center shrink-0" :class="{ '!from-[#ef4444] !to-[#dc2626]': selectedWaypointId === wp.id }">
              {{ idx + 1 }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">{{ wp.name }}</div>
              <div class="text-[11px] text-[#94a3b8] whitespace-nowrap overflow-hidden text-ellipsis mt-px">{{ wp.address }}</div>
            </div>
            <div class="flex gap-0.5 shrink-0">
              <button class="wp-btn w-[26px] h-[26px] border border-border rounded-md bg-white text-[10px] cursor-pointer text-text-secondary flex items-center justify-center transition-all duration-150 p-0" title="上移" :disabled="idx === 0" @click.stop="moveWaypoint(wp.id, 'up')">▲</button>
              <button class="wp-btn w-[26px] h-[26px] border border-border rounded-md bg-white text-[10px] cursor-pointer text-text-secondary flex items-center justify-center transition-all duration-150 p-0" title="下移" :disabled="idx === waypoints.length - 1" @click.stop="moveWaypoint(wp.id, 'down')">▼</button>
              <button class="wp-btn wp-btn-del w-[26px] h-[26px] border border-border rounded-md bg-white text-[10px] cursor-pointer text-text-secondary flex items-center justify-center transition-all duration-150 p-0" title="删除" @click.stop="removeWaypoint(wp.id)">✕</button>
            </div>
          </li>
        </TransitionGroup>
      </div>

      <!-- 路线规划按钮 -->
      <div class="px-4 py-2.5 border-t border-border shrink-0">
        <button
          class="w-full py-3 border-0 rounded-lg bg-gradient-to-br from-primary to-[#7c3aed] text-white text-[15px] font-semibold cursor-pointer transition-all duration-200 hover:not-disabled:-translate-y-px hover:not-disabled:shadow-[0_4px_15px_rgba(37,99,235,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canPlanRoute || isRouting"
          @click="planRoute"
        >
          {{ isRouting ? '⏳ 规划中...' : `🚗 规划路线 (${waypointCount}个点)` }}
        </button>
      </div>

      <!-- 路线摘要 -->
      <div v-if="routeSegments.length > 0" class="px-4 pb-3 border-t border-border shrink-0">
        <div class="bg-gradient-to-br from-[#eff6ff] to-[#f5f3ff] rounded-lg px-3.5 py-3 mt-2.5">
          <div class="flex justify-between items-center py-1 border-t border-[rgba(99,102,241,0.15)] first:border-t-0">
            <span class="text-[13px] text-[#64748b]">总里程</span>
            <span class="text-sm font-bold text-[#4f46e5]">{{ totalDistance }} 公里</span>
          </div>
          <div class="flex justify-between items-center py-1 border-t border-[rgba(99,102,241,0.15)] first:border-t-0">
            <span class="text-[13px] text-[#64748b]">预计时间</span>
            <span class="text-sm font-bold text-[#4f46e5]">{{ totalDuration }}</span>
          </div>
          <div class="flex justify-between items-center py-1 border-t border-[rgba(99,102,241,0.15)] first:border-t-0">
            <span class="text-[13px] text-[#64748b]">途经段数</span>
            <span class="text-sm font-bold text-[#4f46e5]">{{ routeSegments.length }} 段</span>
          </div>
        </div>

        <!-- 每段详情 -->
        <div class="mt-2 max-h-[180px] overflow-y-auto">
          <div
            v-for="(seg, idx) in routeSegments"
            :key="idx"
            class="px-3 py-2 bg-[#f8fafc] rounded-lg mb-1.5 border border-border"
          >
            <div class="text-[11px] font-bold text-[#6366f1] mb-0.5">第 {{ idx + 1 }} 段</div>
            <div class="text-[13px] text-text-primary font-medium">{{ seg.from.name }}</div>
            <div class="text-center text-sm text-[#6366f1] leading-none my-0.5">↓</div>
            <div class="text-[13px] text-text-primary font-medium">{{ seg.to.name }}</div>
            <div class="text-xs text-text-secondary mt-1 font-medium">
              {{ formatDistance(seg.distance) }} · {{ formatDuration(seg.duration) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="routeError" class="mx-4 mb-2.5 px-4 py-2 bg-[#fef2f2] text-[#dc2626] rounded-lg text-[13px] shrink-0">
        ⚠️ {{ routeError }}
      </div>

      <!-- 地图未加载提示 -->
      <div v-if="!mapLoaded" class="px-4 py-3 bg-[#fefce8] text-[#a16207] text-[13px] text-center shrink-0">
        ⚠️ 地图未加载 - 请检查高德地图 Key 配置
      </div>
    </aside>

    <!-- 地图区域 -->
    <div class="flex-1 relative">
      <div ref="mapContainer" class="w-full h-full"></div>

      <!-- 地图上的浮动提示 -->
      <div v-if="waypoints.length === 0 && mapLoaded" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div class="bg-white/95 rounded-2xl px-8 py-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)] text-[#64748b] text-[15px] leading-relaxed">
          <div class="text-[40px] mb-2">🗺️</div>
          <div>在左侧搜索并添加地点，<br/>然后点击"规划路线"</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 途经点按钮 hover 样式（Tailwind not:disabled 兼容性处理） */
.wp-btn:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
  background: #eff6ff;
}
.wp-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.wp-btn-del:hover:not(:disabled) {
  border-color: #ef4444;
  color: #ef4444;
  background: #fef2f2;
}

/* 列表动画 (Vue TransitionGroup) */
.wp-list-enter-active,
.wp-list-leave-active {
  transition: all 0.3s ease;
}
.wp-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.wp-list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
.wp-list-leave-active {
  position: absolute;
}
</style>
