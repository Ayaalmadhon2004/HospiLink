# PDF and Excel exports

`GET /api/exports/:type?format=xlsx|pdf&from=&to=` streams a file download (`Content-Disposition: attachment`, `Cache-Control: no-store`).

| `type` | Contents | Who | Period filter on |
|---|---|---|---|
| `patients` | code, name, age, gender, status, department, diagnosis, doctor, ward / bed, admitted, discharged | ADMIN, DOCTOR | admission date |
| `appointments` | schedule, duration, patient, doctor, type, status, department, room | ADMIN, DOCTOR | `scheduledAt` |
| `vitals` | readings with critical flag and alert (never who recorded them) | ADMIN, DOCTOR | `recordedAt` |
| `billing` | invoice number, status, patient, dates, total / discount / paid / balance | ADMIN | `createdAt` |

- `from` (inclusive) / `to` (exclusive) are ISO instants; the default is the last 30 days, the maximum span 366 days.
- **Row cap: 10 000.** More matching rows answers **413 `EXPORT_TOO_LARGE`**; a truncated export is never produced silently. Narrow the period.
- Tenant: every loader is scoped by the caller's hospital (directly or through the patient) and skips soft-deleted patients.
- Rate limit: 10 exports per minute per IP, on top of the general limiter. Every export is written to the audit log (`EXPORT_DATA`, the URL shows type and period).
- **Excel:** real numbers and dates (sortable, summable), money in major units with `#,##0.00`, frozen header, filter. Text cells starting with `= + - @` (or tab / CR) get a leading `'` so a patient named `=HYPERLINK(...)` is data, not a formula (`services/exports/sanitize.ts`).
- **PDF:** landscape A4, repeating header, "Page x of y", dates in UTC. It uses the built-in PDF fonts, so **Arabic text (e.g. an Arabic patient name) does not render in the PDF**; the Excel export is unaffected. To fix: register a Unicode font (e.g. Noto Naskh Arabic) with `doc.registerFont` in `pdfWriter.ts` and shape/bidi the strings (pdfkit does not reorder RTL text on its own).
- Exports hold bulk patient data: handle downloaded files as such.

## Adding a dataset
1. Add the type to `EXPORT_TYPES` (`services/exports/types.ts`).
2. Add a loader in `services/exports/datasets.ts` (hospital scope, `deletedAt: null` through the patient, deterministic `orderBy`, `take`).
3. Add its roles to `ALLOWED_ROLES` (`controllers/exports.controller.ts`) and to the frontend `ExportMenu` permission mapping; mount `<ExportMenu type="..."/>` on its page.
4. Add a case to `tests/services/exports/datasets.test.ts` and the role matrix in `tests/controllers/exports.controller.test.ts`.
