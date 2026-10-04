import { fileURLToPath, URL } from 'url'
import path from 'path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Inspect from 'vite-plugin-inspect'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import { VitePWA } from 'vite-plugin-pwa'

const sanitizeProxyHeaders = (proxy: {
  on: (event: string, listener: (proxyReq: { removeHeader: (name: string) => void; setHeader: (name: string, value: string) => void }) => void) => void
}) => {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.removeHeader('origin')
    proxyReq.removeHeader('referer')
    proxyReq.removeHeader('access-control-allow-origin')
    proxyReq.setHeader('accept', 'application/json')
  })
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [
        IconsResolver({
          prefix: 'Icon',
        }),
      ],
      directoryAsNamespace: true,
      dts: 'src/components.d.ts',
    }),
    Icons(),
    AutoImport({
      // global imports to register
      imports: [
        // presets
        'vue',
        'vue-router',
        'vue-i18n',
        '@vueuse/core',
      ],
      dts: 'src/auto-imports.d.ts',
      eslintrc: {
        enabled: true, // Default `false`
      },
    }),
    // vue i18n config here
    // https://github.com/intlify/bundle-tools/tree/main/packages/vite-plugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      include: [path.resolve(__dirname, 'locales/**')],
    }),
    Inspect({
      // change this to enable inspect for debugging
      enabled: false,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        id: '/',
        name: 'I go to home by bus',
        short_name: 'goHomeByBus',
        description: 'Live Hong Kong bus ETAs, nearby stops, and commute planning.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#f2f2f7',
        theme_color: '#f2f2f7',
        categories: ['travel', 'navigation', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: 'localhost',
    port: 3000,
    open: false,
    https: false,
    proxy: {
      '/api/ctb': {
        target: 'https://rt.data.gov.hk/v1/transport/citybus-nwfb',
        changeOrigin: true,
        rewrite: (path) => path.replace(/\/api\/ctb\//g, ''),
        configure: sanitizeProxyHeaders,
      },
      '/api/batch': {
        target: 'https://rt.data.gov.hk/v1/transport/batch',
        changeOrigin: true,
        rewrite: (path) => path.replace(/\/api\/batch\//g, ''),
        configure: sanitizeProxyHeaders,
      },
      '/api/kmb': {
        target: 'https://data.etabus.gov.hk/v1/transport/kmb',
        changeOrigin: true,
        rewrite: (path) => path.replace(/\/api\/kmb\//g, ''),
        configure: sanitizeProxyHeaders,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1024,
  },
})
