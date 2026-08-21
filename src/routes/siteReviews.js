const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

function formatReview(review) {
  return {
    id: Number(review.id),
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    user: {
      id: review.user?.id ?? null,
      name: review.user?.name || null,
      avatarUrl: review.user?.avatarUrl || null,
      state: review.user?.state || null,
      lga: review.user?.lga || null,
      zone: review.user?.zone?.name || null,
    },
  };
}

router.get('/', async (req, res) => {
  try {
    const reviews = await prisma.$queryRaw`
      SELECT r."id", r."rating", r."comment", r."createdAt",
             u."id" AS "userId", u."name" AS "userName", u."avatarUrl",
             u."state", u."lga", z."name" AS "zoneName"
      FROM "site_reviews" r
      JOIN "users" u ON u."id" = r."userId"
      LEFT JOIN "zones" z ON z."id" = u."zoneId"
      ORDER BY r."createdAt" DESC
    `;
    res.json({ reviews: reviews.map(formatReviewRow) });
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
      const reviews = await prisma.$queryRaw`
        INSERT INTO "site_reviews" ("userId", "rating", "comment", "createdAt", "updatedAt")
        VALUES (${req.user.id}, ${Number(rating)}, ${comment}, NOW(), NOW())
        ON CONFLICT ("userId") DO UPDATE SET
          "rating" = EXCLUDED."rating",
          "comment" = EXCLUDED."comment",
          "updatedAt" = NOW()
        RETURNING "id", "rating", "comment", "createdAt", "userId"
      `;
      const [review] = reviews;
      res.status(201).json({ review: formatReviewRow(review) });
    } catch (err) {
      console.error('[site reviews write]', err);
      res.status(500).json({ message: 'Failed to save review' });
    }
  }
);

function formatReviewRow(review) {
  return {
    id: Number(review.id),
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    user: {
      id: review.userId ?? null,
      name: review.userName || null,
      avatarUrl: review.avatarUrl || null,
      state: review.state || null,
      lga: review.lga || null,
      zone: review.zoneName || null,
    },
  };
}

module.exports = router;
