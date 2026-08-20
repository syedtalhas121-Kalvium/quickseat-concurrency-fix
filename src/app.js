require('dotenv').config();

const express = require('express');
const bookingsRouter = require('./routes/bookings');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/bookings', bookingsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`QuickSeat API listening on port ${port}`);
  });
}

module.exports = app;

