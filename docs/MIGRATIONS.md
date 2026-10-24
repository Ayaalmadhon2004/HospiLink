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

## Multi-tenancy migrations (`20261022000000`, `20261022000001`)

- `user_account_status` adds `User.accountStatus` (default `ACTIVE`, so existing users keep working).
- `hospital_scoping` adds a required `hospitalId` to `Staff`, `Incident`, `DispatchUnit`, `DispatchCall`. It adds the column as nullable, backfills it
  (Staff -> hospital of the `User` with the same email, otherwise the oldest hospital; the other tables -> the oldest hospital), then sets NOT NULL.
  It fails loudly if rows exist but no `Hospital` does. `Incident.code` and `DispatchUnit.unitCode` become unique per hospital.
- Check before deploying: if production already has more than one hospital, review which hospital the pre-existing incidents, dispatch units and calls belong to.

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

## Appointment overlap constraint (`20261026000000_appointment_overlap`)

Adds `CREATE EXTENSION btree_gist` and an exclusion constraint so a doctor cannot have two overlapping non-cancelled appointments
(checked with each appointment's own `duration`). The API checks first (409), the constraint closes the race between concurrent requests.
**Run the overlap query written at the top of the migration file against production first**: the migration fails if overlapping appointments
already exist (cancel or reschedule them, then deploy). Tested on PostgreSQL 16; creating the extension needs a role that may do so (Neon allows it).

## Staff <-> login link (`20261027000000_staff_user_link`)

Adds `Staff.userId` (unique, `ON DELETE SET NULL`). The backfill links a staff member to the `User` with the same email (case-insensitive) in the SAME hospital,
strictly one-to-one; ambiguous or cross-hospital matches stay unlinked. After deploying, staff shown with a "No login" badge either have no account or had a
mistyped email: fix the email in the staff form (it re-links when a matching login exists) or use `PUT /api/staff/:id/login`.

## Dispatch call history (`20261028000000_dispatch_call_history`)

Drops the UNIQUE index on `DispatchCall.assignedUnitId` (a unit could be assigned to only one call in its whole life) and replaces it with a plain index.
The live unit <-> call link is still `DispatchUnit.currentCallId` (unique). Nothing to check before deploying; units that stayed `EN_ROUTE` on calls that never got closed
can be freed by completing or cancelling those calls through the new endpoints.

## Per-hospital vital thresholds (`20261029000000_vital_thresholds_hospital`)

`VitalThresholds` had no `hospitalId` (one table shared by all hospitals). The migration adds it, **copies every existing row to every hospital**, removes the global rows and
makes (hospitalId, department, vitalType) unique. Checked on PostgreSQL 16 with existing rows and two hospitals. After deploying, review `GET /api/vitals/thresholds` for each hospital:
a hospital that never configured anything now relies on the built-in defaults (adult ranges) instead of silently having no alerts.

## Bed / patient reconciliation (`20261030000000_reconcile_beds`)

Data-only. Enforces "bed OCCUPIED <=> patient assigned" on existing rows: a DISCHARGED patient loses their bed (the bed becomes AVAILABLE); a bed with a patient becomes OCCUPIED
(even if it was CLEANING/MAINTENANCE, the patient is there); an OCCUPIED bed with nobody becomes AVAILABLE. To preview what it will change, run the three `UPDATE ... WHERE` conditions as `SELECT`s first.

## Schema integrity pass (`20261101000000` … `20261101000400`)

Five small migrations, applied in order. All were run on PostgreSQL 16 against a database holding legacy-shaped rows; `prisma migrate diff` against `schema.prisma` is empty afterwards.

| Migration | What it does | Check before deploying |
| --- | --- | --- |
| `audit_log_relations` | `AuditLog.userId` becomes a nullable FK to `User` (`ON DELETE SET NULL`) + indexes `(userId, createdAt)`, `(entityId)`, `(action, createdAt)`, `(createdAt)`. Rows whose user no longer exists keep their data but get `userId = NULL`. | `SELECT count(*) FROM "AuditLog" a WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = a."userId")` = rows that will be detached. |
| `patient_doctor_is_staff` | `Patient.doctorId` now references `Staff` (like `Appointment.doctorId`). Existing User ids are translated to the Staff row with `Staff.userId = <user id>` (same hospital). **A doctor without a linked Staff record cannot be kept: the patient's `doctorId` is cleared.** | `SELECT count(*) FROM "Patient" p WHERE p."doctorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Staff" s WHERE s."userId" = p."doctorId" AND s."hospitalId" = p."hospitalId")` = patients that lose their doctor. Link those users first (`PUT /api/staff/:id/login`). |
| `explicit_on_delete` | `Bed -> Ward/Hospital`, `Incident -> Hospital`, `Staff -> Hospital` become `RESTRICT`; `Shift -> Staff` becomes `CASCADE`. Adds `Bed(wardId)` and `Shift(staffId, startTime)` indexes. | Anything that deleted a hospital/ward with children relied on `CASCADE`: delete the children first now. |
| `dispatch_unit_geo_and_crew` | `DispatchUnit.location` -> `lat`/`lng` (only `{"lat":..,"lng":..}` values inside range survive; free text such as "Main gate" is dropped). `DispatchUnit.crew text[]` -> `Staff.dispatchUnitId`: a name is linked when it matches exactly one Staff of the same hospital (case-insensitive); others are dropped. The migration prints a `NOTICE` with both counts. | Run `SELECT "unitCode", "location", "crew" FROM "DispatchUnit"` and make sure each crew name exists in the staff directory; add missing ones, then deploy. |
| `patient_soft_delete` | `Patient.deletedAt` + index `(hospitalId, deletedAt)` + a `BEFORE DELETE` trigger that raises on any hard delete. | None. A script that really needs to erase a patient (legal request) must `ALTER TABLE "Patient" DISABLE TRIGGER "Patient_no_hard_delete"` explicitly. |

API changes that go with it: `DELETE /api/patients/:id` (ADMIN, soft delete, frees the bed); dispatch units return `lat`, `lng` and `crew: [{ id, name, role }]`; `POST/PUT /api/dispatch/units` take
`crewIds: string[]` (Staff ids of the caller's hospital) instead of `crew`; `PUT /api/dispatch/units/:id/status` takes `lat`/`lng` instead of `location`; `DELETE /api/staff/:id` answers 409 while the staff member has appointments.
