<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import type { Map, TileLayer, Marker, Polyline } from 'leaflet';
import { useTripStore } from '../stores/trip';
import { CITY_CENTERS, CHINA_CENTER, CHINA_BOUNDS } from '../types';
import type { RouteSegment } from '../types';

const tripStore = useTripStore();
const mapContainer = ref<HTMLDivElement>();
let map: Map | null = null;
let tileLayer: TileLayer | null = null;
let markers: Marker[] = [];
let polylines: Polyline[] = [];
let routeLabels: Marker[] = [];

function clearMap() {
  markers.forEach(m => m.remove());
  polylines.forEach(p => p.remove());
  routeLabels.forEach(l => l.remove());
  markers = [];
  polylines = [];
  routeLabels = [];
}

const typeColors: Record<string, string> = {
  attraction: '#2563eb',
  restaurant: '#f59e0b',
  hotel: '#10b981',
};

const typeLabels: Record<string, string> = {
  attraction: '景点',
  restaurant: '餐厅',
  hotel: '酒店',
};

const modeLabels: Record<string, string> = {
  '步行': '🚶',
  '公交/地铁': '🚌',
  '出租车': '🚕',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

function renderDayOnMap() {
  clearMap();
  if (!tripStore.plan) return;

  tripStore.plan.days.forEach((day, di) => {
    const isActive = tripStore.activeDay === day.day;
    const opacity = isActive ? 1 : 0.3;
    const routes = tripStore.getRoutesForDay(day.day);

    // 收集有坐标的 activities
    const activitiesWithCoords = day.activities.filter(a => a.lat && a.lng);

    // ---- 绘制路线 ----
    if (routes.length > 0) {
      // 使用真实路径
      routes.forEach((seg) => {
        const poly = L.polyline(seg.path, {
          color: '#6366f1',
          weight: isActive ? 3 : 1.5,
          opacity: opacity * 0.7,
          dashArray: isActive ? undefined : '5,5',
        });
        if (map) poly.addTo(map);
        polylines.push(poly);

        // 在路线中点标注时间/距离/交通方式
        const mid = Math.floor(seg.path.length / 2);
        const midPoint = seg.path[mid] || seg.path[0];
        const iconHtml = `
          <div style="
            background: white;
            border: 1.5px solid #6366f1;
            border-radius: 6px;
            padding: 2px 8px;
            font-size: 11px;
            color: #1e293b;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,.15);
            opacity: ${opacity};
            text-align: center;
            line-height: 1.3;
          ">
            <div>${modeLabels[seg.mode] || '🚶'} ${seg.mode}</div>
            <div style="font-weight:600;color:#4f46e5;">${formatDuration(seg.duration)}</div>
            <div style="font-size:10px;color:#64748b;">${seg.distance}km</div>
          </div>`;

        const labelIcon = L.divIcon({
          html: iconHtml,
          className: '',
          iconSize: [110, 50],
          iconAnchor: [55, 25],
        });

        const label = L.marker(midPoint, { icon: labelIcon, interactive: false });
        if (map) label.addTo(map);
        routeLabels.push(label);
      });
    } else {
      // 降级：直线连接（无路线数据时）
      const dayCoords: [number, number][] = activitiesWithCoords.map(a => [a.lat, a.lng]);
      for (let i = 0; i < dayCoords.length - 1; i++) {
        const poly = L.polyline([dayCoords[i], dayCoords[i + 1]], {
          color: '#6366f1',
          weight: isActive ? 2 : 1,
          opacity: opacity * 0.4,
          dashArray: di > 0 ? '5,5' : undefined,
        });
        if (map) poly.addTo(map);
        polylines.push(poly);
      }
    }

    // ---- 绘制活动标记 ----
    activitiesWithCoords.forEach((a, ai) => {
      const color = typeColors[a.type] || '#666';
      const iconHtml = `
        <div style="
          background: ${color};
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,.3);
          opacity: ${opacity};
        ">${ai + 1}</div>`;

      const icon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([a.lat, a.lng], { icon });
      if (map) marker.addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 120px;">
          <strong>${a.name}</strong><br/>
          <span style="font-size: 12px; color: #666;">
            ${typeLabels[a.type]} · ${a.time} · ${a.duration}
          </span><br/>
          <span style="font-size: 12px; color: #444;">${a.note}</span>
        </div>
      `);
      markers.push(marker);
    });

    // ---- 酒店标记 ----
    if (day.hotel && day.hotel.lat && day.hotel.lng) {
      const hotelIcon = L.divIcon({
        html: `<div style="
          background: ${typeColors.hotel};
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,.3);
          opacity: ${opacity};
        ">🏨</div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const hm = L.marker([day.hotel.lat, day.hotel.lng], { icon: hotelIcon });
      if (map) hm.addTo(map);
      hm.bindPopup(`<strong>${day.hotel.name}</strong><br/>¥${day.hotel.pricePerNight}/晚`);
      markers.push(hm);
    }
  });
}

// Leaflet 动态导入
async function initMap() {
  const L = await import('leaflet');

  if (!mapContainer.value) return;

  map = L.map(mapContainer.value, {
    center: CHINA_CENTER,
    zoom: 5,
    maxBounds: L.latLngBounds(CHINA_BOUNDS[0], CHINA_BOUNDS[1]),
    maxBoundsViscosity: 0.8,
  });

  tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);
}

onMounted(async () => {
  await initMap();
});

// 监听行程数据变化
watch(() => tripStore.plan, (plan) => {
  if (!plan || !map) return;
  const center = CITY_CENTERS[plan.city] || CHINA_CENTER;
  map.setView(center, 13);
  renderDayOnMap();
});

// 监听切换当前天
watch(() => tripStore.activeDay, () => {
  renderDayOnMap();
});

// 监听路线数据加载完成
watch(() => tripStore.routesByDay, () => {
  renderDayOnMap();
}, { deep: true });

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<template>
  <div ref="mapContainer" class="map-container"></div>
</template>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}
</style>
