// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',  // ← ضيف هاد
  server: {
    proxy: {
      '/api': {
        target: 'https://hospilink-1bfi.onrender.com',
        changeOrigin: true,
      },
    },
  },
});