const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const zones = await prisma.zone.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json({ zones });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch zones' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const zone = await prisma.zone.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!zone) return res.status(404).json({ message: 'Zone not found' });
    res.json({ zone });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch zone' });
  }
});

router.post(
  '/',
  authenticate,
  authorize(['admin']),
  [
    body('name').trim().notEmpty().withMessage('Zone name is required'),
    body('code').trim().notEmpty().withMessage('Zone code is required'),
    body('description').optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, code, description } = req.body;
      const zone = await prisma.zone.create({ data: { name, code: code.toUpperCase(), description } });
      res.status(201).json({ zone });
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ message: 'Zone code already exists' });
      res.status(500).json({ message: 'Failed to create zone' });
    }
  }
);

router.put('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, code, description, isActive } = req.body;
    const zone = await prisma.zone.update({ where: { id }, data: { name, code, description, isActive } });
    res.json({ zone });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Zone not found' });
    res.status(500).json({ message: 'Failed to update zone' });
  }
});

router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await prisma.zone.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Zone deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Zone not found' });
    res.status(500).json({ message: 'Failed to delete zone' });
  }
});

module.exports = router;
