/**
 * 无感设备路由切换中间件
 * - 移动端访问 /plan     → 自动重定向到 /m/plan
 * - 桌面端访问 /m/plan   → 自动重定向到 /plan
 * - ?force=mobile 或 ?force=desktop 可强制覆盖
 */
export default defineNuxtRouteMiddleware((to) => {
  // 允许强制参数绕过
  const forceParam = to.query.force as string | undefined;

  // 服务端：从请求头获取 UA
  let ua = '';
  if (import.meta.server) {
    const event = useRequestEvent();
    ua = event?.node.req.headers['user-agent'] || '';
  } else {
    ua = navigator.userAgent || '';
  }

  const isMobile = /Mobi|Android|iPhone|iPad|iPod|webOS/i.test(ua);

  // 移动端访问 desktop 路由 → 重定向到 /m/plan（除非强制 desktop）
  if (isMobile && to.path === '/plan' && forceParam !== 'desktop') {
    return navigateTo({ path: '/m/plan', query: to.query });
  }

  // 桌面端访问 mobile 路由 → 重定向到 /plan（除非强制 mobile）
  if (!isMobile && to.path === '/m/plan' && forceParam !== 'mobile') {
    return navigateTo({ path: '/plan', query: to.query });
  }
});
