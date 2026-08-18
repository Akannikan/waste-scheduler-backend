const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

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
    const reviews = await prisma.siteReview.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true, state: true, lga: true, zone: { select: { name: true } } } } },
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

      const review = await prisma.siteReview.upsert({
        where: { userId: req.user.id },
        update: { rating, comment },
        create: { userId: req.user.id, rating, comment },
        include: { user: { select: { id: true, name: true, avatarUrl: true, state: true, lga: true, zone: { select: { name: true } } } } },
      });

      res.status(201).json({ review: formatReview(review) });
    } catch (err) {
      console.error('[site reviews write]', err);
      res.status(500).json({ message: 'Failed to save review' });
    }
  }
);

module.exports = router;
