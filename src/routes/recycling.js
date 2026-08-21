const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const partners = await prisma.recyclingPartner.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ partners });
  } catch (error) {
    console.error('[recycling partners]', error);
    res.status(500).json({ message: 'Unable to load recycling partners' });
  }
});

router.post('/', authenticate, [
  body('name').isString().notEmpty(),
  body('role').optional().isIn(['recycler', 'admin', 'customer']),
  body('email').optional().isEmail(),
  body('phone').optional().isString(),
  body('address').optional().isString(),
  body('wasteCategories').optional().isArray(),
], validate, async (req, res) => {
  try {
    const partner = await prisma.recyclingPartner.create({
      data: {
        userId: req.user.id,
        name: req.body.name,
        role: req.body.role || 'recycler',
        phone: req.body.phone || null,
        email: req.body.email || null,
        address: req.body.address || null,
        wasteCategories: req.body.wasteCategories || ['Plastic', 'Paper', 'Metal', 'Glass', 'E-waste', 'Organic', 'Other'],
        status: 'pending',
      },
    });
    res.status(201).json({ message: 'Recycling partner request submitted.', partner });
  } catch (error) {
    console.error('[recycling partner create]', error);
    res.status(500).json({ message: 'Unable to create recycling partner request' });
  }
});

router.get('/admin', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const partners = await prisma.recyclingPartner.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ partners });
  } catch (error) {
    console.error('[recycling admin]', error);
    res.status(500).json({ message: 'Unable to load recycling partner list' });
  }
});

module.exports = router;
