const express = require('express');
const { body, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/schedules ───────────────────────────────────────
router.get(
  '/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('zoneId').optional().isInt(),
    query('categoryId').optional().isInt(),
    query('status').optional().isIn(['scheduled', 'completed', 'missed', 'cancelled']),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const where = {};
      if (req.query.zoneId) where.zoneId = parseInt(req.query.zoneId);
      if (req.query.categoryId) where.categoryId = parseInt(req.query.categoryId);
      if (req.query.status) where.status = req.query.status;
      if (req.query.from || req.query.to) {
        where.pickupDate = {};
        if (req.query.from) where.pickupDate.gte = new Date(req.query.from);
        if (req.query.to) where.pickupDate.lte = new Date(req.query.to);
      }

      // Residents see only schedules for their zone
      if (req.user.role === 'resident' && req.user.zoneId) {
        where.zoneId = req.user.zoneId;
      }

      const [total, schedules] = await Promise.all([
        prisma.pickupSchedule.count({ where }),
        prisma.pickupSchedule.findMany({
          where,
          skip,
          take: limit,
          orderBy: { pickupDate: 'asc' },
          include: {
            zone: { select: { id: true, name: true, code: true } },
            category: { select: { id: true, name: true, slug: true, color: true, binColor: true } },
            truck: { select: { id: true, plateNumber: true } },
          },
        }),
      ]);

      res.json({ schedules, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
      console.error('[GET /schedules]', err);
      res.status(500).json({ message: 'Failed to fetch schedules' });
    }
  }
);

// ── GET /api/schedules/upcoming ──────────────────────────────
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const where = {
      pickupDate: { gte: new Date() },
      status: 'scheduled',
    };
    if (req.user.role === 'resident' && req.user.zoneId) {
      where.zoneId = req.user.zoneId;
    }

    const schedules = await prisma.pickupSchedule.findMany({
      where,
      take: 10,
      orderBy: { pickupDate: 'asc' },
      include: {
        zone: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true, slug: true, color: true, binColor: true, icon: true } },
      },
    });
    res.json({ schedules });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch upcoming schedules' });
  }
});

// ── GET /api/schedules/:id ───────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const schedule = await prisma.pickupSchedule.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        zone: true,
        category: true,
        truck: true,
        collectionRecord: true,
      },
    });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    res.json({ schedule });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch schedule' });
  }
});

// ── POST /api/schedules  (admin only) ────────────────────────
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('zoneId').isInt().withMessage('Zone is required'),
    body('categoryId').isInt().withMessage('Category is required'),
    body('pickupDate').isISO8601().withMessage('Valid pickup date is required'),
    body('recurrence').optional().isIn(['daily', 'weekly', 'biweekly', 'monthly']),
    body('truckId').optional().isInt(),
    body('collectorId').optional().isInt(),
    body('notes').optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const { title, zoneId, categoryId, pickupDate, recurrence, truckId, collectorId, notes } = req.body;
      const schedule = await prisma.pickupSchedule.create({
        data: {
          title,
          zoneId: Number(zoneId),
          categoryId: Number(categoryId),
          pickupDate: new Date(pickupDate),
          recurrence,
          truckId: truckId ? Number(truckId) : undefined,
          collectorId: collectorId ? Number(collectorId) : undefined,
          notes,
        },
        include: {
          zone: { select: { id: true, name: true, code: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
        },
      });
      res.status(201).json({ schedule });
    } catch (err) {
      console.error('[POST /schedules]', err);
      res.status(500).json({ message: 'Failed to create schedule' });
    }
  }
);

// ── PUT /api/schedules/:id  (admin only) ─────────────────────
router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'collector']),
  [
    body('title').optional().trim().notEmpty(),
    body('pickupDate').optional().isISO8601(),
    body('status').optional().isIn(['scheduled', 'completed', 'missed', 'cancelled']),
    body('notes').optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, pickupDate, status, notes, truckId, collectorId } = req.body;

      const schedule = await prisma.pickupSchedule.update({
        where: { id },
        data: {
          title,
          pickupDate: pickupDate ? new Date(pickupDate) : undefined,
          status,
          notes,
          truckId: truckId ? Number(truckId) : undefined,
          collectorId: collectorId ? Number(collectorId) : undefined,
        },
        include: {
          zone: { select: { id: true, name: true, code: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
        },
      });
      res.json({ schedule });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ message: 'Schedule not found' });
      res.status(500).json({ message: 'Failed to update schedule' });
    }
  }
);

// ── DELETE /api/schedules/:id  (admin only) ──────────────────
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await prisma.pickupSchedule.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Schedule not found' });
    res.status(500).json({ message: 'Failed to delete schedule' });
  }
});

// ── POST /api/schedules/:id/complete  (collector) ────────────
router.post('/:id/complete', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const { quantityKg, notes, proofImageUrl, truckId } = req.body;

    // Mark schedule as completed
    await prisma.pickupSchedule.update({ where: { id: scheduleId }, data: { status: 'completed' } });

    // Create collection record
    const record = await prisma.collectionRecord.create({
      data: {
        scheduleId,
        collectorId: req.user.id,
        quantityKg: quantityKg ? Number(quantityKg) : undefined,
        notes,
        proofImageUrl,
        truckId: truckId ? Number(truckId) : undefined,
        completedAt: new Date(),
      },
    });

    res.status(201).json({ record });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Schedule already has a collection record' });
    res.status(500).json({ message: 'Failed to record completion' });
  }
});

module.exports = router;
