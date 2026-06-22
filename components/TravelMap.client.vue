<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useTripStore } from '../stores/trip';
import { useRoutes } from '../composables/useRoutes';

const tripStore = useTripStore();
const { computeAndStoreRoutes } = useRoutes();
const config = useRuntimeConfig();
const mapContainer = ref<HTMLDivElement>();

let map: any = null;
let markers: any[] = [];
let polylines: any[] = [];
let infoWindows: any[] = [];

const typeColors: Record<string, string> = {
  attraction: '#2563eb',
  restaurant: '#f59e0b',
  hotel: '#10b981',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

function clearAll() {
  if (!map) return;
  map.clearMap();
  markers = [];
  polylines = [];
  infoWindows = [];
}

// ---- POI 搜索（地理编码） ----
function geocodePlace(name: string, city: string): Promise<{ lng: number; lat: number } | null> {
  return new Promise((resolve) => {
    const ps = new AMap.PlaceSearch({ city: city || '全国', pageSize: 1 });
    ps.search(name, (status: string, result: any) => {
      if (status === 'complete' && result.poiList?.pois?.length > 0) {
        const poi = result.poiList.pois[0];
        resolve({ lng: poi.location.lng, lat: poi.location.lat });
      } else {
        resolve(null);
      }
    });
  });
}

async function renderDayOnMap(skipCompute = false) {
  clearAll();
  if (!map || !tripStore.plan) return;

  const city = tripStore.plan.city || '全国';

  if (!skipCompute) {
    // ---- Phase 1: 为缺少坐标的活动搜索坐标 ----
    const geocodeTasks: Promise<void>[] = [];
    for (const day of tripStore.plan.days) {
      for (const activity of (day.activities || [])) {
        if (!activity.lat || !activity.lng) {
          geocodeTasks.push(
            geocodePlace(activity.name, city).then((coord) => {
              if (coord) {
                activity.lat = coord.lat;
                activity.lng = coord.lng;
              }
            }),
          );
        }
      }
      if (day.hotel && (!day.hotel.lat || !day.hotel.lng)) {
        geocodeTasks.push(
          geocodePlace(day.hotel.name, city).then((coord) => {
            if (coord) {
              day.hotel!.lat = coord.lat;
              day.hotel!.lng = coord.lng;
            }
          }),
        );
      }
    }
    if (geocodeTasks.length > 0) {
      await Promise.all(geocodeTasks);
    }

    // ---- Phase 1.5: 多模式路线规划（结果存入 tripStore） ----
    await computeAndStoreRoutes();
  }

  // ---- Phase 2: 渲染标记 + 路线 ----

  for (const day of tripStore.plan.days) {
    const isActive = tripStore.activeDay === day.day;
    const opacity = isActive ? 1 : 0.35;
    const activitiesWithCoords = (day.activities || []).filter((a: any) => a.lat && a.lng);

    // ---- 从 tripStore 读取路线并绘制 ----
    const dayRoutes = tripStore.getRoutesForDay(day.day);
    for (let i = 0; i < dayRoutes.length; i++) {
      const seg = dayRoutes[i];
      const routeInfo = seg.routes[seg.selected];
      const polyline = routeInfo?.polyline;
      const fromAct = activitiesWithCoords[i];
      // 最后一段可能是到酒店，此时 toAct 为 undefined，用酒店坐标 fallback
      const toAct = activitiesWithCoords[i + 1]
        || (day.hotel?.lat && day.hotel?.lng ? { lng: day.hotel.lng, lat: day.hotel.lat } as any : undefined);

      if (polyline && polyline.length > 0) {
        const poly = new AMap.Polyline({
          path: polyline,
          strokeColor: '#6366f1',
          strokeWeight: isActive ? 3 : 1.5,
          strokeOpacity: opacity * 0.7,
          strokeStyle: isActive ? 'solid' : 'dashed',
        });
        map.add(poly);
        polylines.push(poly);

        // 路线中点标注
        const mid = Math.floor(polyline.length / 2);
        const [midLng, midLat] = polyline[mid] || polyline[0];
        const distKm = ((routeInfo?.distance || 0) / 1000).toFixed(1);
        const durMin = Math.round((routeInfo?.duration || 0) / 60);
        const modeLabel = seg.selected === 'walking' ? '🚶 步行'
          : seg.selected === 'bicycling' ? '🚲 骑行'
          : seg.selected === 'transit' ? '🚌 公交'
          : '🚗 驾车';
        const labelContent = document.createElement('div');
        labelContent.innerHTML = `
          <div style="background:white; border:1.5px solid #6366f1; border-radius:6px;
            padding:3px 8px; font-size:11px; color:#1e293b; white-space:nowrap;
            box-shadow:0 2px 6px rgba(0,0,0,.15); opacity:${opacity}; text-align:center;">
            <div>${modeLabel}</div>
            <div style="font-weight:600;color:#4f46e5;">${formatDuration(durMin)}</div>
            <div style="font-size:10px;color:#64748b;">${distKm}km</div>
          </div>`;
        const labelMarker = new AMap.Marker({
          position: [midLng, midLat],
          content: labelContent,
          offset: new AMap.Pixel(-55, -25),
        });
        map.add(labelMarker);
        markers.push(labelMarker);
      } else if (fromAct && toAct) {
        // 降级：直线
        const poly = new AMap.Polyline({
          path: [[fromAct.lng, fromAct.lat], [toAct.lng, toAct.lat]],
          strokeColor: '#6366f1',
          strokeWeight: isActive ? 2 : 1,
          strokeOpacity: opacity * 0.3,
          strokeStyle: 'dashed',
        });
        map.add(poly);
        polylines.push(poly);
      }
    }

    // ---- 活动标记 ----
    activitiesWithCoords.forEach((a: any, ai: number) => {
      const color = typeColors[a.type] || '#666';
      const markerContent = document.createElement('div');
      markerContent.innerHTML = `
        <div style="
          background:${color}; color:white; width:28px; height:28px;
          border-radius:50%; display:flex; align-items:center; justify-content:center;
          font-size:12px; font-weight:bold; border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,.35); opacity:${opacity};
        ">${ai + 1}</div>`;

      const marker = new AMap.Marker({
        position: [a.lng, a.lat],
        content: markerContent,
        offset: new AMap.Pixel(-14, -14),
      });
      map.add(marker);

      // 点击弹窗
      marker.on('click', () => {
        const iw = new AMap.InfoWindow({
          content: `
            <div style="font-family:sans-serif;min-width:140px;padding:4px;">
              <strong style="font-size:14px;">${a.name}</strong><br/>
              <span style="font-size:12px;color:#666;">${a.time} · ${a.duration}</span><br/>
              <span style="font-size:12px;color:#444;">${a.note || ''}</span>
              ${a.bookingUrl ? `<br/><a href="${a.bookingUrl}" target="_blank" style="color:#2563eb;font-size:12px;">查看详情 →</a>` : ''}
            </div>`,
          offset: new AMap.Pixel(0, -35),
        });
        iw.open(map, [a.lng, a.lat]);
      });

      markers.push(marker);
    });

    // ---- 酒店标记 ----
    if (day.hotel?.lat && day.hotel?.lng) {
      const hotelContent = document.createElement('div');
      hotelContent.innerHTML = `
        <div style="
          background:${typeColors.hotel}; color:white;
          width:24px; height:24px; border-radius:4px;
          display:flex; align-items:center; justify-content:center;
          font-size:12px; border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,.35); opacity:${opacity};
        ">🏨</div>`;

      const hm = new AMap.Marker({
        position: [day.hotel.lng, day.hotel.lat],
        content: hotelContent,
        offset: new AMap.Pixel(-12, -12),
      });
      map.add(hm);

      hm.on('click', () => {
        const iw = new AMap.InfoWindow({
          content: `
            <div style="font-family:sans-serif;min-width:140px;padding:4px;">
              <strong style="font-size:14px;">${day.hotel.name}</strong><br/>
              <span style="color:#10b981;font-weight:600;">¥${day.hotel.pricePerNight}/晚</span>
              ${day.hotel.bookingUrl ? `<br/><a href="${day.hotel.bookingUrl}" target="_blank" style="color:#2563eb;font-size:12px;">预订 →</a>` : ''}
            </div>`,
          offset: new AMap.Pixel(0, -30),
        });
        iw.open(map, [day.hotel.lng, day.hotel.lat]);
      });

      markers.push(hm);
    }
  }
}

// 动态加载高德 JS API（含路线规划插件）
function loadAmapScript(key: string, plugins: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).AMap) {
      // AMap 已加载，确保插件也加载
      AMap.plugin(plugins, () => resolve((window as any).AMap));
      return;
    }
    const pluginStr = plugins.join(',');
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=${pluginStr}`;
    script.onload = () => {
      // 等待插件就绪
      AMap.plugin(plugins, () => resolve((window as any).AMap));
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function initMap() {
  if (!mapContainer.value) return;

  const key = config.public.amapKey as string || '';

  if (!key) {
    console.warn('⚠️ 未配置高德地图 Key（NUXT_PUBLIC_AMAP_KEY 或 AMAP_API_KEY），地图不可用');
    return;
  }

  // 安全密钥必须在脚本加载前设置
  const securityCode = config.public.amapSecurityCode as string || '';
  if (securityCode) {
    (window as any)._AMapSecurityConfig = { securityJsCode: securityCode };
  }

  try {
    await loadAmapScript(key, ['AMap.PlaceSearch']);
  } catch (e: any) {
    console.warn('⚠️ 高德地图 JS API 加载失败:', e.message || e);
    return;
  }

  map = new AMap.Map(mapContainer.value, {
    zoom: 5,
    mapStyle: 'amap://styles/light',
    resizeEnable: true,
  });
  map.setCity('北京市');
}

onMounted(async () => {
  await initMap();

  // 修复竞态：plan 可能在 map 加载完成之前就已设置
  if (tripStore.plan && map) {
    renderDayOnMap();
    map.setCity(tripStore.plan.city);
    const firstActivity = tripStore.plan.days[0]?.activities?.find((a: any) => a.name);
    if (firstActivity) {
      const placeSearch = new AMap.PlaceSearch({ city: tripStore.plan.city, pageSize: 1 });
      placeSearch.search(firstActivity.name, (status: string, result: any) => {
        if (status === 'complete' && result.poiList?.pois?.length > 0) {
          const poi = result.poiList.pois[0];
          map.setZoomAndCenter(15, [poi.location.lng, poi.location.lat]);
        }
      });
    }
  }
});

watch(() => tripStore.plan, (plan) => {
  if (!plan || !map) return;
  renderDayOnMap();
  // 用城市名定位
  map.setCity(plan.city);
  // 面板从 width:0 过渡到 45%，需要通知地图重新计算尺寸
  setTimeout(() => map?.resize(), 600);
  // 搜索第一个景点并飞到
  const firstActivity = plan.days[0]?.activities?.find((a: any) => a.name);
  if (firstActivity) {
    const placeSearch = new AMap.PlaceSearch({ city: plan.city, pageSize: 1 });
    placeSearch.search(firstActivity.name, (status: string, result: any) => {
      if (status === 'complete' && result.poiList?.pois?.length > 0) {
        const poi = result.poiList.pois[0];
        map.setZoomAndCenter(15, [poi.location.lng, poi.location.lat]);
      }
    });
  }
});

watch(() => tripStore.activeDay, () => {
  renderDayOnMap(true);
});

// 用户切换交通方式后重新绘制路线（不重新请求 API）
watch(() => tripStore.routesByDay, () => {
  renderDayOnMap(true);
}, { deep: true });

// 点击时间线中的活动 → 用地名搜索并飞过去
watch(() => tripStore.focusActivity, (focus) => {
  if (!map || !focus) return;
  const placeSearch = new AMap.PlaceSearch({ city: focus.city, pageSize: 1 });
  placeSearch.search(focus.name, (status: string, result: any) => {
    if (status === 'complete' && result.poiList?.pois?.length > 0) {
      const poi = result.poiList.pois[0];
      map.setZoomAndCenter(15, [poi.location.lng, poi.location.lat]);
    }
  });
});

// 路线现在直接用高德 Driving API，不再依赖服务端 routesByDay

onUnmounted(() => {
  if (map) {
    map.destroy();
    map = null;
  }
});
</script>

<template>
  <div ref="mapContainer" class="w-full h-full"></div>
</template>
