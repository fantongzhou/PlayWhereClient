/**
 * 设备检测 composable — 判断是否为移动端
 * 同时支持服务端（user-agent header）和客户端（navigator）
 */
export function useDevice() {
  const isMobile = computed(() => {
    // 客户端：使用 navigator
    if (import.meta.client) {
      return /Mobi|Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
    }
    // 服务端：通过 Nuxt 请求头
    const headers = useRequestHeaders();
    const ua = headers['user-agent'] || '';
    return /Mobi|Android|iPhone|iPad|iPod|webOS/i.test(ua);
  });

  return { isMobile };
}
