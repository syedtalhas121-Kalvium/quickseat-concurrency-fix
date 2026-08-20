# QuickSeat — Concurrency-Safe Booking API

QuickSeat is a flash-sale seat booking API designed for high-contention booking windows. The implementation uses two complementary defenses: an IP-based rate limiter protects server resources from request floods, while a PostgreSQL composite unique constraint makes it impossible to store the same seat twice for one show.

## Defense Layers

| Layer | Implementation | Responsibility |
|---|---|---|
| Request protection | `src/middleware/rateLimiter.js` | Allows at most 10 booking attempts per IP per 60-second window and returns `429 Too Many Requests` after the limit. |
| Data integrity | `@@unique([seatId, showId])` in `prisma/schema.prisma` | Atomically rejects a competing insert for an already-booked seat and surfaces Prisma error `P2002`. |
| Conflict handling | `src/services/bookingService.js` | Converts the expected `P2002` constraint violation into a clear `409 Conflict` result and rethrows unexpected errors. |

The route no longer performs a `findFirst()` check before inserting. A check followed by an insert has a race window: two concurrent requests can both observe an available seat. The database constraint is the source of truth for ownership.

## Setup

Install dependencies and configure PostgreSQL:

```bash
npm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env`, then create and apply the migration:

```bash
npx prisma migrate dev --name add-booking-unique-constraint
node prisma/seed.js
```

Start the API with:

```bash
npm run dev
```

The default port is `3000` and can be changed through `PORT`.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns the service health status. |
| `POST` | `/api/bookings/book` | Books a seat for a show. |
| `GET` | `/api/bookings/show/:showId` | Lists all bookings for a show. |

A booking request has the following shape:

```json
{
  "userId": 1,
  "seatId": 1,
  "showId": 1
}
```

A successful booking returns `201 Created`. Booking the same `(seatId, showId)` again returns `409 Conflict`. Sending more than ten booking attempts from one IP in a minute returns `429 Too Many Requests`.

## Verification

The automated tests cover the limiter threshold and the service’s `P2002` mapping:

```bash
npm test
```

A real database verification can exercise the concurrent race with two requests sent together:

```bash
(curl -sS -o /tmp/a.json -w 'request-a: %{http_code}\n' \
  -X POST http://localhost:3000/api/bookings/book \
  -H 'Content-Type: application/json' \
  -d '{"userId":1,"seatId":2,"showId":1}' &
 curl -sS -o /tmp/b.json -w 'request-b: %{http_code}\n' \
  -X POST http://localhost:3000/api/bookings/book \
  -H 'Content-Type: application/json' \
  -d '{"userId":2,"seatId":2,"showId":1}' &
 wait)
```

For the same seat and show, the expected result is one `201` response and one `409` response. The database will contain exactly one booking for that seat.

## Submission Contents

The repository includes the repaired route, service, middleware, Prisma migration, concurrency explanation, automated tests, and application entry point. The feature branch for the submission is `fix/concurrency-and-rate-limit`.

