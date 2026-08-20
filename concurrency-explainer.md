# Concurrency Explainer
**Author:** Syed Talha
**Date:** 2026-08-20

---

## The Root Cause — Why Check-Then-Insert Fails

The original endpoint used two separate database operations: `findFirst()` checked whether a `(seatId, showId)` pair already existed, and `create()` inserted a booking only when the check returned no row. This looks safe when requests arrive one after another, but it is not one indivisible operation. The time between the read and the write is a race window.

Suppose two fans request the same seat at nearly the same instant. Request A checks and sees no booking. Before A inserts, request B performs the same check and also sees no booking because A’s write has not happened yet. Both requests have now passed the application-level guard, so both execute `create()` and both can receive `201 Created`. The resulting data violates the business rule even though each individual statement succeeded. This is a race condition: the result depends on the unpredictable ordering of concurrent operations.

---

## Why the Unique Constraint Fixes It

`@@unique([seatId, showId])` moves the invariant to the database, where it is enforced as part of the write operation. The database indexes the composite key and permits only one row for a given seat and show. If concurrent transactions attempt the same insert, one succeeds and the other is rejected by the constraint. Application code can still validate request shape, but it cannot reliably reserve a shared resource by reading first; only the database can arbitrate competing writes atomically. Removing `findFirst()` also eliminates an unnecessary query and removes the false impression that the check protects the booking.

---

## Why Rate Limiting Alone Is Not Enough

The rate limiter is a traffic-control layer, not a uniqueness mechanism. It allows at most ten booking attempts per IP during a one-minute window, protecting server resources from a single client or bot sending a flood. However, two different users can each send one request, remain well below the limit, and still reach the booking code at the same time. Without the database constraint, both requests can pass the old check-then-insert sequence and create duplicate rows. Therefore, rate limiting reduces volume but cannot close the concurrency race.

---

## What P2002 Means and Why 409

Prisma error `P2002` indicates that a write violated a unique constraint. In this API, it means another request won the race to reserve that seat for the show. The request was syntactically valid, so `400 Bad Request` would be misleading; the server also worked correctly, so `500 Internal Server Error` would falsely suggest an unexpected failure. `409 Conflict` accurately tells the client that the requested state conflicts with the resource’s current state. The service catches only this expected Prisma error and returns a clear conflict result, while rethrowing unrelated errors so the global error handler can report genuine server failures.

---

**Total word count:** 465

