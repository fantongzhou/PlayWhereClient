// https://nuxt.com/docs/api/configuration/nuxt-config

const isDev = process.env.NODE_ENV === 'development'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt'],

  css: [
    'leaflet/dist/leaflet.css',
  ],

  devServer: {
    port: 5173,
  },

  nitro: {
    devProxy: {
      '/api': {
        target: isDev ? 'http://localhost:3333' : 'https://play-where-server.vercel.app/',
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
