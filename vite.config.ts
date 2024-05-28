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
        '@vueuse/head',
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
    VitePWA({ registerType: 'autoUpdate' })
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
        target: 'https://rt.data.gov.hk/v2/transport/citybus',
        changeOrigin: true,
        rewrite: (path) => path.replace(/\/api\/ctb\//g, ''),
      },
      '/api/kmb': {
        target: 'https://data.etabus.gov.hk/v1/transport/kmb',
        changeOrigin: true,
        rewrite: (path) => path.replace(/\/api\/kmb\//g, ''),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1024,
  }
})
