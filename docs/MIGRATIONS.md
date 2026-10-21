# Database migrations

`backend/prisma/migrations/00000000000000_baseline` is the schema as it stood when migrations were introduced.
The production database already has these tables (created with `prisma db push`), so it must be
**marked as applied, not executed**.

## One-time step on production (Neon)

From `backend/`, with the production `DATABASE_URL` in your shell (never commit it):

```
npx prisma migrate resolve --applied 00000000000000_baseline
```

After that, `npx prisma migrate deploy` is a no-op until a new migration is added.

## Known gap in production: `Notification`

The production database was created with `db push` before the `Notification` model existed, so marking the baseline as applied
left that table missing (`P2021` on `GET /api/notifications`). Migration `20261021000000_ensure_notification_table` creates it
with `IF NOT EXISTS`, so it is a no-op on databases that already have it. Tested against a fresh database and against one built
from the baseline without `Notification`. If you repaired production by hand first, deploying it is still safe.

## Day to day

- Change `schema.prisma`, then `npx prisma migrate dev --name <topic>` against a local/dev database.
- Commit the generated folder under `prisma/migrations/`.
- Deploy with `npx prisma migrate deploy` (never `db push` against production).

## Automatic on deploy (CI/CD)

The `deploy-backend` job in `.github/workflows/ci-cd.yml` (pushes to `main`, after Backend CI and Frontend CI pass) runs `npx prisma migrate deploy` before it triggers the Render deploy hook, so new code never starts against an older schema.

Setup, once, in GitHub: Settings -> Environments -> `production` -> add the secret `MIGRATE_DATABASE_URL`. Use Neon's direct (non-pooled) connection string. It is separate from the `DATABASE_URL` Render uses at runtime and is never printed in the logs.

- If the secret is not set, the step prints a warning and is skipped; run `npx prisma migrate deploy` by hand in that case.
- If the migration fails, the job stops and the deploy hook is not triggered.
- Migrations should be additive (add a column, then ship the code that uses it) because the old code keeps serving while the new one builds. Destructive changes need a two-step release.
- Never use `db push` against production.
