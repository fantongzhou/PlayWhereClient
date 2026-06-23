/**
 * API 代理中间件 — 将所有 /api/** 请求代理到后端服务（localhost:3333）
 * 使用 h3 原生 proxyRequest，正确处理 SSE 流式响应，避免 routeRules proxy 的 Premature close 问题
 */
import { proxyRequest } from 'h3';

export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/')) return;
  return proxyRequest(event, `http://localhost:3333${event.path}`);
});
