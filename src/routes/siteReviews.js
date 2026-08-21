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

function formatReview(review) {
  return {
    id: Number(review.id),
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    user: {
      id: review.userId ?? null,
      name: review.name || null,
      avatarUrl: review.avatarUrl || null,
      state: review.state || null,
      lga: review.lga || null,
      zone: review.zone || null,
    },
  };
}

router.get('/', async (req, res) => {
  try {
    await ensureReviewTable();
    const reviews = await prisma.$queryRawUnsafe(`
      SELECT sr."id", sr."userId", sr."rating", sr."comment", sr."createdAt",
             u."name", u."avatarUrl", u."state", u."lga", z."name" AS "zone"
      FROM "site_reviews" sr
      JOIN "users" u ON u."id" = sr."userId"
      LEFT JOIN "zones" z ON z."id" = u."zoneId"
      ORDER BY sr."createdAt" DESC
    `);

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

      const reviews = await prisma.$queryRawUnsafe(`
        INSERT INTO "site_reviews" ("userId", "rating", "comment", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId") DO UPDATE SET
          "rating" = EXCLUDED."rating",
          "comment" = EXCLUDED."comment",
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING "id", "userId", "rating", "comment", "createdAt"
      `, req.user.id, Number(rating), comment);
      const savedReview = await prisma.$queryRawUnsafe(`
        SELECT sr."id", sr."userId", sr."rating", sr."comment", sr."createdAt",
               u."name", u."avatarUrl", u."state", u."lga", z."name" AS "zone"
        FROM "site_reviews" sr
        JOIN "users" u ON u."id" = sr."userId"
        LEFT JOIN "zones" z ON z."id" = u."zoneId"
        WHERE sr."id" = $1
      `, reviews[0].id);
      const review = savedReview[0];

      res.status(201).json({ review: formatReview(review) });
    } catch (err) {
      console.error('[site reviews write]', err);
      res.status(500).json({ message: 'Failed to save review' });
    }
  }
);

module.exports = router;
