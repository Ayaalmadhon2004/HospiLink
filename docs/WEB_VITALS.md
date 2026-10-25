# Web Vitals

The frontend measures Core Web Vitals with the [`web-vitals`](https://github.com/GoogleChrome/web-vitals) package
(`frontend/src/utils/webVitals.ts`, started from `main.tsx`).

## What is measured

| Metric | Meaning |
| --- | --- |
| LCP | Largest Contentful Paint (loading) |
| INP | Interaction to Next Paint (responsiveness) |
| CLS | Cumulative Layout Shift (visual stability) |
| FCP | First Contentful Paint |
| TTFB | Time to First Byte |

The library is loaded with a dynamic `import()` after the window `load` event, so it is a separate chunk and does not
affect startup or the main bundle.

## Behaviour

- Development and tests: each metric is logged to the console as `[web-vitals]`. Nothing is ever sent, even if an endpoint is set.
- Production, no endpoint: nothing is measured and nothing is sent (the library is not even downloaded).
- Production with `VITE_VITALS_ENDPOINT` set at build time: each metric is sent with `navigator.sendBeacon`, falling back
  to `fetch` with `keepalive: true` (`credentials: 'omit'`). The body is JSON sent as `text/plain;charset=UTF-8`, which is a
  CORS "simple" request: no preflight, so it works cross-origin and survives page unload.
- `VITE_VITALS_SAMPLE` (optional, 0..1, default 1): fraction of page loads that report; decided once per load. Invalid values mean 1.
- Reporting never throws or blocks: it starts after `load`, and every failure is swallowed.

## Enabling the endpoint

The backend ships the collector: `POST /api/telemetry/web-vitals` (`backend/src/routes/webVitals.routes.ts`). Set
`VITE_VITALS_ENDPOINT` (Vercel project env var, build time) to `https://<api-host>/api/telemetry/web-vitals` and redeploy; leave it
unset to disable. Any other collector that accepts a JSON POST also works.

Payload (`id` is optional):

```json
{ "name": "LCP", "value": 1234.568, "rating": "good", "path": "/patients/:id", "id": "v6-1700000000000-1234567890123" }
```

Collector rules (unauthenticated by nature, so deliberately strict):

- Body max 1 KB; content type `text/plain` or `application/json`; mounted before the global `express.json()` in `server.ts`.
- zod `.strict()` schema (`validators/webVitals.validator.ts`): `name` in CLS/INP/LCP/FCP/TTFB, `value` finite 0..600000,
  `rating` good/needs-improvement/poor, `path` a plain route (`/[A-Za-z0-9/_:.-]*`, no query or hash, max 100), optional `id`
  (`[A-Za-z0-9._-]`, max 64). Unknown keys (possible PII) are rejected with 400; oversized bodies with 413.
- Own per-IP limit, 60/min (`VITALS_REPORT_RATE_LIMIT_MAX`), answering 429; independent of the general API limiter.
- Success is `204 No Content`. The sample is logged as a pino `web-vital` line (no IP, user agent, cookies) and added to a bounded
  in-memory aggregate (count/sum/max per metric+route+rating, at most 500 keys). Errors never reach `errorHandler` or crash the API.
- CORS: it uses the global `CORS_ORIGINS` allowlist; nothing to change. `text/plain` needs no preflight.
- CSP: `frontend/vercel.json` sets no Content-Security-Policy, so no `connect-src` change is needed today. If a CSP is added
  later, include the API origin in `connect-src` (the beacon is a connect request to that origin).

## Privacy

Only the metric name, value, rating and a normalised route are sent. No user id, token, patient data, query string,
hash or full URL is included, and no cookies are attached. Do not add such fields. The path is normalised by `normalizePath` in `src/utils/webVitals.ts`: dynamic segments are replaced with their param name (for example `/patients/<id>` is sent as `/patients/:id`) and any pathname that matches no known route is sent as `/other`. Add new routes to that list when you add pages.
