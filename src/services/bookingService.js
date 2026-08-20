const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

async function createBooking({ userId, seatId, showId }) {
  try {
    const booking = await prisma.booking.create({
      data: { userId, seatId, showId },
      include: {
        user: { select: { id: true, name: true } },
        seat: { select: { id: true, number: true } },
        show: { select: { id: true, name: true, venue: true, date: true } }
      }
    });

    return { success: true, booking };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return {
        success: false,
        status: 409,
        message: 'Seat already booked for this show'
      };
    }

    throw err;
  }
}

module.exports = { createBooking, prisma };

