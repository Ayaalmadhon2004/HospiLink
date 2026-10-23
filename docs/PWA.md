# PWA support

HospiLink is installable and its app shell loads offline. It is built with `vite-plugin-pwa` (generateSW, Workbox).
Config: `frontend/pwa.config.ts`; registration: `frontend/src/pwa.ts` (production builds only).

## What is cached

- Precache (build time): the hashed JS/CSS/HTML/SVG/PNG/woff2 files emitted by `vite build`, the manifest and the icons.
- Offline navigation: any page navigation falls back to the cached `/index.html` (the SPA then routes client-side).

## What is NOT cached

There is no runtime caching (`runtimeCaching: []`). This is deliberate: it is a hospital app and patient data must never
land in a browser cache.

- `/api/*` requests (all data, auth, uploads of reports) always go to the network.
- socket.io traffic (`/socket.io/*`) always goes to the network.
- `/api/`, `/socket.io/` and `/uploads/` are also excluded from the navigation fallback.
- Google Fonts (external origin) are not cached by the service worker.

Offline, the shell loads but data requests fail and the app shows its normal error/login state.

## Updates

`registerType: 'autoUpdate'` with `skipWaiting` + `clientsClaim`: a new deploy installs in the background, activates
immediately and old precaches are cleaned up. Users get the new version on the next load or reload. The service worker
file `sw.js` is regenerated on every build.

## Deploy notes

- Vercel: the existing SPA rewrite (`/(.*)` -> `/index.html`) and headers in `frontend/vercel.json` are unchanged.
  `sw.js` and `manifest.webmanifest` are static files and are served before the rewrite.
- nginx (`frontend/nginx.conf`): `/` is served with `Cache-Control: no-cache`, so `sw.js` is always revalidated.
- No backend, CORS, helmet or CSP changes are needed (the service worker is same-origin and makes no new cross-origin requests).

## Icons

The icons in `frontend/public/icons/` are generated placeholders (white cross on the app teal `#0b3c34`); the repo had no
HospiLink logo (`favicon.svg` is the default Vite logo). Replace them with real branding when available, keeping the file
names or updating `pwa.config.ts`. Maskable icons keep the cross inside the safe zone.

## How to test offline

1. `cd frontend && npm run build && npm run preview` and open http://localhost:4173.
2. DevTools > Application > Manifest (installable, icons) and Service Workers (activated).
3. Reload once so the page is controlled, then DevTools > Network > Offline, and navigate/reload: the shell still loads.
4. DevTools > Application > Cache Storage: only `workbox-precache-*` exists and contains no `/api` or socket.io entries.

The service worker is not registered under `npm run dev` or in tests.

## How to update

Change `pwa.config.ts` (manifest fields, icons, glob patterns) and rebuild. If you ever add runtime caching, never match
`/api`, socket.io or any authenticated response.
