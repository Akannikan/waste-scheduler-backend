const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/collection-records/my  (collector's own records) ─
router.get('/my', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const where = req.user.role === 'admin' ? {} : { collectorId: req.user.id };

    const records = await prisma.collectionRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { completedAt: 'desc' },
      include: {
        schedule: {
          include: {
            zone: { select: { id: true, name: true, code: true } },
            category: { select: { id: true, name: true, slug: true, color: true, binColor: true } },
          },
        },
        truck: { select: { id: true, plateNumber: true, model: true } },
      },
    });

    res.json({ records });
  } catch (err) {
    console.error('[collection-records/my]', err);
    res.status(500).json({ message: 'Failed to fetch collection records' });
  }
});

// ── GET /api/collection-records  (admin) ─────────────────────
router.get('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      prisma.collectionRecord.count(),
      prisma.collectionRecord.findMany({
        skip, take: limit,
        orderBy: { completedAt: 'desc' },
        include: {
          collector: { select: { id: true, name: true, email: true } },
          schedule: {
            include: {
              zone: { select: { id: true, name: true } },
              category: { select: { id: true, name: true, color: true } },
            },
          },
          truck: { select: { id: true, plateNumber: true } },
        },
      }),
    ]);

    res.json({ records, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch records' });
  }
});

module.exports = router;
