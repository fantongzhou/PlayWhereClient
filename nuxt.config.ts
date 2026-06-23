// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      amapKey: process.env.NUXT_PUBLIC_AMAP_KEY || process.env.AMAP_API_KEY || '',
      amapSecurityCode: process.env.NUXT_PUBLIC_AMAP_SECURITY_CODE || '',
      amapWsKey: process.env.NUXT_PUBLIC_AMAP_WS_KEY || '',
    },
  },

  devServer: {
    port: 5173,
  },

  // API 代理由 server/middleware/api-proxy.ts 处理（支持 SSE 流式响应）
  nitro: {},

  typescript: {
    strict: true,
  },
});
