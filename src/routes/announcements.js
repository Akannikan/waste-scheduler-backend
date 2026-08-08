const express = require('express');
const { body, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/announcements ───────────────────────────────────
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('audience').optional().isIn(['all', 'residents', 'collectors', 'admins']),
  ],
  validate,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const where = { isActive: true };
      if (req.query.audience) where.audience = req.query.audience;

      const [total, announcements] = await Promise.all([
        prisma.announcement.count({ where }),
        prisma.announcement.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      res.json({ announcements, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch announcements' });
    }
  }
);

// ── GET /api/announcements/:id ───────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const announcement = await prisma.announcement.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });
    res.json({ announcement });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch announcement' });
  }
});

// ── POST /api/announcements  (admin) ─────────────────────────
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('audience').optional().isIn(['all', 'residents', 'collectors', 'admins']),
    body('imageUrl').optional().isURL(),
  ],
  validate,
  async (req, res) => {
    try {
      const { title, message, audience, imageUrl } = req.body;
      const announcement = await prisma.announcement.create({
        data: { title, message, audience: audience || 'all', imageUrl },
      });
      res.status(201).json({ announcement });
    } catch (err) {
      res.status(500).json({ message: 'Failed to create announcement' });
    }
  }
);

// ── PUT /api/announcements/:id  (admin) ──────────────────────
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  [
    body('title').optional().trim().notEmpty(),
    body('message').optional().trim().notEmpty(),
    body('audience').optional().isIn(['all', 'residents', 'collectors', 'admins']),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, message, audience, isActive, imageUrl } = req.body;
      const announcement = await prisma.announcement.update({
        where: { id },
        data: { title, message, audience, isActive, imageUrl },
      });
      res.json({ announcement });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ message: 'Announcement not found' });
      res.status(500).json({ message: 'Failed to update announcement' });
    }
  }
);

// ── DELETE /api/announcements/:id  (admin) ───────────────────
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await prisma.announcement.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Announcement not found' });
    res.status(500).json({ message: 'Failed to delete announcement' });
  }
});

module.exports = router;
