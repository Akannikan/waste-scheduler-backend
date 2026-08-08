require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const scheduleRoutes = require('./src/routes/schedules');
const categoryRoutes = require('./src/routes/categories');
const reportRoutes = require('./src/routes/reports');
const notificationRoutes = require('./src/routes/notifications');
const announcementRoutes = require('./src/routes/announcements');
const analyticsRoutes = require('./src/routes/analytics');
const guideRoutes = require('./src/routes/guide');
const centerRoutes = require('./src/routes/centers');
const zoneRoutes = require('./src/routes/zones');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ─────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS policy violation'));
  },
  credentials: true,
}));

// ── Rate limiting ────────────────────────────────────────────
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many requests, please try again later.' } }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/guide', guideRoutes);
app.use('/api/centers', centerRoutes);
app.use('/api/zones', zoneRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Waste Scheduler API is running', timestamp: new Date().toISOString() });
});

// ── 404 handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀  Waste Scheduler API running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
