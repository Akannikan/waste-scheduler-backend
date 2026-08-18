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
const siteReviewRoutes = require('./src/routes/siteReviews');
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

    console.log('[BOOTSTRAP] No quizzes found. Creating a richer default quiz set...');

    const quizTemplates = [
      {
        title: 'Waste Sorting Basics',
        description: 'Quick recycling checks for everyday waste sorting.',
        category: 'recycling',
        difficulty: 'easy',
        timeLimit: 60,
        points: 50,
        questions: [
          { question: 'Which bin should you use for plastic water bottles?', options: ['Green Bin', 'Blue Bin', 'Brown Bin', 'Grey Bin'], correctAnswer: 1, explanation: 'Plastic bottles go in the Blue Bin for recycling.', points: 10 },
          { question: 'What should you do with sachet water bags?', options: ['Burn them', 'Throw in the gutter', 'Collect and put in Blue Bin', 'Leave beside the road'], correctAnswer: 2, explanation: 'Sachet bags belong in the Blue Bin to prevent drainage blockages.', points: 10 },
          { question: 'Which waste type goes in the Brown Bin?', options: ['Food scraps and garden waste', 'Broken phones', 'Metal cans', 'Old newspapers'], correctAnswer: 0, explanation: 'Food scraps and garden waste are organic and should be composted.', points: 10 },
          { question: 'Which item should not be thrown in a regular waste bin?', options: ['Glass jar', 'Cardboard box', 'Used engine oil', 'Aluminium can'], correctAnswer: 2, explanation: 'Used engine oil is hazardous and should be taken to a proper collection point.', points: 15 },
          { question: 'A used battery should be taken to which place?', options: ['The nearest drain', 'The regular bin', 'A hazardous waste facility', 'Open field'], correctAnswer: 2, explanation: 'Old batteries are hazardous and must be disposed of safely.', points: 15 },
        ],
      },
      {
        title: 'Compost & Organic Waste',
        description: 'Learn how organic waste can become useful compost.',
        category: 'organic',
        difficulty: 'easy',
        timeLimit: 75,
        points: 60,
        questions: [
          { question: 'Which material is best for composting?', options: ['Plastic wrappers', 'Cooked meat', 'Fruit peels', 'Used batteries'], correctAnswer: 2, explanation: 'Fruit peels and food scraps are ideal for composting.', points: 10 },
          { question: 'What is the best practice for compost?', options: ['Mix dry and wet materials', 'Burn everything', 'Throw in drains', 'Keep under water'], correctAnswer: 0, explanation: 'A balance of dry and wet materials helps compost break down well.', points: 10 },
          { question: 'Which item should not be composted?', options: ['Vegetable peels', 'Leaves', 'Plastic bags', 'Coffee grounds'], correctAnswer: 2, explanation: 'Plastic does not decompose and contaminates the compost.', points: 10 },
          { question: 'Why is composting useful?', options: ['It creates fumes', 'It reduces landfill waste', 'It makes rubbish heavier', 'It attracts pests'], correctAnswer: 1, explanation: 'Composting reduces waste and turns organic matter into useful soil conditioner.', points: 15 },
          { question: 'What should you do with oily food waste?', options: ['Put in the brown bin', 'Mix it in compost', 'Avoid putting it in compost', 'Put it in the drain'], correctAnswer: 2, explanation: 'Oily foods can slow composting and create bad odour, so keep those out.', points: 15 },
          { question: 'Which is a good composting material?', options: ['Broken glass', 'Dry leaves', 'Used engine oil', 'Tin cans'], correctAnswer: 1, explanation: 'Dry leaves are a common brown compost ingredient.', points: 10 },
        ],
      },
      {
        title: 'E-Waste Safety',
        description: 'Know how to safely dispose of electronics and batteries.',
        category: 'e-waste',
        difficulty: 'medium',
        timeLimit: 90,
        points: 75,
        questions: [
          { question: 'What should you do before disposing of an old phone?', options: ['Keep the SIM card in place', 'Wipe personal data', 'Throw it in the drain', 'Put it in the brown bin'], correctAnswer: 1, explanation: 'Wiping personal data helps protect your privacy before e-waste disposal.', points: 15 },
          { question: 'Which item is electronic waste?', options: ['Cardboard box', 'Used laptop', 'Vegetable peel', 'Plastic bottle'], correctAnswer: 1, explanation: 'Old laptops and phones are part of e-waste.', points: 10 },
          { question: 'Why is e-waste dangerous to dump?', options: ['It smells nice', 'It contains harmful chemicals', 'It is light', 'It is safe in the soil'], correctAnswer: 1, explanation: 'E-waste can contain hazardous chemicals and metals.', points: 15 },
          { question: 'Where is the best place for old electronics?', options: ['Specialized e-waste drop-off', 'Street gutter', 'Blue bin', 'Burn pile'], correctAnswer: 0, explanation: 'Electronics should go to a designated e-waste collection center.', points: 15 },
          { question: 'Which item is most likely to be an e-waste product?', options: ['A kettle', 'A used tyre', 'A mobile phone', 'A newspaper'], correctAnswer: 2, explanation: 'A mobile phone is a classic example of electronic waste.', points: 10 },
          { question: 'Why separate batteries from e-waste?', options: ['They do not matter', 'They can be hazardous', 'They are compostable', 'They are safe to burn'], correctAnswer: 1, explanation: 'Batteries can be hazardous and should be handled separately.', points: 15 },
        ],
      },
      {
        title: 'Hazardous Waste Essentials',
        description: 'Protect your community by handling dangerous waste correctly.',
        category: 'hazardous',
        difficulty: 'hard',
        timeLimit: 90,
        points: 90,
        questions: [
          { question: 'Which item is hazardous waste?', options: ['Glass bottle', 'Plastic bottle', 'Used engine oil', 'Paper'], correctAnswer: 2, explanation: 'Used engine oil contains harmful chemicals and must be handled safely.', points: 15 },
          { question: 'What should you never do with chemicals?', options: ['Store them properly', 'Take them to a facility', 'Pour them down the drain', 'Keep them sealed'], correctAnswer: 2, explanation: 'Never pour hazardous chemicals down the drain or into the ground.', points: 15 },
          { question: 'Which of these might contain lead acid?', options: ['Generator battery', 'Plastic wrapper', 'Paper bag', 'Fruit peel'], correctAnswer: 0, explanation: 'Generator batteries often contain lead acid and require special disposal.', points: 15 },
          { question: 'Why is hazardous waste not safe in a regular waste bin?', options: ['It is too light', 'It can contaminate waste streams', 'It smells good', 'It is recyclable'], correctAnswer: 1, explanation: 'Hazardous waste can contaminate the environment and harm people.', points: 15 },
          { question: 'The safest action with paint leftovers is to?', options: ['Pour into a drain', 'Leave them in the sun', 'Take them to a hazardous collection point', 'Burn them in the yard'], correctAnswer: 2, explanation: 'Paints and solvents should be collected professionally for safe disposal.', points: 15 },
          { question: 'Which statement is correct?', options: ['All waste can be poured away', 'Hazardous waste is safe in normal bins', 'Hazardous waste needs special handling', 'Batteries are harmless'], correctAnswer: 2, explanation: 'Hazardous waste requires special handling to protect people and the environment.', points: 15 },
        ],
      },
      {
        title: 'Community Cleanliness',
        description: 'Squares of environmental responsibility for daily living.',
        category: 'community',
        difficulty: 'medium',
        timeLimit: 75,
        points: 70,
        questions: [
          { question: 'Why is littering harmful?', options: ['It collects dust', 'It blocks drains and pollutes the environment', 'It is a way to recycle', 'It reduces traffic'], correctAnswer: 1, explanation: 'Litter can clog drains and damage public health and ecosystems.', points: 10 },
          { question: 'What helps the environment most?', options: ['Burning waste', 'Reducing waste and recycling properly', 'Dumping in empty lots', 'Leaving waste in the street'], correctAnswer: 1, explanation: 'Reducing waste and sorting correctly keeps the environment cleaner.', points: 15 },
          { question: 'Which action is a good community practice?', options: ['Throwing waste in drainage channels', 'Separating recyclable waste', 'Leaving old tyres on the street', 'Burning plastic wrappers'], correctAnswer: 1, explanation: 'Separating recyclable waste supports cleaner communities and easier collection.', points: 15 },
          { question: 'What is a common result of blocked drains?', options: ['Higher rainfall', 'Flooding', 'More trees', 'Better roads'], correctAnswer: 1, explanation: 'Blocked drains often lead to flooding during heavy rains.', points: 10 },
          { question: 'What is the best way to reduce waste?', options: ['Use items more than once', 'Throw them away immediately', 'Burn them often', 'Create more litter'], correctAnswer: 0, explanation: 'Reusing items and proper sorting lower the amount of waste entering landfills.', points: 15 },
        ],
      },
    ];

    for (const template of quizTemplates) {
      await prisma.quiz.create({
        data: {
          ...template,
          questions: {
            create: template.questions.map((q) => ({
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              points: q.points,
            })),
          },
        },
      });
    }

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
app.use('/api/site-reviews', siteReviewRoutes);
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
