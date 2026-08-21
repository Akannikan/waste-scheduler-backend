const express = require('express');
const { body, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const nigeriaLocations = require('nigerian-states-and-lgas');

const router = express.Router();
const prisma = new PrismaClient();

const NIGERIAN_STATES = [...new Set([...nigeriaLocations.states(), 'FCT'])].map((state) => (
  state === 'Kastina' ? 'Katsina' : state
));

function catalogLgas(state) {
  if (state === 'FCT') return ['Municipal Area Council'];
  const match = nigeriaLocations.all().find((entry) => (
    (entry.state === 'Kastina' ? 'Katsina' : entry.state) === state
  ));
  return match?.lgas || [];
}

router.get('/states', async (req, res) => {
  try {
    const states = await prisma.zone.findMany({
      where: { isActive: true, state: { not: null } },
      distinct: ['state'],
      orderBy: { state: 'asc' },
      select: { state: true },
    });
    res.json({ states: [...new Set([...NIGERIAN_STATES, ...states.map(item => item.state).filter(Boolean)])].sort() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch states' });
  }
});

router.get('/lgas', [query('state').trim().notEmpty()], validate, async (req, res) => {
  try {
    const zones = await prisma.zone.findMany({
      where: { isActive: true, state: req.query.state },
      distinct: ['lga'],
      orderBy: { lga: 'asc' },
      select: { lga: true },
    });
    res.json({ lgas: [...new Set([...catalogLgas(req.query.state), ...zones.map(item => item.lga).filter(Boolean)])].sort() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch LGAs' });
  }
});

router.get('/', [query('state').optional().trim().isLength({ min: 2, max: 60 })], validate, async (req, res) => {
  try {
    const where = { isActive: true };
    if (req.query.state) where.state = req.query.state;
    const zones = await prisma.zone.findMany({ where, orderBy: { name: 'asc' } });
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
    body('state').optional().isString().isLength({ max: 60 }),
    body('lga').optional().isString().isLength({ max: 100 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, code, description, state, lga } = req.body;
      const zone = await prisma.zone.create({ data: { name, code: code.toUpperCase(), description, state, lga } });
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
    const { name, code, description, state, lga, isActive } = req.body;
    const zone = await prisma.zone.update({ where: { id }, data: { name, code, description, state, lga, isActive } });
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
