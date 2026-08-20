const { rateLimit } = require('express-rate-limit');

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many booking attempts from this IP. Please try again in a minute.'
  }
});

module.exports = { bookingLimiter };

