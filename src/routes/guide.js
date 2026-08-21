const express = require('express');
const { query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/guide  (search waste guide items) ───────────────
router.get(
  '/',
  [query('q').optional().isString().trim()],
  validate,
  async (req, res) => {
    try {
      const search = req.query.q;
      const where = {};

      if (search) {
        where.OR = [
          { itemName: { contains: search, mode: 'insensitive' } },
          { categorySlug: { contains: search, mode: 'insensitive' } },
          { disposalMethod: { contains: search, mode: 'insensitive' } },
        ];
      }

      const items = await prisma.wasteGuideItem.findMany({
        where,
        orderBy: { itemName: 'asc' },
        take: 50,
      });

      const uniqueItems = items.filter((item, index, allItems) => (
        allItems.findIndex((candidate) => candidate.itemName.toLowerCase() === item.itemName.toLowerCase()) === index
      ));

      res.json({ items: uniqueItems });
    } catch (err) {
      res.status(500).json({ message: 'Failed to search waste guide' });
    }
  }
);

module.exports = router;
