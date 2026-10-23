# Notifications

All notifications go through `backend/src/services/notification.service.ts`.

```ts
import { notify } from '../services/notification.service';

await notify({
  type: 'SHIFT',                       // VITALS | INCIDENT | DISPATCH | APPOINTMENT | SHIFT | SYSTEM
  title: 'Shift starts in 1h',
  message: 'Night shift, ICU',
  link: '/staff',                      // internal frontend route (react-router path)
  recipients: {
    roles: ['NURSE'],                  // role filter (AND department when both given)
    department: 'ICU',
    userIds: ['...'],                  // always included (union)
    excludeUserId: actorId,            // never notify the actor
    hospitalId: '...',                 // or scopeUserId / excludeUserId => hospital of that user
  },
});
```

`notify` resolves users (same hospital), drops users whose `UserSettings` toggle for the
category is off (no settings row => schema defaults), stores rows with `createManyAndReturn`
and emits `new-notification` to room `user-<id>`. It never throws (errors are logged, `[]`
returned), so it is safe to call from controllers and cron jobs. An empty selector sends nothing.

For a cron job (shift/appointment reminders) call `notify` directly with `hospitalId` (or explicit
`userIds`); no request/actor is needed. De-duplicate in the job itself.

## Settings mapping

| type          | UserSettings toggle    | default |
|---------------|------------------------|---------|
| `VITALS`      | `criticalVitalsAlerts` | on      |
| `INCIDENT`    | `incidentEscalations`  | on      |
| `DISPATCH`    | `dispatchAlerts`       | on      |
| `APPOINTMENT` | `appointmentReminders` | on      |
| `SHIFT`       | `shiftReminders`       | off     |
| `SYSTEM`      | none, always delivered | -       |

## Who gets what

| Event (controller)                                          | Type        | Recipients                                              | Link            |
|-------------------------------------------------------------|-------------|---------------------------------------------------------|-----------------|
| Vitals recorded critical / edit makes a reading critical (`vitals`) | VITALS | patient's assigned doctor + DOCTOR/NURSE of the patient's department (actor included) | `/patients/:id` |
| Incident created (`incidents`)                              | INCIDENT    | ADMIN, DOCTOR, NURSE except actor                       | `/incidents`    |
| Incident severity raised (`PUT /incidents/:id`, LOW<MODERATE<ELEVATED<CRITICAL) | INCIDENT | same                              | `/incidents`    |
| Incident resolved (`PUT /incidents/:id` or `/status`)       | INCIDENT    | same                                                    | `/incidents`    |
| Dispatch call created (`dispatch`)                          | DISPATCH    | DISPATCHER + ADMIN except actor                         | `/dispatch`     |
| Unit assigned to call                                       | DISPATCH    | same                                                    | `/dispatch`     |
| Appointment created / schedule, status, doctor or room changed / cancelled (`appointments`) | APPOINTMENT | the doctor concerned (Staff -> User matched by email), except actor | `/appointments` |
| `POST /api/notifications/broadcast` (ADMIN)                 | SYSTEM      | everyone in the admin's hospital, or one `role`         | optional        |

Notes:
- `Appointment.doctorId` references `Staff`; the login `User` is found by the shared email. A doctor
  without a login is silently skipped.
- Scheduled reminders (`services/reminders.service.ts`, ticked every minute by `services/scheduler.ts`, started from
  `server.ts`, disabled when `NODE_ENV=test`): shifts (type `SHIFT`, link `/staff?shift=<id>`) and non-cancelled
  appointments (type `APPOINTMENT`, link `/appointments?reminder=<id>-<scheduledAt ms>`) that start within the next
  30 minutes. The recipient is the Staff member's login (matched by email; no login => skipped). Idempotent: skipped if
  the user already has a Notification with the same type + link. A user with the toggle off gets nothing (re-checked
  each tick until the item starts, no duplicates). Late runs (Render sleeping) still remind while the item has not started.
- `POST /api/internal/run-reminders` runs one pass on demand (e.g. from an external cron that wakes Render). Send header
  `x-reminders-secret: <REMINDERS_CRON_SECRET>` (compared in constant time). 404 when the env var is unset, 401 on a
  wrong secret. Returns `{ success, data: { shifts, appointments } }` (counts sent).
- Broadcast body: `{ title, message, role?: ADMIN|DOCTOR|NURSE|DISPATCHER, link?: "/internal-path" }`.

## Frontend

`hooks/useNotifications` listens for `new-notification`; `NotificationBell` shows a sonner toast
(error for VITALS, warning for INCIDENT/DISPATCH, info otherwise) with a "View" action, a type icon,
an All/Unread filter and "mark all as read". Clicking an item navigates to its `link`.
