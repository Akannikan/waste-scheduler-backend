const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/categories ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.wasteCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// ── GET /api/categories/:id ──────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const category = await prisma.wasteCategory.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ category });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch category' });
  }
});

// ── POST /api/categories  (admin) ────────────────────────────
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('slug').trim().notEmpty().withMessage('Slug is required'),
    body('color').trim().notEmpty().withMessage('Color is required'),
    body('binColor').trim().notEmpty().withMessage('Bin color is required'),
    body('collectionDay').optional().isString(),
    body('description').optional().isString(),
    body('tips').optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, slug, color, binColor, icon, description, collectionDay, tips } = req.body;
      const category = await prisma.wasteCategory.create({
        data: { name, slug, color, binColor, icon, description, collectionDay, tips: tips || [] },
      });
      res.status(201).json({ category });
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ message: 'Category with this name or slug already exists' });
      res.status(500).json({ message: 'Failed to create category' });
    }
  }
);

// ── PUT /api/categories/:id  (admin) ─────────────────────────
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  [
    body('name').optional().trim().notEmpty(),
    body('color').optional().trim().notEmpty(),
    body('binColor').optional().trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, slug, color, binColor, icon, description, collectionDay, tips, isActive } = req.body;
      const category = await prisma.wasteCategory.update({
        where: { id },
        data: { name, slug, color, binColor, icon, description, collectionDay, tips, isActive },
      });
      res.json({ category });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ message: 'Category not found' });
      res.status(500).json({ message: 'Failed to update category' });
    }
  }
);

// ── DELETE /api/categories/:id  (admin) ──────────────────────
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await prisma.wasteCategory.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Category not found' });
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

module.exports = router;
