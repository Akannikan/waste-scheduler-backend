const express = require('express');
const { body, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/reports ─────────────────────────────────────────
router.get(
  '/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'under_review', 'resolved', 'rejected']),
    query('type').optional().isIn(['missed_pickup', 'illegal_dumping', 'damaged_bin', 'other']),
  ],
  validate,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const where = {};
      if (req.query.status) where.status = req.query.status;
      if (req.query.type) where.type = req.query.type;

      // Residents see only their own reports
      if (req.user.role === 'resident') {
        where.reporterId = req.user.id;
      }

      const [total, reports] = await Promise.all([
        prisma.report.count({ where }),
        prisma.report.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            reporter: { select: { id: true, name: true, email: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        }),
      ]);

      res.json({ reports, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
      console.error('[GET /reports]', err);
      res.status(500).json({ message: 'Failed to fetch reports' });
    }
  }
);

// ── GET /api/reports/:id ─────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
    if (!report) return res.status(404).json({ message: 'Report not found' });

    // Residents can only view their own reports
    if (req.user.role === 'resident' && report.reporterId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ report });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch report' });
  }
});

// ── POST /api/reports ────────────────────────────────────────
router.post(
  '/',
  authenticate,
  [
    body('type').isIn(['missed_pickup', 'illegal_dumping', 'damaged_bin', 'other']).withMessage('Invalid report type'),
    body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 1000 }),
    body('imageUrl').optional().isURL().withMessage('Invalid image URL'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('address').optional().isString().isLength({ max: 255 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { type, description, imageUrl, latitude, longitude, address } = req.body;
      const report = await prisma.report.create({
        data: {
          reporterId: req.user.id,
          type,
          description,
          imageUrl,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          address,
        },
        include: {
          reporter: { select: { id: true, name: true, email: true } },
        },
      });
      res.status(201).json({ report });
    } catch (err) {
      console.error('[POST /reports]', err);
      res.status(500).json({ message: 'Failed to create report' });
    }
  }
);

// ── PUT /api/reports/:id  (admin: update status/assign; resident: update own pending report) ──
router.put(
  '/:id',
  authenticate,
  [
    body('status').optional().isIn(['pending', 'under_review', 'resolved', 'rejected']),
    body('adminNotes').optional().isString().isLength({ max: 1000 }),
    body('assignedToId').optional().isInt(),
    body('description').optional().isString().isLength({ max: 1000 }),
  ],
  validate,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await prisma.report.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ message: 'Report not found' });

      // Residents can only edit their own pending reports
      if (req.user.role === 'resident') {
        if (existing.reporterId !== req.user.id) return res.status(403).json({ message: 'Access denied' });
        if (existing.status !== 'pending') return res.status(400).json({ message: 'Cannot edit a report that is already being processed' });
      }

      const data = {};
      if (req.user.role === 'admin') {
        if (req.body.status !== undefined) {
          data.status = req.body.status;
          if (req.body.status === 'resolved') data.resolvedAt = new Date();
        }
        if (req.body.adminNotes !== undefined) data.adminNotes = req.body.adminNotes;
        if (req.body.assignedToId !== undefined) data.assignedToId = Number(req.body.assignedToId);
      }
      if (req.body.description !== undefined) data.description = req.body.description;

      const report = await prisma.report.update({
        where: { id },
        data,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });
      res.json({ report });
    } catch (err) {
      res.status(500).json({ message: 'Failed to update report' });
    }
  }
);

// ── DELETE /api/reports/:id ───────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.report.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Report not found' });

    if (req.user.role === 'resident' && existing.reporterId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prisma.report.delete({ where: { id } });
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete report' });
  }
});

module.exports = router;
