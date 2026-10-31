// vite.config.ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './pwa.config';

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA(pwaOptions)],
  base: '/',
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules\/(react|react-dom|react-router|react-router-dom|react-is|scheduler|use-sync-external-store)\/|@oxc-project[/+]runtime/, priority: 30 },
            { name: 'charts', test: /node_modules\/(recharts|d3-[^/]+|victory-vendor|decimal\.js-light)\//, priority: 20 },
            { name: 'query', test: /node_modules\/@tanstack\/react-query/, priority: 10 },
            { name: 'icons', test: /node_modules\/lucide-react/, priority: 10 },
            { name: 'ui', test: /node_modules\/sonner/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: { VITE_API_URL: 'http://localhost:5000/api' },
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
  server: {
    // Only used when VITE_API_URL is a same-origin path (e.g. /api): set VITE_DEV_PROXY_TARGET to the API host.
    proxy: process.env.VITE_DEV_PROXY_TARGET
      ? { '/api': { target: process.env.VITE_DEV_PROXY_TARGET, changeOrigin: true } }
      : undefined,
  },
});