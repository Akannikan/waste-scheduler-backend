const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

async function ensureDefaults() {
  const defaults = [
    { name: 'FREE', price: 0, billingPeriod: 'monthly', features: ['Basic profile', 'Limited booking requests', 'Basic dashboard'], maxBookings: 3, status: 'active' },
    { name: 'PRO', price: 15000, billingPeriod: 'monthly', features: ['More booking requests', 'Advanced statistics', 'Priority visibility', 'Earnings analytics', 'Better profile visibility'], maxBookings: 40, status: 'active' },
    { name: 'BUSINESS', price: 35000, billingPeriod: 'monthly', features: ['Unlimited capacity', 'Priority listing', 'Advanced analytics', 'Business support'], maxBookings: 999, status: 'active' },
  ];

  for (const plan of defaults) {
    await prisma.subscriptionPlan.upsert({
      where: { id: (await prisma.subscriptionPlan.findFirst({ where: { name: plan.name } }))?.id || -1 },
      update: plan,
      create: plan,
    });
  }
}

router.get('/plans', authenticate, async (req, res) => {
  try {
    await ensureDefaults();
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
    res.json({ plans });
  } catch (error) {
    console.error('[subscriptions plans]', error);
    res.status(500).json({ message: 'Unable to load subscription plans' });
  }
});

router.get('/current', authenticate, authorize(['collector']), async (req, res) => {
  try {
    const subscription = await prisma.collectorSubscription.findFirst({
      where: { collectorId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    res.json({ subscription });
  } catch (error) {
    console.error('[subscriptions current]', error);
    res.status(500).json({ message: 'Unable to load current subscription' });
  }
});

router.post('/', authenticate, authorize(['collector']), [
  body('planId').isInt().withMessage('Subscription plan is required'),
], validate, async (req, res) => {
  try {
    const planId = Number(req.body.planId);
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const subscription = await prisma.collectorSubscription.create({
      data: {
        collectorId: req.user.id,
        planId,
        status: 'pending',
        price: plan.price,
        billingPeriod: plan.billingPeriod,
        startedAt: new Date(),
        endsAt: new Date(Date.now() + (plan.billingPeriod === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
      },
      include: { plan: true },
    });
    res.status(201).json({ message: 'Subscription request created.', subscription });
  } catch (error) {
    console.error('[subscriptions create]', error);
    res.status(500).json({ message: 'Unable to create subscription' });
  }
});

router.post('/cancel', authenticate, authorize(['collector']), async (req, res) => {
  try {
    const subscription = await prisma.collectorSubscription.findFirst({ where: { collectorId: req.user.id }, orderBy: { createdAt: 'desc' } });
    if (!subscription) return res.status(404).json({ message: 'No active subscription found' });

    const updated = await prisma.collectorSubscription.update({
      where: { id: subscription.id },
      data: { status: 'cancelled' },
    });
    res.json({ message: 'Subscription cancelled.', subscription: updated });
  } catch (error) {
    console.error('[subscriptions cancel]', error);
    res.status(500).json({ message: 'Unable to cancel subscription' });
  }
});

router.get('/admin', authenticate, authorize(['admin']), async (req,res)=> {
  try {
    const subscriptions = await prisma.collectorSubscription.findMany({ include: { collector: { select: { id: true, name: true, email: true } }, plan: true }, orderBy: { createdAt: 'desc' } });
    res.json({ subscriptions });
  } catch (error) {
    console.error('[subscriptions admin]', error);
    res.status(500).json({ message: 'Unable to load subscriptions' });
  }
});

module.exports = router;
