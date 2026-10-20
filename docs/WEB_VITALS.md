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

- Development: each metric is logged to the console as `[web-vitals]`. Nothing is sent.
- Production, no endpoint: nothing is measured and nothing is sent (the library is not even downloaded).
- Production with `VITE_VITALS_ENDPOINT` set at build time: each metric is POSTed as JSON using
  `navigator.sendBeacon`, falling back to `fetch` with `keepalive: true` (no cookies, `credentials: 'omit'`).

## Enabling the endpoint

Set `VITE_VITALS_ENDPOINT` (for example in the Vercel project environment variables) to an HTTPS URL that accepts a
JSON POST, then rebuild. Leave it unset to disable reporting. The collector must allow CORS for the frontend origin if
the `fetch` fallback is used. The beacon is anonymous and deliberately does not go through `services/api.ts`, which
adds auth credentials and targets the HospiLink API only.

Payload:

```json
{ "name": "LCP", "value": 1234.568, "rating": "good", "path": "/patients" }
```

## Privacy

Only the metric name, value, rating and `location.pathname` are sent. No user id, token, patient data, query string,
hash or full URL is included, and no cookies are attached. Do not add such fields. Pathnames that contain record ids
(for example `/patients/<id>`) are sent as-is; normalise them in `toPayload` if the collector is third-party.
