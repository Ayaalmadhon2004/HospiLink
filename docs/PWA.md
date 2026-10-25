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

## Icons and manifest

The mark is a white medical cross with a teal (`#14b8a6`) heartbeat line on the app brand colour `#0b3c34` (same as
`theme-color` in `index.html`). The vector source is `frontend/public/icons/logo.svg` (also served as `favicon.svg`).

PNGs in `frontend/public/icons/` are generated, not hand drawn: `cd frontend && npm run icons`
(`scripts/generate-icons.cjs`, renders the SVG with the Chromium bundled with Playwright; set `PLAYWRIGHT_BROWSERS_PATH`
if the browsers are not in the default cache; no `playwright install` needed when one is present). Commit the outputs.

| File | Use |
| --- | --- |
| `icon-192.png`, `icon-512.png` | manifest, purpose `any` (rounded corners) |
| `maskable-192.png`, `maskable-512.png` | manifest, purpose `maskable`: full-bleed background, glyph scaled to 62% so it stays inside the 80% safe circle |
| `apple-touch-icon.png` | 180x180, full-bleed (iOS rounds it itself) |
| `favicon-32.png`, `favicon-48.png`, `../favicon.svg` | browser tab icons |

The manifest (in `pwa.config.ts`) declares `id`, `name`, `short_name`, `description`, `start_url`, `scope`, `display: standalone`,
`theme_color`, `background_color`, `lang: en`, `dir: ltr` (the UI itself flips to RTL for Arabic), the icons and two shortcuts
(Patients, Appointments). `src/pwaAssets.test.ts` checks that every file the manifest, shortcuts, `includeAssets` and
`index.html` reference exists, is a PNG and has the declared size.

## How to test offline

1. `cd frontend && npm run build && npm run preview` and open http://localhost:4173.
2. DevTools > Application > Manifest (installable, icons) and Service Workers (activated).
3. Reload once so the page is controlled, then DevTools > Network > Offline, and navigate/reload: the shell still loads.
4. DevTools > Application > Cache Storage: only `workbox-precache-*` exists and contains no `/api` or socket.io entries.

The service worker is not registered under `npm run dev` or in tests.

## How to update

Change `pwa.config.ts` (manifest fields, icons, glob patterns) and rebuild. If you ever add runtime caching, never match
`/api`, socket.io or any authenticated response.
