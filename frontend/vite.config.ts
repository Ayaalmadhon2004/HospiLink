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
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('react-router-dom')) {
            return 'react';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query';
          }
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          if (id.includes('sonner')) {
            return 'ui';
          }
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