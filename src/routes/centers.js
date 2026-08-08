const express = require('express');
const { body, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/centers ─────────────────────────────────────────
router.get(
  '/',
  [
    query('zoneId').optional().isInt(),
    query('type').optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const where = { isActive: true };
      if (req.query.zoneId) where.zoneId = parseInt(req.query.zoneId);
      if (req.query.type) {
        where.acceptedTypes = { has: req.query.type };
      }

      const centers = await prisma.recyclingCenter.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { zone: { select: { id: true, name: true, code: true } } },
      });
      res.json({ centers });
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch recycling centers' });
    }
  }
);

// ── GET /api/centers/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const center = await prisma.recyclingCenter.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { zone: { select: { id: true, name: true, code: true } } },
    });
    if (!center) return res.status(404).json({ message: 'Center not found' });
    res.json({ center });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch center' });
  }
});

// ── POST /api/centers  (admin) ────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
    body('zoneId').optional().isInt(),
    body('acceptedTypes').optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, address, latitude, longitude, phone, email, website, zoneId, openingHours, acceptedTypes } = req.body;
      const center = await prisma.recyclingCenter.create({
        data: {
          name,
          address,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          phone,
          email,
          website,
          zoneId: zoneId ? Number(zoneId) : undefined,
          openingHours,
          acceptedTypes: acceptedTypes || [],
        },
      });
      res.status(201).json({ center });
    } catch (err) {
      res.status(500).json({ message: 'Failed to create recycling center' });
    }
  }
);

// ── PUT /api/centers/:id  (admin) ────────────────────────────
router.put('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, address, latitude, longitude, phone, email, website, zoneId, openingHours, acceptedTypes, isActive } = req.body;
    const center = await prisma.recyclingCenter.update({
      where: { id },
      data: { name, address, latitude, longitude, phone, email, website, zoneId, openingHours, acceptedTypes, isActive },
    });
    res.json({ center });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Center not found' });
    res.status(500).json({ message: 'Failed to update center' });
  }
});

// ── DELETE /api/centers/:id  (admin) ─────────────────────────
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await prisma.recyclingCenter.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Center deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Center not found' });
    res.status(500).json({ message: 'Failed to delete center' });
  }
});

module.exports = router;
