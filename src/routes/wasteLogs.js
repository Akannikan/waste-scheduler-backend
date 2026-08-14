const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/waste-logs/my ───────────────────────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const logs = await prisma.wasteLog.findMany({
      where: { userId: req.user.id },
      orderBy: { loggedAt: 'desc' },
      take: 100,
      include: {
        category: { select: { id: true, name: true, slug: true, color: true, binColor: true } },
      },
    });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch waste logs' });
  }
});

// ── GET /api/waste-logs  (admin — all logs) ──────────────────
router.get('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.wasteLog.count(),
      prisma.wasteLog.findMany({
        skip, take: limit,
        orderBy: { loggedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true, color: true, binColor: true } },
        },
      }),
    ]);
    res.json({ logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

// ── POST /api/waste-logs ─────────────────────────────────────
router.post(
  '/',
  authenticate,
  [
    body('categoryId').isInt().withMessage('Category is required'),
    body('quantityKg').isFloat({ min: 0.1, max: 10000 }).withMessage('Valid weight is required'),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { categoryId, quantityKg, notes } = req.body;

      const log = await prisma.wasteLog.create({
        data: {
          userId: req.user.id,
          categoryId: Number(categoryId),
          quantityKg: Number(quantityKg),
          notes,
          loggedAt: new Date(),
        },
        include: {
          category: { select: { id: true, name: true, slug: true, color: true, binColor: true } },
        },
      });

      res.status(201).json({ log });
    } catch (err) {
      console.error('[POST /waste-logs]', err);
      res.status(500).json({ message: 'Failed to create waste log' });
    }
  }
);

// ── DELETE /api/waste-logs/:id ───────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const log = await prisma.wasteLog.findUnique({ where: { id } });
    if (!log) return res.status(404).json({ message: 'Log not found' });

    if (req.user.role !== 'admin' && log.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prisma.wasteLog.delete({ where: { id } });
    res.json({ message: 'Log deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete log' });
  }
});

module.exports = router;
