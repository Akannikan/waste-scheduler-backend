require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── MVP Route Imports ──────────────────────────────────────
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const zoneRoutes = require('./src/routes/zones');
const categoriesRoutes = require('./src/routes/categories');
const billingRoutes = require('./src/routes/billing');
const aiRoutes = require('./src/routes/ai');
const siteReviewRoutes = require('./src/routes/siteReviews');
const wasteLogRoutes = require('./src/routes/wasteLogs');
const recyclingRoutes = require('./src/routes/recycling');

const { startCronJobs } = require('./src/services/cron.service');
const passport = require('./src/config/passport');
const { ensurePlatformSettings } = require('./src/services/payment.service');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ─────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────────
const allowedOrigins = [
  ...(process.env.CLIENT_URL || '').split(','),
  'http://localhost:5173',
  'https://waste-scheduler-frontend-alpha.vercel.app',
].map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    const normalizedOrigin = origin?.replace(/\/$/, '');
    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(passport.initialize());

// ── Routes ───────────────────────────────────────────────────
// MVP Features: Auth, Users, Zones, Billing, AI Chat, Reviews, Waste Logs, Recycling Centers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/site-reviews', siteReviewRoutes);
app.use('/api/waste-logs', wasteLogRoutes);
app.use('/api/recycling', recyclingRoutes);

// ── Non-MVP Routes Removed for MVP ──────────────────────────
// Removed: schedules, categories, reports, notifications, announcements,
// analytics, guide, centers (admin), quiz, collection-records, assignments,
// messages, payments (separate from billing), admin/revenue, collector role,
// subscriptions, business role

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
  async function startServer() {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.log('[DATABASE] PostgreSQL connection established');
    } catch (err) {
      console.error('[DATABASE] Unable to connect to PostgreSQL. Check DATABASE_URL in Render:', err.message);
      throw err;
    }

    // Quiz system removed for MVP
    // Restore from git if needed: git show HEAD~1:backend/server.js | grep -A500 "async function ensureQuizData"

    await ensurePlatformSettings(prisma);

    app.listen(PORT, () => {
      console.log(`🚀 Waste Scheduler MVP API running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log(`   Features: Authentication, Users, Zones, Billing, AI Chat, Reviews, Waste Logs, Recycling`);
      startCronJobs();
    });
  }

  startServer().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = app;
