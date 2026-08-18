require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
const billingRoutes = require('./src/routes/billing');
const aiRoutes = require('./src/routes/ai');
const quizRoutes = require('./src/routes/quiz');
const wasteLogRoutes = require('./src/routes/wasteLogs');
const collectionRecordRoutes = require('./src/routes/collectionRecords');
const assignmentRoutes = require('./src/routes/assignments');
const messageRoutes = require('./src/routes/messages');
const { startCronJobs } = require('./src/services/cron.service');
const passport = require('./src/config/passport');

const app = express();
const PORT = process.env.PORT || 5000;

async function ensureQuizData() {
  try {
    const quizCount = await prisma.quiz.count();
    if (quizCount > 0) return;

    console.log('[BOOTSTRAP] No quizzes found. Creating default quiz set...');

    await prisma.quiz.create({
      data: {
        title: 'Waste Sorting Basics',
        description: 'Test your knowledge of proper waste sorting and recycling in Nigeria',
        category: 'recycling',
        difficulty: 'easy',
        timeLimit: 60,
        points: 50,
        questions: {
          create: [
            { question: 'Which bin should you use for plastic water bottles?', options: ['Green Bin', 'Blue Bin', 'Brown Bin', 'Grey Bin'], correctAnswer: 1, explanation: 'Plastic bottles go in the Blue Bin for recycling.', points: 10 },
            { question: 'What should you do with sachet water bags (pure water nylons)?', options: ['Burn them', 'Throw on the street', 'Collect and put in Blue Bin', 'Pour in the gutter'], correctAnswer: 2, explanation: 'Sachet bags go in the Blue Bin. Littering them causes flooding in Lagos!', points: 10 },
            { question: 'Which waste type is collected in the Brown Bin?', options: ['Electronic waste', 'Glass bottles', 'Food scraps and garden waste', 'Metal cans'], correctAnswer: 2, explanation: 'Organic waste like food scraps goes in the Brown Bin for composting.', points: 10 },
            { question: 'Where should you take an old generator battery?', options: ['Brown Bin', 'Regular trash', 'Hazardous waste facility', 'Throw in the bush'], correctAnswer: 2, explanation: 'Generator batteries contain lead acid — extremely dangerous. Always take to a hazardous waste facility.', points: 10 },
            { question: 'Which of these is NOT recyclable in a regular bin?', options: ['Cardboard box', 'Glass jar', 'Used engine oil', 'Aluminium can'], correctAnswer: 2, explanation: 'Used engine oil is hazardous and must never go in regular bins. Take it to a collection point.', points: 10 },
          ],
        },
      },
    });

    await prisma.quiz.create({
      data: {
        title: 'Nigerian Environment & Recycling',
        description: 'Advanced quiz on environmental impact and recycling in Nigeria',
        category: 'environment',
        difficulty: 'medium',
        timeLimit: 90,
        points: 75,
        questions: {
          create: [
            { question: 'What does LAWMA stand for?', options: ['Lagos Area Waste Management Authority', 'Lagos Waste Management Authority', 'Lagos Area Waste Motor Authority', 'Lagos Automated Waste Management Agency'], correctAnswer: 1, explanation: 'LAWMA — Lagos Waste Management Authority — oversees waste collection in Lagos State.', points: 15 },
            { question: 'What is the main cause of flooding in Lagos during rainy season?', options: ['Too much rain only', 'Blocked drains from plastic waste', 'Lagos being below sea level', 'River overflow only'], correctAnswer: 1, explanation: 'Sachet bags and plastic waste clog drainage channels, causing flooding during heavy rains.', points: 15 },
            { question: 'How many years does a plastic bottle take to decompose?', options: ['10 years', '50 years', '450 years', '10,000 years'], correctAnswer: 2, explanation: 'A plastic bottle takes approximately 450 years to fully decompose in a landfill.', points: 15 },
            { question: 'What type of waste makes up the largest portion of Nigerian household waste?', options: ['Plastic', 'Organic/food waste', 'Paper', 'Metal'], correctAnswer: 1, explanation: 'Organic/food waste makes up over 50% of Nigerian household waste, making composting very impactful.', points: 15 },
            { question: 'Which PSP means in Nigerian waste management?', options: ['Private Sector Participation', 'Public Sanitation Program', 'Port Sanitation Partnership', 'Private Sanitation Personnel'], correctAnswer: 0, explanation: 'PSP (Private Sector Participation) refers to private waste collectors licensed to operate in Nigerian cities.', points: 15 },
          ],
        },
      },
    });

    console.log('[BOOTSTRAP] Default quiz data created successfully.');
  } catch (err) {
    console.error('[BOOTSTRAP] Failed to create default quiz data:', err.message);
  }
}

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
app.use(passport.initialize());

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
app.use('/api/billing', billingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/waste-logs', wasteLogRoutes);
app.use('/api/collection-records', collectionRecordRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/messages', messageRoutes);

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
    await ensureQuizData();
    app.listen(PORT, () => {
      console.log(`🚀  Waste Scheduler API running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      startCronJobs();
    });
  }

  startServer().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = app;
