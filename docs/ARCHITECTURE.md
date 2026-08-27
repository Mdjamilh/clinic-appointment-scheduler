# Architecture

CareSlot is a single Next.js application. Pages are React Server Components that read from the database directly; mutations go through Server Actions; the FHIR API is a set of Route Handlers. There is no separate backend service.

```
Browser
  │  RSC payloads / Server Actions / JSON
  ▼
Next.js (App Router)
  ├─ app/            pages, actions.ts, intake-actions.ts, api/fhir/*
  ├─ server/         business logic (no React, no HTTP)
  │    appointments.ts   book / cancel / reschedule rules
  │    queries.ts        read models for pages
  │    fhir.ts           FHIR search with access control
  │    intake.ts         red flags → model → keyword rules
  │    session.ts        demo session cookie
  ├─ lib/            pure functions (slots, FHIR mapping, formatting)
  └─ db/             Drizzle schema + connection
        │
        ▼
PostgreSQL (Neon in production)  or  PGlite (embedded, dev/demo/tests)
```

## Layers and rules

- **`lib/`** is pure: no I/O, easy to unit test (slot generation, FHIR mapping, search-parameter parsing).
- **`server/`** holds business rules. Service functions take the database handle as their first argument, so tests run them against a real in-memory Postgres instead of mocks.
- **`app/`** is thin: it validates input with Zod, resolves the current user, calls `server/`, and maps results to UI or HTTP. Expected failures are `DomainError`s with user-safe messages; anything else is logged and returned as a generic error.

## Data model

| Table | Notes |
|---|---|
| `users` | Patients and admins (`role` enum) |
| `providers` | Clinicians, with `slot_minutes` (visit length) |
| `availability_rules` | Weekly hours: `weekday`, `start_minute`, `end_minute` in clinic-local minutes; check constraints keep them valid |
| `appointments` | `starts_at`/`ends_at` (`timestamptz`), `status` (`booked`/`cancelled`), `reason`, `cancelled_at` |

Key constraint:

```sql
CREATE UNIQUE INDEX appointments_provider_slot_booked_uq
  ON appointments (provider_id, starts_at)
  WHERE status = 'booked';
```

Cancelled rows stay for history, and the slot becomes bookable again because the index only covers booked rows.

## Booking flow

1. The schedule page expands the provider's weekly rules into slots for the requested week (`lib/slots.ts`) and marks slots that are past, beyond the 60-day horizon, or already booked.
2. `bookAction` validates input and calls `bookAppointment` inside a transaction, which:
   - re-checks that the time is in the future, within the horizon, and on the provider's slot grid
   - rejects the booking if the patient already has an overlapping appointment
   - inserts the row; a unique-violation (`23505`) becomes `SLOT_TAKEN`
3. Rescheduling cancels the old row and books the new slot in the same transaction, so any failure rolls both back.

## Time zones

All instants are stored as UTC `timestamptz`. Working hours are clinic-local minutes, expanded with `TZDate` from `@date-fns/tz` in `CLINIC_TIMEZONE`, so a 9:00 slot stays 9:00 across DST. Every rendered time goes through `formatInClinic` and shows the zone label.

## Embedded database

When `DATABASE_URL` is unset, `db/index.ts` starts PGlite (Postgres compiled to WebAssembly), applies the SQL migrations in `drizzle/`, and seeds demo data if the database is empty. It is file-backed in development (`.pglite/`) and in-memory on Vercel, during `next build`, and in end-to-end tests (`PGLITE_IN_MEMORY=1`). The connection promise is cached on `globalThis` so hot reloads reuse it.

## FHIR facade

`lib/fhir/resources.ts` maps rows to FHIR R4 `Appointment` and `Practitioner` resources. CareSlot only stores `booked` and `cancelled`; a booked appointment in the past is exposed as `fulfilled`. `server/fhir.ts` translates search parameters (including FHIR date prefixes with implicit day ranges) into SQL and scopes patients to their own records.

## AI intake helper

```
description ──► red-flag regexes ──match──► emergency advice (no model call)
                      │ no match
                      ▼
            ANTHROPIC_API_KEY set? ──no──► keyword rules
                      │ yes
                      ▼
      Claude, structured output: specialty ∈ clinic's specialties,
      rationale, urgency (routine / soon / emergency)
                      │ error, refusal, or unknown specialty
                      ▼
                keyword rules
```

The request uses low effort and server-side refusal fallback. Descriptions are never logged or stored. The server action is rate-limited per IP (in memory, best effort per instance).

## Testing strategy

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | slot math and DST, FHIR mapping and search parsing, intake rules, rate limiter |
| Integration | Vitest + PGlite | booking rules, concurrency, reschedule rollback, FHIR access control, on real Postgres |
| End-to-end | Playwright | browse, sign-in redirect, book/reschedule/cancel, admin access, intake helper, FHIR API; desktop and Pixel 7 |

CI runs all three on every pull request.
