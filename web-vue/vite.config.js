import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { fileURLToPath, URL } from 'node:url'
import { personalDataPlugin } from '../server/personal-api.js'

export default defineConfig(({ mode }) => ({
  base: process.env.PAGES_BASE_PATH || (mode === 'pages' ? '/health-dashboard/' : '/'),
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [
    personalDataPlugin(),
    vue(),
    AutoImport({ imports: ['vue', 'vue-router'], dts: false }),
    Components({ dirs: ['src/components'], dts: false }),
  ],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
}))
