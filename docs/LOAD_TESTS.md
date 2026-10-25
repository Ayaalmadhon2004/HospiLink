# Load, contention and abuse-protection tests (k6)

`perf/*.js` are [k6](https://k6.io) scripts. Each one has **thresholds**: k6 exits non-zero when one is crossed, so they can gate a pipeline.
They create their own data through the API (patients, a device key, a medication, invoices) and need no separate seed.

```bash
# 1. a throwaway database + the e2e seed (the scripts sign in with the seeded admin / doctor / nurse)
createdb hospilink_loadtest
cd backend && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospilink_loadtest \
  sh -c 'npx prisma migrate deploy && npx tsx prisma/seed.e2e.ts'

# 2. the API, with the per-IP limiters raised (TEST-ONLY env overrides; production keeps 20 auth / 15 min and 200 API / min)
DATABASE_URL=... JWT_SECRET=throwaway PORT=5000 CORS_ORIGINS=http://localhost:5173 NODE_ENV=production LOG_LEVEL=error \
  AUTH_RATE_LIMIT_MAX=100000 API_RATE_LIMIT_MAX=1000000 npx tsx src/server.ts

# 3. run (install k6 first: https://grafana.com/docs/k6/latest/set-up/install-k6/)
k6 run perf/vitals-ingest.js                 # smoke profile, about 20 s
k6 run -e PROFILE=load perf/vitals-ingest.js # the real numbers
```

Safety: the scripts refuse any `BASE_URL` that is not `localhost` unless you pass `-e ALLOW_REMOTE=true` (they write data and generate heavy
load). Never point them at production. `-e BASE_URL=... -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=...` (and DOCTOR_/NURSE_) target another throwaway stack.
`-e SUMMARY_JSON=out/{name}.json` writes the JSON summary used as a CI artifact.

## The scripts

| Script | Question it answers | Thresholds (the contract) |
|---|---|---|
| `vitals-ingest.js` | Can N bedside devices push 1 reading/s each (JSON, JSON batches, HL7; 2 % critical so alerts fire)? | p95 < 300 ms, p99 < 800 ms, < 1 % failed, **no dropped iterations** (the server kept up with the arrival rate), every reading of every request `stored` |
| `api-read.js` | What do the screens feel like with many staff reading at once (ramping users, think time)? | per endpoint p95 < 500 ms (audit/flow 800 ms), overall p95 < 600 ms, < 1 % failed |
| `contention.js` | Do the money/stock/number invariants hold when 20 clients hit the same rows? | **checks 100 %**: 60 dispenses on a stock of 25 -> exactly 25 succeed, stock 0, ledger -25; 40 payments of 1.00 on a 10.00 invoice -> exactly 10, PAID, never overpaid; 15 invoices issued at once -> 15 distinct consecutive numbers; 30 admits -> 30 distinct codes; never a 5xx |
| `socket-fanout.js` | Does a reading reach every follower, fast, over real WebSockets (socket.io protocol implemented in `lib/socketio.js`)? | every receiver gets every reading (`all_events_delivered` = 100 %), end-to-end p95 < 500 ms, all sockets connect |
| `exports.js` | Do exports return real files in time, and does the guard rail hold? | xlsx p95 < 3 s, pdf p95 < 8 s, valid file signatures, `no-store`, a >366-day period is 400, the 11th request in the minute is 429 |
| `rate-limits.js` | Are the abuse protections real? | 30 wrong passwords: at most 20 evaluated, the rest 429 (even the correct password during the lockout); a 230-request flood is cut off with 429 |

`PROFILE=smoke` (default) is for CI and quick checks; `PROFILE=load` raises it (50 devices x 2 min, 50 users x 4 min, contention x4, 100 receivers).
Knobs: `DEVICES`, `DURATION`, `PATIENTS`, `USERS`, `RECEIVERS`, `READINGS`, `EXPORT_ROWS`.

## Run order and gotchas
- `rate-limits.js` must run against the **default** limits and exhausts the auth window for your IP for 15 minutes: run it last, on a fresh API process, then restart the API.
  `exports.js` also needs the default export limiter (10/min, fixed): wait a minute between runs.
- The first request after a cold start is slower (JIT, connection pool); that is why p99 is looser than p95. Warm the API with one `GET /api/health` if a threshold flaps.
- A 409 in `contention.js` is a correct answer (`http.setResponseCallback` treats it as expected); a 5xx or any other 4xx fails the run.
- CI: `.github/workflows/load-test.yml` (manual with a profile choice, and weekly) starts PostgreSQL + the API on the runner and runs all six; JSON summaries are uploaded.
  Runner hardware is shared and slow: treat a CI latency failure as "investigate", the contention/delivery invariants as hard failures.

## Reference numbers
Measured on a small shared VM (PostgreSQL, API and k6 on the same machine, so these are pessimistic for the database and optimistic for the network). See the table below for the last recorded run.

| Script / profile | Result |
|---|---|
| `vitals-ingest` **load** (50 devices x 2 min, PRODUCTION rate limits, nothing raised) | 6 023 requests (49.9/s), 10 001 readings stored, p95 15 ms, p99 439 ms (cold start), 0 failures, 0 dropped iterations |
| `vitals-ingest` smoke (10 devices, 20 s) | p95 27 ms, 0 failures |
| `api-read` smoke (10 users) | p95 24 ms across 8 endpoints |
| `contention` smoke | all invariants held (25/25 dispenses, 10/10 payments, consecutive numbers, distinct codes) |
| `socket-fanout` smoke (20 receivers x 10 readings) | 200/200 delivered, p95 15 ms |
| `exports` (300+ patients) | xlsx p95 92 ms, pdf p95 207 ms |
| `rate-limits` | 20 login attempts evaluated then 429; flood cut off |

## What the load runs found
- The first 50-device run **failed 80 % of requests (HTTP 429)**: ingestion was throttled by a per-IP limiter (600/min on the route, and the general 200/min API limiter on top), so a hospital gateway carrying 50 devices (3 000 requests/min) was cut to a few readings per second. Fixed: ingestion is limited per authenticated device key (`INGEST_RATE_LIMIT_MAX`, default 6 000/min), rejected requests per IP (60/min), and it is exempt from the general limiter. The run above is the same script on the fixed code with production limits.
- Related, not changed here: the general limiter is 200 requests/minute **per IP**. Every browser behind one hospital NAT shares that budget. If staff report 429s on a busy ward, key the limiter per user (after `protect`) or raise it for authenticated traffic.
