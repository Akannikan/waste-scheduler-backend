require('dotenv').config();
const express = require('express');
const path = require('path');
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
const paymentRoutes = require('./src/routes/payments');
const revenueRoutes = require('./src/routes/revenue');
const collectorRoutes = require('./src/routes/collector');
const subscriptionRoutes = require('./src/routes/subscriptions');
const businessRoutes = require('./src/routes/business');
const recyclingRoutes = require('./src/routes/recycling');
const { startCronJobs } = require('./src/services/cron.service');
const passport = require('./src/config/passport');
const { ensurePlatformSettings } = require('./src/services/payment.service');

const app = express();
const PORT = process.env.PORT || 5000;

async function ensureAdditionalQuizQuestions() {
  const additions = {
    'Waste Sorting Basics': [
      { question: 'Which material is usually recyclable when clean and dry?', options: ['Cardboard', 'Food scraps', 'Used tissue', 'Wet soil'], correctAnswer: 0, explanation: 'Clean, dry cardboard can usually be sorted for recycling.', points: 10 },
      { question: 'Why should recyclable containers be rinsed?', options: ['To make them heavier', 'To reduce contamination', 'To change their colour', 'To make them compostable'], correctAnswer: 1, explanation: 'Rinsing removes leftover food and drink that can contaminate recyclable materials.', points: 10 },
      { question: 'Which action best reduces single-use plastic waste?', options: ['Use a refillable bottle', 'Burn plastic bags', 'Throw plastic in drains', 'Buy more wrappers'], correctAnswer: 0, explanation: 'Refillable items reduce the amount of single-use plastic entering the waste stream.', points: 10 },
    ],
    'Compost & Organic Waste': [
      { question: 'What does finished compost look and smell like?', options: ['Dark and earthy', 'Bright blue and sweet', 'Oily and sticky', 'Clear and watery'], correctAnswer: 0, explanation: 'Mature compost is dark, crumbly, and has an earthy smell.', points: 10 },
      { question: 'Why should a compost pile have airflow?', options: ['It supports aerobic decomposition', 'It freezes the pile', 'It prevents all moisture', 'It makes plastic disappear'], correctAnswer: 0, explanation: 'Air helps beneficial organisms break organic material down without strong odours.', points: 15 },
      { question: 'Which item is a good green compost ingredient?', options: ['Fresh grass clippings', 'Glass shards', 'Aluminium foil', 'Synthetic fabric'], correctAnswer: 0, explanation: 'Fresh grass clippings are nitrogen-rich green material for composting.', points: 10 },
    ],
    'E-Waste Safety': [
      { question: 'What should be done with a swollen phone battery?', options: ['Puncture it', 'Place it in a fire', 'Handle it carefully and use a specialist drop-off', 'Put it in compost'], correctAnswer: 2, explanation: 'Swollen batteries can be dangerous and need specialist handling.', points: 15 },
      { question: 'Which part of an old computer may contain recoverable materials?', options: ['Circuit board', 'Banana peel', 'Garden soil', 'Cotton cloth'], correctAnswer: 0, explanation: 'Circuit boards contain materials that specialist recyclers can recover.', points: 15 },
      { question: 'Why should electronics not be burned?', options: ['They release toxic fumes', 'They become compost', 'They improve soil', 'They produce clean water'], correctAnswer: 0, explanation: 'Burning electronics can release toxic chemicals and heavy metals.', points: 15 },
    ],
    'Hazardous Waste Essentials': [
      { question: 'How should household chemicals be stored before collection?', options: ['In labelled, sealed containers', 'In an open bowl', 'Mixed together', 'In a food bottle'], correctAnswer: 0, explanation: 'Sealed, labelled containers reduce leaks and accidental exposure.', points: 15 },
      { question: 'What is the safest response to a chemical spill?', options: ['Touch it with bare hands', 'Keep people away and contact the proper service', 'Wash it into a drain', 'Cover it with food'], correctAnswer: 1, explanation: 'Keep people away and get trained help for hazardous spills.', points: 15 },
      { question: 'Which item should be kept away from children until collection?', options: ['Cleaning chemicals', 'Empty paper', 'Clean cardboard', 'Dry leaves'], correctAnswer: 0, explanation: 'Cleaning chemicals can cause poisoning or burns.', points: 15 },
      { question: 'Why should incompatible chemicals never be mixed?', options: ['They may react and release heat or toxic gas', 'They become recyclable', 'They become harmless water', 'They improve compost'], correctAnswer: 0, explanation: 'Some chemicals react dangerously when combined, producing heat, fire, or toxic gases.', points: 20 },
      { question: 'What information helps a hazardous waste collector handle a container safely?', options: ['A clear label and known contents', 'A decorative colour only', 'The owner’s favourite brand', 'The weather forecast'], correctAnswer: 0, explanation: 'Clear identification helps workers choose safe handling, transport, and treatment procedures.', points: 20 },
      { question: 'Why should used oil be kept out of soil and waterways?', options: ['It can persist and harm ecosystems', 'It is a natural fertiliser', 'It evaporates harmlessly', 'It improves drinking water'], correctAnswer: 0, explanation: 'Oil can contaminate soil and water and damage plants and aquatic life.', points: 20 },
    ],
    'Community Cleanliness': [
      { question: 'What is a useful way to organise a community cleanup?', options: ['Plan zones and provide gloves and bags', 'Work without any plan', 'Dump collected waste nearby', 'Burn everything afterwards'], correctAnswer: 0, explanation: 'Planning zones and providing supplies makes cleanups safer and more effective.', points: 10 },
      { question: 'Why are public bins useful?', options: ['They support proper disposal', 'They create litter', 'They block every drain', 'They replace recycling education'], correctAnswer: 0, explanation: 'Accessible bins make it easier for people to dispose of waste correctly.', points: 10 },
      { question: 'Which habit helps prevent blocked drains?', options: ['Keep litter out of drainage channels', 'Sweep waste into gutters', 'Pour oil into drains', 'Leave bags beside waterways'], correctAnswer: 0, explanation: 'Keeping solid waste and oil out of drains helps reduce blockages and flooding.', points: 15 },
    ],
  };

  for (const [title, questions] of Object.entries(additions)) {
    const quiz = await prisma.quiz.findFirst({ where: { title } });
    if (!quiz) continue;
    const existing = await prisma.quizQuestion.findMany({ where: { quizId: quiz.id }, select: { question: true } });
    const existingTexts = new Set(existing.map(item => item.question));
    for (const question of questions) {
      if (!existingTexts.has(question.question)) await prisma.quizQuestion.create({ data: { ...question, quizId: quiz.id } });
    }
  }

  const higherLevelQuizzes = [
    {
      title: 'Advanced Circular Economy', category: 'environment', difficulty: 'advanced', timeLimit: 75, points: 120,
      description: 'Apply systems thinking to waste reduction, recovery, and circular design.',
      questions: [
        { question: 'In a circular economy, a product is designed primarily to be?', options: ['Used once and discarded', 'Kept in use and recovered at end of life', 'Burned immediately', 'Buried without sorting'], correctAnswer: 1, explanation: 'Circular systems keep products and materials useful for as long as possible.', points: 20 },
        { question: 'What is extended producer responsibility?', options: ['Consumers sort every material', 'Producers help manage products after use', 'Collectors set all prices', 'Landfills accept unlimited waste'], correctAnswer: 1, explanation: 'Extended producer responsibility gives producers responsibility for post-consumer impacts.', points: 20 },
        { question: 'Which option is highest in the waste hierarchy?', options: ['Prevention', 'Landfill', 'Open burning', 'Littering'], correctAnswer: 0, explanation: 'Preventing waste is preferred over reuse, recycling, recovery, or disposal.', points: 20 },
        { question: 'Why is material contamination a major recycling problem?', options: ['It improves quality', 'It can make an entire batch unsuitable', 'It increases compost nutrients', 'It makes sorting unnecessary'], correctAnswer: 1, explanation: 'Contamination can reduce material quality and cause a recovered batch to be rejected.', points: 20 },
        { question: 'Which metric best measures landfill diversion?', options: ['Waste sent to landfill compared with total waste generated', 'Number of collection trucks only', 'Rainfall each month', 'Number of street signs'], correctAnswer: 0, explanation: 'Diversion measures how much waste is kept away from landfill through prevention, reuse, recycling, or recovery.', points: 20 },
        { question: 'Why are local reuse networks valuable?', options: ['They extend product life and reduce new material demand', 'They require more dumping', 'They prevent repairs', 'They only increase packaging'], correctAnswer: 0, explanation: 'Reuse keeps items in service and avoids the impacts of making replacements.', points: 20 },
      ],
    },
    {
      title: 'Expert Waste Strategy', category: 'policy', difficulty: 'expert', timeLimit: 90, points: 160,
      description: 'Challenge yourself with advanced waste policy, data, and operational decisions.',
      questions: [
        { question: 'What does source separation achieve?', options: ['It mixes all materials', 'It keeps material streams cleaner from the start', 'It removes the need for collection', 'It turns hazardous waste into food'], correctAnswer: 1, explanation: 'Separating materials where they are produced improves recovery quality and safety.', points: 25 },
        { question: 'Which approach is most useful when planning collection routes?', options: ['Ignore demand patterns', 'Use route, volume, and service data', 'Visit every street randomly', 'Collect only when bins overflow'], correctAnswer: 1, explanation: 'Operational data supports efficient routes and reliable service levels.', points: 25 },
        { question: 'Why should hazardous waste be tracked separately?', options: ['It has different risks and treatment requirements', 'It is always harmless', 'It is easier to burn', 'It belongs with food scraps'], correctAnswer: 0, explanation: 'Hazardous materials need controlled handling, transport, treatment, and documentation.', points: 25 },
        { question: 'What is a life-cycle assessment used to examine?', options: ['Only a product logo', 'Environmental impacts across a product life cycle', 'Only bin colour', 'A collector attendance sheet'], correctAnswer: 1, explanation: 'Life-cycle assessment considers impacts from raw materials through use and end of life.', points: 25 },
        { question: 'Which policy best supports waste prevention?', options: ['Pay-as-you-throw with reuse support', 'Unlimited free dumping', 'Open burning incentives', 'Removing repair options'], correctAnswer: 0, explanation: 'Pricing linked to residual waste can encourage prevention when paired with accessible reuse and recycling.', points: 25 },
        { question: 'What is the strongest reason to publish waste performance data?', options: ['It enables accountability and better decisions', 'It hides service gaps', 'It makes sorting impossible', 'It replaces all field work'], correctAnswer: 0, explanation: 'Transparent data helps communities and operators identify gaps and measure improvement.', points: 25 },
      ],
    },
  ];

  for (const template of higherLevelQuizzes) {
    const quiz = await prisma.quiz.findFirst({ where: { title: template.title } });
    if (quiz) continue;
    await prisma.quiz.create({
      data: {
        title: template.title,
        description: template.description,
        category: template.category,
        difficulty: template.difficulty,
        timeLimit: template.timeLimit,
        points: template.points,
        questions: { create: template.questions },
      },
    });
  }
}

async function ensureQuizData() {
  try {
    const quizCount = await prisma.quiz.count();
    if (quizCount > 0) {
      await ensureAdditionalQuizQuestions();
      return;
    }

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
    await ensureAdditionalQuizQuestions();
  } catch (err) {
    console.error('[BOOTSTRAP] Failed to create default quiz data:', err.message);
  }
}

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
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', revenueRoutes);
app.use('/api/collector', collectorRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/recycling', recyclingRoutes);

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
    await ensureQuizData();
    await ensurePlatformSettings(prisma);
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
