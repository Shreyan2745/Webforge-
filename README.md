# Webforge · Workshop Management API (P12)

REST API for managing technical workshops and student registrations, built for the Internal Backend Hackathon.

**Stack:** Node.js · Express · MongoDB Atlas + Mongoose · JWT (HTTP-only cookie) · bcrypt · Zod · Postman

> 🚧 Work in progress. Sections marked TODO are filled in as each component is built.

## Features

- USER / SPOT_REGISTRAR / ADMIN role-based access control
- Workshop catalogue with search, filter, sort and pagination
- Registration with capacity enforcement (atomic, race-safe) and a fair waitlist
- Automatic waitlist promotion
- Event-day spot registrar dashboard: check-in, no-show, instant seat refill from present waitlisted students
- Strict state machines for workshops and registrations
- Registration history and audit logs
- Notifications, scheduled reminders, certificates with public verification, admin analytics

## Getting started

```bash
git clone https://github.com/Shreyan2745/Webforge-.git
cd Webforge-
npm install
cp .env.example .env      # fill in MONGO_URI and JWT_SECRET
npm run seed
npm run dev
```

The API runs at `http://localhost:5000/api/v1`. Health check: `GET /health`.

> MongoDB **must be a replica set** (transactions). MongoDB Atlas, including the free tier, works.

## Project structure

```
src/
├── app.js             Express app, global middleware, routes, 404, error handler
├── server.js          DB connect, listeners, cron, listen
├── config/            env + database
├── constants/         enums, error codes, event names
├── models/            Mongoose schemas
├── middleware/        authenticate, authorize, validate, rate limiter, error handler
├── validators/        Zod schemas
├── routes/            route definitions (/api/v1/...)
├── controllers/       thin request/response layer
├── services/          business rules + transactions
├── events/            event bus + audit/notification listeners
├── jobs/              scheduled reminders (node-cron)
└── utils/             ApiError, asyncHandler, response helper, state machines, time rules
scripts/seed.js        demo data
postman/               Postman collection
```

## Test credentials

TODO (after seed script)

## API reference

TODO (route table)

## Business rules

TODO (R1–R15)

## Design decisions

TODO

## Future work

- Acceptance window for promoted waitlist users
- Job queue (BullMQ + Redis) for multi-instance deployments
- QR code check-in
- Refresh tokens, email verification, password reset
