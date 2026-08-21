const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

async function ensurePlans() {
  const defaults = [
    { name: 'Basic', price: 15000, billingPeriod: 'monthly', features: ['Estates', 'Schools', 'Restaurants'], status: 'active' },
    { name: 'Standard', price: 35000, billingPeriod: 'monthly', features: ['Hotels', 'Offices', 'Markets'], status: 'active' },
    { name: 'Enterprise', price: 75000, billingPeriod: 'monthly', features: ['Shopping centers', 'Priority support', 'Dedicated account manager'], status: 'active' },
  ];

  for (const plan of defaults) {
    const existing = await prisma.businessPlan.findFirst({ where: { name: plan.name } });
    if (existing) {
      await prisma.businessPlan.update({ where: { id: existing.id }, data: plan });
    } else {
      await prisma.businessPlan.create({ data: plan });
    }
  }
}

router.get('/plans', authenticate, async (req, res) => {
  try {
    await ensurePlans();
    const plans = await prisma.businessPlan.findMany({ orderBy: { price: 'asc' } });
    res.json({ plans });
  } catch (error) {
    console.error('[business plans]', error);
    res.status(500).json({ message: 'Unable to load business plans' });
  }
});

router.post('/subscription', authenticate, [
  body('organizationName').isString().notEmpty(),
  body('contactPerson').isString().notEmpty(),
  body('phone').isString().notEmpty(),
  body('email').isEmail(),
  body('address').isString().notEmpty(),
  body('wasteType').isString().notEmpty(),
  body('collectionFrequency').isString().notEmpty(),
  body('collectionPoints').optional().isInt({ min: 1 }),
  body('preferredSchedule').optional().isString(),
  body('estimatedMonthlyVolume').optional().isFloat({ min: 0 }),
  body('planId').optional().isInt(),
], validate, async (req, res) => {
  try {
    const plan = req.body.planId ? await prisma.businessPlan.findUnique({ where: { id: Number(req.body.planId) } }) : await prisma.businessPlan.findFirst({ orderBy: { price: 'asc' } });

    const account = await prisma.businessAccount.create({
      data: {
        userId: req.user.id,
        organizationName: req.body.organizationName,
        contactPerson: req.body.contactPerson,
        phone: req.body.phone,
        email: req.body.email,
        address: req.body.address,
        wasteType: req.body.wasteType,
        collectionFrequency: req.body.collectionFrequency,
        collectionPoints: Number(req.body.collectionPoints || 1),
        preferredSchedule: req.body.preferredSchedule || null,
        estimatedMonthlyVolume: Number(req.body.estimatedMonthlyVolume || 0),
        planId: plan?.id || null,
        status: 'pending',
      },
    });

    res.status(201).json({ message: 'Business account request submitted.', account, plan });
  } catch (error) {
    console.error('[business subscription]', error);
    res.status(500).json({ message: 'Unable to submit business request' });
  }
});

router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const accounts = await prisma.businessAccount.findMany({ where: { userId: req.user.id }, include: { plan: true } });
    res.json({ accounts });
  } catch (error) {
    console.error('[business dashboard]', error);
    res.status(500).json({ message: 'Unable to load business accounts' });
  }
});

module.exports = router;
