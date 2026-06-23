// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],

  css: ['~/assets/css/main.css'],

  // 接口请求统一走 nitro routeRules 代理到 localhost:3333
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

  nitro: {
    routeRules: {
      '/api/**': {
        proxy: { to: 'http://localhost:3333/api/**' },
      },
    },
  },

  typescript: {
    strict: true,
  },
});
