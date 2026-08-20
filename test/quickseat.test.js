const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const express = require('express');
const { Prisma } = require('@prisma/client');
const { bookingLimiter } = require('../src/middleware/rateLimiter');
const bookingService = require('../src/services/bookingService');

function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

test('booking limiter permits ten attempts and rejects the eleventh', async () => {
  const app = express();
  app.post('/book', bookingLimiter, (_req, res) => res.status(201).json({ ok: true }));
  const server = await startServer(app);

  try {
    const address = server.address();
    const responses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(await fetch(`http://127.0.0.1:${address.port}/book`, { method: 'POST' }));
    }

    assert.deepEqual(responses.slice(0, 10).map((response) => response.status), Array(10).fill(201));
    assert.equal(responses[10].status, 429);
  } finally {
    await stopServer(server);
  }
});

test('P2002 is returned as a 409 conflict result', async () => {
  const originalCreate = bookingService.prisma.booking.create;
  bookingService.prisma.booking.create = async () => {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
      meta: { target: ['seatId', 'showId'] }
    });
  };

  try {
    const result = await bookingService.createBooking({ userId: 1, seatId: 1, showId: 1 });
    assert.deepEqual(result, {
      success: false,
      status: 409,
      message: 'Seat already booked for this show'
    });
  } finally {
    bookingService.prisma.booking.create = originalCreate;
    await bookingService.prisma.$disconnect();
  }
});
