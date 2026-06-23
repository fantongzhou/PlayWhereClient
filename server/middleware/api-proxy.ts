/**
 * API 代理中间件
 * 使用 Node.js 原生 http.request + pipe，SSE 流式响应完全透传
 * 避免 h3 proxyRequest / fetch 对长连接的缓冲和超时问题
 */
import http from 'node:http';

const TARGET_HOST = process.env.API_PROXY_HOST || '127.0.0.1'; // IPv4 直连，避免 IPv6 解析问题
const TARGET_PORT = Number(process.env.API_PROXY_PORT || 3333);

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return;

  const { req, res } = event.node;

  return new Promise<void>((resolve, reject) => {
    // 读取请求体（POST/PUT 等）
    const bodyChunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
    req.on('end', () => {
      const body = bodyChunks.length > 0
        ? Buffer.concat(bodyChunks)
        : undefined;

      const proxyReq = http.request(
        {
          hostname: TARGET_HOST,
          port: TARGET_PORT,
          path: req.url || event.path,
          method: req.method,
          headers: {
            'content-type': 'application/json',
          },
          // 关键：禁用超时，SSE 是长连接
          timeout: 0,
        },
        (proxyRes) => {
          // 逐字拷贝响应头
          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (value) res.setHeader(key, value);
          }
          res.statusCode = proxyRes.statusCode || 200;

          // 直 pipe，不做任何缓冲
          proxyRes.pipe(res);

          proxyRes.on('error', (err) => {
            console.error('[api-proxy] upstream error:', err.message);
            if (!res.writableEnded) res.end();
          });
          proxyRes.on('end', () => resolve());
        },
      );

      proxyReq.on('error', (err) => {
        console.error('[api-proxy] proxy error:', err.message);
        if (!res.headersSent) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
        } else {
          res.end();
        }
        reject(err);
      });

      // 客户端断开时销毁后端连接
      res.on('close', () => {
        proxyReq.destroy();
      });

      if (body) proxyReq.write(body);
      proxyReq.end();
    });
  });
});
