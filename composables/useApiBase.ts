// 统一获取接口 base url（开发环境为空走 proxy，生产环境为线上服务地址）
export function useApiBase(): string {
  const config = useRuntimeConfig();
  return ((config.public.apiBase as string) || '').replace(/\/$/, '');
}
