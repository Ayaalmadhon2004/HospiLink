import type { VitePWAOptions } from 'vite-plugin-pwa';

// Basic PWA: installable shell + offline fallback for navigation.
// Privacy rule: NO runtime caching. API, socket.io and any authenticated data
// always go to the network. Only build-time static assets are precached.
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  injectRegister: false, // registered manually in src/pwa.ts (production only)
  includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
  manifest: {
    name: 'HospiLink',
    short_name: 'HospiLink',
    description: 'Hospital operations dashboard for authorized staff.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#0b3c34',
    background_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
    navigateFallback: '/index.html',
    // Never serve the app shell for API / socket / upload requests.
    // Each regex matches paths starting with that prefix: "/api/patients" matches, "/patients" does not.
    // Tester: https://regex101.com/?regex=%5E%5C%2Fapi%5C%2F&testString=%2Fapi%2Fpatients
    navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//],
    runtimeCaching: [],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
  },
};
