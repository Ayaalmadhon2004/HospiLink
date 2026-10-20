// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
  server: {
    proxy: {
      '/api': {
        target: 'https://hospi-link-two.vercel.app',
        changeOrigin: true,
      },
    },
  },
});