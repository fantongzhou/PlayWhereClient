// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],

  css: ['~/assets/css/main.css'],

  // apiBase：开发环境留空走 proxy -> localhost:3333；线上设置 NUXT_PUBLIC_API_BASE 指向后端
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
      amapKey: process.env.NUXT_PUBLIC_AMAP_KEY || process.env.AMAP_API_KEY || '',
      amapSecurityCode: process.env.NUXT_PUBLIC_AMAP_SECURITY_CODE || '',
      amapWsKey: process.env.NUXT_PUBLIC_AMAP_WS_KEY || '',
    },
  },

  devServer: {
    port: 5173,
  },

  nitro: {
    devProxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },

  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3333',
          changeOrigin: true,
        },
      },
    },
  },

  typescript: {
    strict: true,
  },
});
