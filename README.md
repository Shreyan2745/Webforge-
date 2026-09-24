# Webforge · Workshop Management API (P12)

A secure REST API for managing technical workshops and student registrations, built for the **Internal Backend Hackathon** (AI Full Stack Engineering course).

It covers everything the brief asks for (workshop catalogue, registration, participant management, workshop status, admin management) and adds a **fair waitlist with automatic promotion**, an **event-day spot registrar dashboard** that refills no-show seats from students who are physically at the venue, strict **state machines**, and a full **audit trail**.

**Stack:** Node.js · Express 5 · MongoDB Atlas + Mongoose · JWT in an HTTP-only cookie · bcrypt · Zod · Postman

---

## Contents

- [Quick start](#quick-start)
- [Test credentials](#test-credentials)
- [Demo walkthrough](#demo-walkthrough)
- [Roles](#roles)
- [Business rules](#business-rules)
- [State machines](#state-machines)
- [API reference](#api-reference)
- [Responses and status codes](#responses-and-status-codes)
- [Architecture](#architecture)
- [Concurrency](#concurrency)
- [Testing](#testing)
- [Design decisions](#design-decisions)
- [Future work](#future-work)

---

## Quick start

**Requirements:** Node.js 18+ and a MongoDB **replica set**. Transactions need one. The free MongoDB Atlas tier works.

```bash
git clone https://github.com/Shreyan2745/Webforge-.git
cd Webforge-
npm install
cp .env.example .env        # Windows: copy .env.example .env
# fill in MONGO_URI and JWT_SECRET
npm run seed                # wipes the DB and loads demo data
npm run dev                 # http://localhost:5000
```

Health check: `GET http://localhost:5000/health`

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `MONGO_URI` | required | Atlas connection string, e.g. `mongodb+srv://user:pass@cluster0.xxx.mongodb.net/webforge?retryWrites=true&w=majority` |
| `JWT_SECRET` | required | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | `1d` | Token and cookie lifetime |
| `PORT` | `5000` | HTTP port |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Allowed CORS origin (credentials enabled) |
| `CANCELLATION_CUTOFF_HOURS` | `2` | Users can't cancel a confirmed seat within this many hours of the start |
| `CHECKIN_WINDOW_MINUTES` | `60` | Check-in opens this many minutes before the start |
| `DEFAULT_NO_SHOW_GRACE_MINUTES` | `15` | No-shows can be marked this long after the start |
| `AUTH_RATE_LIMIT_MAX` | `20` | Login and register attempts per IP per 15 minutes |
| `GLOBAL_RATE_LIMIT_MAX` | `300` | All API requests per IP per 15 minutes |

---

## Test credentials

`npm run seed` creates these accounts:

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@webforge.dev` | `Admin@123` |
| SPOT_REGISTRAR | `spot1@webforge.dev` | `Spot@1234` |
| SPOT_REGISTRAR | `spot2@webforge.dev` | `Spot@1234` |
| USER | `aarav@student.dev`, `diya@`, `kabir@`, `ananya@`, `vihaan@`, `isha@`, `arjun@`, `meera@` (all `@student.dev`) | `User@1234` |

### Seeded workshops

Times are relative to when you run the seed.

| Workshop | State | What it demonstrates |
|---|---|---|
| Docker for Beginners | DRAFT | Hidden from everyone except admins |
| Node.js & Express REST APIs | PUBLISHED, free seats | Normal registration |
| MongoDB Schema Design | PUBLISHED, **full**, 3 waitlisted | Waitlist, capacity rules, promotion on a capacity increase |
| Git & GitHub Workflow (LIVE) | **Started 20 min ago** | Spot registrar dashboard. Vihaan is waitlist #1 but absent; Meera is #2 and **present** |
| AI Prompt Engineering | Starts in 90 min | 2-hour cancellation cutoff (Aarav can't cancel) |
| Kubernetes Deep Dive | CANCELLED | Cancelled workshops take no registrations |
| React Hooks Masterclass | COMPLETED | Attendance history (3 attended, 1 no-show) |
| System Design, Python, Secure Node.js | PUBLISHED | Search, filters and pagination |

Re-run `npm run seed` right before a demo so the LIVE and starting-soon workshops are still in their time windows.

---

## Demo walkthrough

1. **Catalogue:** `GET /workshops?search=node&sort=-startAt` works without logging in. Drafts never appear.
2. **Waitlist:** log in as Diya and register for *MongoDB Schema Design*. She gets `201 WAITLISTED` and her queue position.
3. **Cutoff:** log in as Aarav, open `GET /registrations/me`, and try to cancel *AI Prompt Engineering*. The API returns `422 CANCELLATION_CUTOFF_PASSED`.
4. **Promotion:** as admin, `PATCH /workshops/:id { "capacity": 4 }` on MongoDB Schema Design. The first waitlisted student is confirmed automatically.
5. **Spot registrar (headline feature):**
   1. Log in as `spot1` and open `GET /spot/workshops/:liveId/roster`. `nextInLine` is **Meera (#2, present)**, not Vihaan (#1, absent).
   2. Check in Aarav: `PATCH /spot/registrations/:id/check-in`.
   3. Mark Diya as a no-show: `PATCH /spot/registrations/:id/no-show`. The seat goes straight to Meera.
6. **Cascade:** as admin, cancel a workshop. Every confirmed and waitlisted registration is cancelled in one transaction.
7. **Audit:** `GET /audit-logs?resourceId=:workshopId` shows who did what and when, including actions the system took itself.

---

## Roles

| Action | Public | USER | SPOT_REGISTRAR | ADMIN |
|---|---|---|---|---|
| Browse published workshops | ✅ | ✅ | ✅ | ✅ (and drafts) |
| Register, view and cancel own registrations | | ✅ | | |
| Create, update, publish, cancel or complete workshops | | | | ✅ |
| View participants, change registration status | | | assigned workshops | ✅ |
| Event day: check-in, present, no-show | | | assigned workshops | ✅ |
| Create staff accounts, assign spot registrars | | | | ✅ |
| Audit logs | | | | ✅ |

- Public signup always creates a **USER**, and any `role` in the body is ignored. Staff accounts are created by an admin (`POST /admin/users`) or by the seed.
- **Ownership:** asking for someone else's registration returns **404, not 403**, so the API never confirms that a record exists.

---

## Business rules

| # | Rule |
|---|---|
| R1 | A workshop has a title, description, trainer, venue, `startAt`, `endAt`, capacity and status. `endAt > startAt`, `startAt` in the future, capacity is a whole number of at least 1 |
| R2 | Only admins create, update or change the status of workshops |
| R3 | Registration is open only while a workshop is PUBLISHED and hasn't started |
| R4 | Cancelled workshops accept no registrations (`409 REGISTRATION_CLOSED`) |
| R5 | One active registration per user per workshop. Re-registering after a cancel is allowed and goes to the back of the queue |
| R6 | `seatsTaken` never exceeds capacity. When a workshop is full, the student is waitlisted |
| R7 | Users can cancel a CONFIRMED seat until **2 hours before start**. Waitlisted users can leave any time before the end. Admins can cancel any time before start |
| R8 | Cancelling a workshop cancels all of its CONFIRMED and WAITLISTED registrations in one transaction |
| R9 | Capacity can't go below booked seats. Raising it promotes from the waitlist |
| R10 | Changing the date, time or venue of a live workshop flags registrants for notification |
| R11 | Promotion goes straight to CONFIRMED. There is no acceptance window |
| R12 | Promotion order: the oldest waitlisted person first. **Once the check-in window opens, only people marked present at the venue** |
| R13 | Spot registrars act only on workshops they are assigned to |
| R14 | Completing a workshop marks CONFIRMED registrations with no check-in as NO_SHOW and closes the waitlist |
| R15 | Signup ignores `role`. Password hashes are never returned |

---

## State machines

Every status change goes through one transition map (`src/utils/transitions.js`). Any move not in the map returns `409 INVALID_TRANSITION`.

```
Workshop       DRAFT ──► PUBLISHED ──► COMPLETED
                 │           │
                 └─────► CANCELLED ◄┘            (CANCELLED and COMPLETED are final)

Registration   WAITLISTED ──► CONFIRMED ──► ATTENDED   (check-in window)
                    │             ├──────► NO_SHOW    (after grace period)
                    └──────► CANCELLED ◄┘             (CANCELLED, ATTENDED, NO_SHOW are final)
```

Each registration keeps an embedded `statusHistory` (`status`, `at`, `by`, `byRole`, `reason`). The separate audit log records every action across the whole system.

---

## API reference

Every path below is under `/api/v1`. List endpoints accept `page`, and `limit` up to 50.

| Method | Path | Access | Notes |
|---|---|---|---|
| **Auth** | | | |
| POST | `/auth/register` | Public | Always creates a USER and sets the cookie. Rate limited |
| POST | `/auth/login` | Public | Sets the HTTP-only cookie. Rate limited |
| POST | `/auth/logout` | Signed in | Clears the cookie |
| GET | `/auth/me` | Signed in | Current user |
| **Workshops** | | | |
| GET | `/workshops` | Public | `search`, `status`, `trainer`, `from`, `to`, `upcoming`, `sort` (`startAt`, `-startAt`, `createdAt`, `-createdAt`, `title`, `-title`) |
| GET | `/workshops/:id` | Public | Includes `seatsLeft`. Drafts are admin-only |
| POST | `/workshops` | Admin | Always created as DRAFT |
| PATCH | `/workshops/:id` | Admin | Details and capacity (R9, R10) |
| PATCH | `/workshops/:id/status` | Admin | `PUBLISHED`, `CANCELLED` (cascades) or `COMPLETED` |
| PUT | `/workshops/:id/spot-registrars` | Admin | `{ userIds: [...] }` |
| GET | `/workshops/:id/participants` | Admin | Status counts, waitlist positions, `status` and `search` filters |
| **Registrations** | | | |
| POST | `/workshops/:id/register` | User | `201` CONFIRMED, or WAITLISTED with a position |
| GET | `/registrations/me` | User | Grouped as upcoming, waitlisted, past and cancelled, with `canCancel` |
| GET | `/registrations/:id` | Owner or admin | Includes `statusHistory` |
| PATCH | `/registrations/:id/cancel` | Owner or admin | Cutoff applies to the owner (R7). Promotes the next in line |
| PATCH | `/registrations/:id/status` | Admin | `CONFIRMED`, `CANCELLED`, `ATTENDED` or `NO_SHOW`, checked by the state machine and time rules |
| **Spot registrar** | | | |
| GET | `/spot/workshops` | Spot registrar or admin | Assigned workshops with check-in window info |
| GET | `/spot/workshops/:id/roster` | Spot registrar or admin | Confirmed, attended, no-show and waitlisted lists, with `nextInLine` |
| PATCH | `/spot/registrations/:id/present` | Spot registrar or admin | A waitlisted student is at the venue. Fills a free seat immediately |
| PATCH | `/spot/registrations/:id/check-in` | Spot registrar or admin | CONFIRMED → ATTENDED |
| PATCH | `/spot/registrations/:id/no-show` | Spot registrar or admin | Frees the seat and promotes the next present student |
| **Admin** | | | |
| POST | `/admin/users` | Admin | Create a SPOT_REGISTRAR or ADMIN account |
| GET | `/admin/users` | Admin | `role` and `search` filters |
| GET | `/audit-logs` | Admin | `actor` (an id or `SYSTEM`), `actorRole`, `action`, `resourceType`, `resourceId`, `from`, `to` |

---

## Responses and status codes

Success:

```json
{ "success": true, "message": "Workshops fetched", "data": { ... }, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
```

Error:

```json
{ "success": false, "error": { "code": "CANCELLATION_CUTOFF_PASSED", "message": "...", "details": [] } }
```

| Code | When |
|---|---|
| 200 / 201 | Success / created |
| 400 | Validation failed (`VALIDATION_ERROR`, with field-level `details`), malformed id (`INVALID_ID`), malformed JSON |
| 401 | No cookie, invalid or expired token (`UNAUTHENTICATED`), wrong credentials (`INVALID_CREDENTIALS`) |
| 403 | Signed in but the wrong role (`FORBIDDEN`) |
| 404 | Not found, not visible, or not yours (`NOT_FOUND`), unknown route (`ROUTE_NOT_FOUND`) |
| 409 | `EMAIL_TAKEN`, `ALREADY_REGISTERED`, `REGISTRATION_CLOSED`, `INVALID_TRANSITION`, `CAPACITY_BELOW_BOOKED`, `WORKSHOP_NOT_EDITABLE`, `WORKSHOP_FULL` |
| 422 | Valid request that breaks a time rule: `CANCELLATION_CUTOFF_PASSED`, `CHECKIN_WINDOW_CLOSED`, `NO_SHOW_TOO_EARLY`, `WORKSHOP_NOT_ENDED`, `WORKSHOP_IN_PAST`, `INVALID_ASSIGNEE` |
| 429 | Rate limit hit (`RATE_LIMITED`) |
| 500 | Unexpected error. The stack trace is logged, never sent in production |

---

## Architecture

```
Request ─► helmet · cors · cookie-parser ─► rate limiter ─► route
        ─► authenticate (JWT cookie → req.user) ─► authorize(roles) ─► validate (Zod)
        ─► controller (thin) ─► service (business rules + transaction) ─► MongoDB
                                         └─ after commit ─► event bus ─► audit log listener
        ─► central error handler (maps Mongoose, JWT and Zod errors to the response format)
```

```
src/
├── app.js / server.js     Express app, startup
├── config/                env (validated) + database
├── constants/             enums, error codes, event names
├── models/                User, Workshop, Registration, AuditLog
├── middleware/            authenticate, authorize, validate, rateLimiter, errorHandler, notFound
├── validators/            Zod schemas per resource
├── routes/                /api/v1 route map
├── controllers/           request → service → response
├── services/              auth, workshop, registration, promotion, spot, admin, audit
├── events/                in-process event bus + listeners
└── utils/                 ApiError, transitions, time rules, pagination, transactions, JWT, cookies
scripts/                   seed.js, smoke tests
postman/                   Postman collection
```

- **Controllers are thin, services hold the rules.** The same `runStatusAction` powers both the admin status endpoint and the spot registrar dashboard, so the rules can't drift apart.
- **Events fire after commit.** Services emit domain events (`WORKSHOP_CANCELLED`, `WAITLIST_PROMOTED`, ...) only once the transaction has committed. The audit listener records them best-effort: a logging failure never fails the request.

---

## Concurrency

"Two students hit the last seat at the same time" is handled at the database level:

```js
Workshop.findOneAndUpdate(
  { _id, status: 'PUBLISHED', startAt: { $gt: now }, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
  { $inc: { seatsTaken: 1, queueSeq: 1 } },
  { new: true, session }
);   // null → full → waitlist
```

- **Atomic seat claim.** The capacity check and the increment are one operation, so MongoDB lets only one request win the last seat.
- **Queue tickets.** Every registration takes a ticket (`queueSeq`) in that same write. Writing the workshop document forces concurrent registrations for that workshop to go through one at a time, so waitlist positions are exact even under a burst. Queue order comes from the ticket; **positions are never stored**.
- **Duplicate protection:** an active-registration check, plus a **partial unique index** `{ user, workshop }` where `isActive: true`. A double-submit that races past the check hits the index and gets `409`.
- **Transactions** wrap register, cancel with promotion, no-show with promotion, capacity increases, workshop cancel and completion.

This is verified by a smoke test that fires **20 parallel registrations at 1 seat**. Exactly 1 is confirmed, 19 are waitlisted with positions 1 to 19 and no gaps, and `seatsTaken` stays at 1.

---

## Testing

### Postman

Import `postman/Webforge-P12.postman_collection.json` and run it with the Collection Runner right after `npm run seed`. It has **86 requests and 258 assertions** in six folders: health, auth, admin workshops, student registration, spot registrar event day, and admin lifecycle and audit. It covers every success and failure path listed above. The cookie is handled automatically, and each folder logs in as the role it needs.

You can also run it from the command line:

```bash
npm run test:postman        # = npx newman run postman/Webforge-P12.postman_collection.json
```

Run `npm run seed` again before re-running, because the collection changes data. Running it twice within 15 minutes may hit the login rate limit. Raise `AUTH_RATE_LIMIT_MAX` in `.env` while testing if needed.

### Live demo collection

`postman/Webforge-Demo.postman_collection.json` holds the 40-request presentation flow. Send the requests one at a time from top to bottom right after `npm run seed`. IDs are captured automatically, and each request's description has its talking point.

### Smoke tests (against your real database)

With `npm run dev` running:

| Command | Covers |
|---|---|
| `npm run smoke:auth` | Register, login, logout, me, cookies, validation, role stripping |
| `npm run smoke:workshops` | CRUD, visibility, state machine, capacity guard, cascade cancel, completion, participants |
| `npm run smoke:registrations` | Waitlist, promotion, cutoff, attendance rules, **20-way race**, double submit |
| `npm run smoke:spot` | The full event-day flow, including the present-only promotion rule |
| `npm run smoke:audit` | Audit trail, SYSTEM actions, failed logins, filters |

---

## Design decisions

- **JWT in an HTTP-only cookie**, re-validated against the database on every request, so a deleted user loses access immediately. `sameSite=lax`, and `secure` in production.
- **Timing-safe login.** An unknown email still runs a bcrypt comparison and gets the same error message, so response time can't be used to find valid emails.
- **Zod strips unknown fields.** Clients can never set `status`, `seatsTaken`, `createdBy` or `role`.
- **`startAt` and `endAt` are real dates (UTC)**, not date and time strings, which keeps sorting, filtering and time rules simple.
- **A 404 for resources you can't access**, whether it's someone else's registration or a workshop you aren't assigned to, avoids leaking which records exist.
- **Promotion goes straight to CONFIRMED.** An acceptance window would need scheduled expiry jobs for little benefit in a hackathon.
- **Present-only promotion on event day.** Giving a no-show's seat to someone who isn't at the venue would waste it. The spot registrar marks waitlisted students present, and promotion keeps the original queue order among them.
- **Registration history is kept separate from the audit log.** History answers "what happened to this registration?"; the audit log answers "who did what, when, to what?" across the whole system.

## Future work

- An acceptance window for promoted users
- In-app and email notifications, scheduled reminders, certificates with public verification, and admin analytics (Tier 3)
- A job queue (BullMQ + Redis) for multi-instance deployments
- QR code check-in for spot registrars
- Refresh tokens, email verification and password reset
