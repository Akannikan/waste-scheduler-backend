const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

async function ensureReviewTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "site_reviews" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL UNIQUE,
      "rating" INTEGER NOT NULL DEFAULT 5,
      "comment" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "site_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
}

const reviewUserSelect = { id: true, name: true, avatarUrl: true, state: true, lga: true };

function formatReview(review) {
  const user = review.user;
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    user: {
      id: user?.id ?? null,
      name: user?.name || 'Community member',
      avatarUrl: user?.avatarUrl || null,
      state: user?.state || null,
      lga: user?.lga || null,
      zone: user?.zone?.name || null,
    },
  };
}

router.get('/', async (req, res) => {
  try {
    await ensureReviewTable();
    const reviews = await prisma.siteReview.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: reviewUserSelect } },
    });

    res.json({ reviews: reviews.map(formatReview) });
  } catch (err) {
    console.error('[site reviews read]', err);
    res.status(500).json({ message: 'Failed to fetch site reviews' });
  }
});

router.post(
  '/',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').trim().isLength({ min: 3, max: 500 }).withMessage('Comment must be between 3 and 500 characters'),
  ],
  validate,
  async (req, res) => {
    try {
      const { rating, comment } = req.body;
      await ensureReviewTable();

      const existingReview = await prisma.siteReview.findFirst({ where: { userId: req.user.id } });
      const review = existingReview
        ? await prisma.siteReview.update({
            where: { id: existingReview.id },
            data: { rating: Number(rating), comment },
            include: { user: { select: reviewUserSelect } },
          })
        : await prisma.siteReview.create({
            data: { userId: req.user.id, rating: Number(rating), comment },
            include: { user: { select: reviewUserSelect } },
          });

      res.status(201).json({ review: formatReview(review) });
    } catch (err) {
      console.error('[site reviews write]', err);
      res.status(500).json({ message: 'Failed to save review' });
    }
  }
);

module.exports = router;
