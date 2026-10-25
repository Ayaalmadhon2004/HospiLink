# Security scanning (OWASP ZAP baseline)

`.github/workflows/zap-baseline.yml` (manual + Mondays 03:17 UTC) starts the API (production mode, seeded throwaway Postgres 16)
and the built frontend, then runs the **passive** `zap-baseline.py` from the pinned image `ghcr.io/zaproxy/zaproxy:2.16.1`
against both. Reports (`api.html/json`, `web.html/json`) are uploaded as the `zap-reports` artifact. `.zap/rules.tsv` escalates the
header rules we fixed to FAIL (a regression fails the run) and lists the justified ignores. `.zap/serve-frontend.mjs` serves
`frontend/dist` with the headers from `frontend/vercel.json` (vite preview ignores that file).

The baseline is passive (spider + passive rules, no attacks) and unauthenticated: it sees headers and public routes, not
role-protected data. Authorization and tenant isolation are covered by `backend/tests-int`.

## Run it locally

```bash
# 1. throwaway database (name must contain test) + API
createdb hospilink_zaptest
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospilink_zaptest
cd backend && npx prisma migrate deploy && npx tsx prisma/seed.e2e.ts
NODE_ENV=production PORT=5000 JWT_SECRET=local-zap-secret-change CORS_ORIGINS=http://localhost:4173 npx tsx src/server.ts &
# 2. frontend with the Vercel headers
cd ../frontend && VITE_API_URL=http://localhost:5000/api npm run build
node ../.zap/serve-frontend.mjs dist vercel.json 4173 &
# 3. scan (Linux: --network host; macOS/Windows: use host.docker.internal as target)
cd .. && mkdir -p zap-out && chmod 777 zap-out
docker run --rm --network host -v "$PWD/.zap:/zap/wrk/.zap:ro" -v "$PWD/zap-out:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:2.16.1 zap-baseline.py -t http://localhost:5000/api/health -c .zap/rules.tsv -r api.html -I
docker run --rm --network host -v "$PWD/.zap:/zap/wrk/.zap:ro" -v "$PWD/zap-out:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:2.16.1 zap-baseline.py -t http://localhost:4173/ -c .zap/rules.tsv -r web.html -I
```

Without Docker, the equivalent manual header check (what was done for the first review) is:
`curl -si localhost:5000/api/health`, the same with `-H 'Origin: https://evil.example'` (no `Access-Control-Allow-Origin` may come back),
`curl -si -X POST .../api/auth/login ...` (cookie must be `HttpOnly; Secure`), an unknown route and a malformed JSON body (no stack traces).

## First review (manual baseline, no ZAP run)

The authoring sandbox had no Docker daemon, so the first review was a manual curl baseline of the same checks, not a ZAP run.
The workflow has not been executed yet: run it once from the Actions tab and triage its output against this table.

| Finding | Severity | Status |
|---|---|---|
| API sent no `Cache-Control` (patient JSON cacheable by proxies/back-forward cache) | Medium | Fixed: `Cache-Control: no-store` on `/api` (`config/securityHeaders.ts`); export/report handlers keep their own |
| CSP lacked `base-uri` / `form-action` (no `default-src` fallback) | Low | Fixed (`'none'`) |
| No `Permissions-Policy` on API or SPA | Low | Fixed |
| SPA (Vercel) had no CSP, HSTS, Permissions-Policy, COOP; no cache rules | Medium | Fixed in `frontend/vercel.json` |
| `GET /api/health` returned the raw DB driver error message on failure | Medium (info leak) | Fixed: generic body, error logged |
| Unknown `/api/*` routes returned Express' HTML "Cannot GET" page | Low | Fixed: JSON `NOT_FOUND` envelope |
| API `X-Frame-Options: SAMEORIGIN` while CSP says `frame-ancestors 'none'` | Info | Left: report/uploads responses intentionally allow `'self'` framing |
| Malformed JSON body echoes the parser message (`Expected property name ... position 1`) | Info | Left: 400-class messages are client-safe; no paths/stack |
| `Access-Control-Allow-Credentials: true` also sent for disallowed origins | Info | Left: without `Access-Control-Allow-Origin` browsers refuse the response |
| `X-Powered-By`, stack traces, `.env`, TRACE | - | Verified absent |
| Auth cookie `HttpOnly; Secure; SameSite=None` | - | OK (cross-site Vercel/Render, see `docs/AUTH_HARDENING_PLAN.md`) |

Notes on the SPA CSP: `style-src 'unsafe-inline'` stays because charts/Tailwind/React set inline `style` attributes (ZAP flags it as
a warning, not FAIL); scripts have no `unsafe-inline`/`unsafe-eval`. `connect-src` allows `https://*.onrender.com` and `wss://`; **when
the API moves to a custom domain, add it to `connect-src` in `frontend/vercel.json`** (and `VITE_VITALS_ENDPOINT`'s origin, if used).
`object-src 'self' blob:` is there because report files are opened as blob URLs in a new tab.
