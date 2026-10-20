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

## Day to day

- Change `schema.prisma`, then `npx prisma migrate dev --name <topic>` against a local/dev database.
- Commit the generated folder under `prisma/migrations/`.
- Deploy with `npx prisma migrate deploy` (never `db push` against production).
