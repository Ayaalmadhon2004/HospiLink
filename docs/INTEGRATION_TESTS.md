# Backend integration tests (real PostgreSQL)

The unit suite (`npm test`) mocks Prisma, so it cannot prove anything that depends on the database itself: triggers, CHECK and
exclusion constraints, row locks, serializable transactions, unique indexes, cascades. `backend/tests-int` runs the real routers,
controllers and Prisma against a real PostgreSQL, and boots the real server for socket.io.

```bash
createdb hospilink_inttest   # the NAME MUST contain "test" or "e2e": the suite TRUNCATEs every table
export INT_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/hospilink_inttest'
cd backend && npm run test:int
```

`jest.int.config.js` applies every migration first (`prisma migrate deploy`, like production), refuses a database whose name does
not look throwaway, runs files one after another (one shared database) and empties all tables between tests.
CI job `backend-integration` runs it on a `postgres:16` service and also fails when the migrations and `schema.prisma` have drifted
(`prisma migrate diff --exit-code`).

## What each file proves

`roles.int.test.ts` runs the PHARMACIST and BILLING jobs end to end (receive, queue, dispense, invoice from the dispensation, issue, pay, billing export), their lack of clinical access, and hospital isolation of the queue and the patient lookup.

| File | Proves |
|---|---|
| `constraints.int.test.ts` | patients cannot be hard-deleted; clinical notes are immutable (but an author account can still be deleted); a doctor cannot be double-booked (exclusion constraint, also under a 6-way race); stock / money CHECKs; unique invoice numbers per hospital; one patient per bed; wards with beds cannot be deleted |
| `concurrency.int.test.ts` | one bed, one winner among 8 admits; 12 concurrent admits get distinct patient codes; 15 dispenses of the last 10 units; stock always equals the ledger; 7 payments on a 1000 invoice cannot overpay; gap-free invoice numbers (a refused issue burns none); no dispensation is billed twice; amendments, prescription close, lab results and duplicate medications are decided once; two admins cannot demote each other to zero admins; a reminder is delivered once however many schedulers fire |
| `tenancy.int.test.ts` | ~45 routes called by hospital A with hospital B's ids answer 404/400 and change nothing; lists, audit trail and Excel exports contain only the caller's hospital and no soft-deleted patients |
| `deviceIngest.int.test.ts` | device key lifecycle (hash only, revoke is immediate), HL7 / FHIR / JSON end to end, a key cannot write to another hospital's patient, a critical device reading escalates and notifies like a manual one |
| `sockets.int.test.ts` | the real server over real WebSockets: handshake refusals (no/forged token, PENDING/DISABLED, token older than a role change), `new-vital` / `patient-status-changed` / `new-notification` / incident / shift / dispatch events reach exactly the intended rooms and never another hospital or an unauthorised role |

## Bugs these tests found (fixed in the same change)
1. **Deleting a user who had written a clinical note failed**: `ON DELETE SET NULL` runs as an UPDATE, which the immutability trigger refused. Migration `20261102000400_clinical_note_author_setnull` lets exactly that change through.
2. **Concurrent admits failed (500) beyond ~5 at once**: every request computed the same "next" patient code. Allocation now happens under a transaction-scoped advisory lock (`pg_advisory_xact_lock`, via `$executeRaw`: the function returns `void`, which `$queryRaw` cannot deserialize).
3. **A lost serializable race returned 500 instead of 409**: with the pg driver adapter the error is a bare `TransactionWriteConflict` (cause `40001`), not `P2034`. `utils/dbErrors.ts` `isSerializationFailure` recognises both.

## Writing a new one
- Build data with `helpers/factories.ts` (`makeWorld()` = hospital + admin/doctor/nurse + ward/bed/patient), authenticate with `bearer(userId)` and call routes with `call(method, url, auth, body)`. Concurrency: `Promise.all` N calls and assert the exact split of statuses plus the final database state.
- Tests that need sockets use `helpers/server.ts` (`startServer`, `connectUser`, `nextEvent`). Note a sender does not receive its own `socket.to(room)` broadcast: observe with a second socket. The server's general rate limit is 200 requests/minute per IP, so keep HTTP calls in that file modest.
- Assert "nothing happened" with a short timeout (`nextEvent(..., 800)` returns `null`).
- `helpers/db.ts` `pgCode()` / `pgMessage()` read the PostgreSQL error behind Prisma's generic wrapper.

Still out of scope: load testing (k6), and Playwright flows for the new modules (see `docs/ROADMAP.md`).
