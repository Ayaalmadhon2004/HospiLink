# Docker

Runs the full stack locally: PostgreSQL 16, the backend (Node 22, port 5000) and the frontend (nginx, port 8080).

## Setup

```bash
cp .env.docker.example .env.docker
# edit .env.docker: set POSTGRES_PASSWORD and JWT_SECRET (e.g. openssl rand -hex 48)
```

`.env.docker` is git-ignored. Only placeholders live in `.env.docker.example`.

`VITE_API_URL` is baked into the frontend at build time and is the URL the **browser** uses (it must end in `/api`,
default `http://localhost:5000/api`). `CORS_ORIGINS` must contain the frontend origin (default `http://localhost:8080`).
If you change either, rebuild with `--build`.

## Build and start

```bash
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
```

- Frontend: http://localhost:8080
- Backend: http://localhost:5000

## Migrations (not automatic)

The backend container never migrates on start. Apply migrations with the one-off `tools` service
(it uses the build stage, which has the Prisma CLI):

```bash
docker compose --env-file .env.docker --profile tools run --rm tools npx prisma migrate deploy
```

For an existing database that predates migrations, resolve the baseline first (see `docs/MIGRATIONS.md`):

```bash
docker compose --env-file .env.docker --profile tools run --rm tools npx prisma migrate resolve --applied 00000000000000_baseline
```

## Seed (development data only)

```bash
docker compose --env-file .env.docker --profile tools run --rm tools npx prisma db seed
```

`seed.ts` creates demo data; do not run it against a real hospital database.

## Other

```bash
docker compose --env-file .env.docker logs -f backend
docker compose --env-file .env.docker down        # stop, keep data
docker compose --env-file .env.docker down -v     # stop and delete the database volume
```

Notes:
- The auth cookie is `secure` + `sameSite=none` (the default when `COOKIE_DOMAIN` is unset; with it, the cookie is `sameSite=lax`). Browsers accept this on `localhost` over http, but not on other plain-http hosts;
  put the stack behind HTTPS for anything beyond local use.
- Uploaded report files are stored in the database (`Report.fileData`), so no uploads volume is needed.
