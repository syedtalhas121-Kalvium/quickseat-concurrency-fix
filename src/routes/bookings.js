const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bookingService = require('../services/bookingService');
const { bookingLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/bookings/book
// The database unique constraint is the source of truth for seat ownership.
// The limiter protects the endpoint from request floods before the handler runs.
router.post('/book', bookingLimiter, async (req, res, next) => {
  try {
    const { userId, seatId, showId } = req.body;

    if (!userId || !seatId || !showId) {
      return res.status(400).json({
        message: 'userId, seatId, and showId are required'
      });
    }

    const result = await bookingService.createBooking({
      userId: Number(userId),
      seatId: Number(seatId),
      showId: Number(showId)
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.booking);
  } catch (err) {
    return next(err);
  }
});

// GET /api/bookings/show/:showId
// Returns all bookings for a show — useful for verifying concurrency behavior.
router.get('/show/:showId', async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { showId: Number(req.params.showId) },
      include: {
        user: { select: { id: true, name: true } },
        seat: { select: { id: true, number: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.status(200).json({
      total: bookings.length,
      bookings
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

