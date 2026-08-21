const express = require('express');
const { body, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ensurePlatformSettings, getPlatformSettings, upsertPlatformSetting } = require('../services/payment.service');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/revenue', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const [revenue, commission, earnings, pending, successful, failed, refunded, subscriptions, businessAccountCount, withdrawals] = await Promise.all([
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'successful' } }),
      prisma.transaction.aggregate({ _sum: { commission: true }, where: { status: 'successful' } }),
      prisma.transaction.aggregate({ _sum: { collectorEarnings: true }, where: { status: 'successful' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'pending' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'successful' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'failed' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'refunded' } }),
      prisma.collectorSubscription.aggregate({ _sum: { price: true }, where: { status: 'active' } }),
      prisma.businessAccount.count(),
      prisma.withdrawal.aggregate({ _sum: { amount: true }, where: { status: { in: ['pending', 'processing', 'successful'] } } }),
    ]);

    const totalRevenue = Number(revenue._sum.amount || 0);
    const platformCommission = Number(commission._sum.commission || 0);
    const collectorEarningsTotal = Number(earnings._sum.collectorEarnings || 0);
    const pendingPayments = Number(pending._sum.amount || 0);
    const successfulPayments = Number(successful._sum.amount || 0);
    const failedPayments = Number(failed._sum.amount || 0);
    const refunds = Number(refunded._sum.amount || 0);
    const subscriptionRevenue = Number(subscriptions._sum.price || 0);
    const businessRevenue = Number(businessAccountCount || 0) * 0;
    const withdrawalsAmount = Number(withdrawals._sum.amount || 0);
    const netPlatformRevenue = totalRevenue - platformCommission - withdrawalsAmount;

    res.json({
      summary: {
        totalRevenue,
        platformCommission,
        collectorEarnings: collectorEarningsTotal,
        pendingPayments,
        successfulPayments,
        failedPayments,
        refunds,
        subscriptions: subscriptionRevenue,
        businessRevenue,
        withdrawals: withdrawalsAmount,
        netPlatformRevenue,
      },
    });
  } catch (error) {
    console.error('[revenue summary]', error);
    res.status(500).json({ message: 'Unable to load revenue summary' });
  }
});

router.get('/summary', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const [revenue, commission, earnings, pending, successful, failed, refunded, subscriptions, businessAccountCount, withdrawals] = await Promise.all([
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'successful' } }),
      prisma.transaction.aggregate({ _sum: { commission: true }, where: { status: 'successful' } }),
      prisma.transaction.aggregate({ _sum: { collectorEarnings: true }, where: { status: 'successful' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'pending' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'successful' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'failed' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'refunded' } }),
      prisma.collectorSubscription.aggregate({ _sum: { price: true }, where: { status: 'active' } }),
      prisma.businessAccount.count(),
      prisma.withdrawal.aggregate({ _sum: { amount: true }, where: { status: { in: ['pending', 'processing', 'successful'] } } }),
    ]);

    const totalRevenue = Number(revenue._sum.amount || 0);
    const platformCommission = Number(commission._sum.commission || 0);
    const collectorEarningsTotal = Number(earnings._sum.collectorEarnings || 0);
    const pendingPayments = Number(pending._sum.amount || 0);
    const successfulPayments = Number(successful._sum.amount || 0);
    const failedPayments = Number(failed._sum.amount || 0);
    const refunds = Number(refunded._sum.amount || 0);
    const subscriptionRevenue = Number(subscriptions._sum.price || 0);
    const businessRevenue = Number(businessAccountCount || 0) * 0;
    const withdrawalsAmount = Number(withdrawals._sum.amount || 0);
    const netPlatformRevenue = totalRevenue - platformCommission - withdrawalsAmount;

    res.json({
      summary: {
        totalRevenue,
        platformCommission,
        collectorEarnings: collectorEarningsTotal,
        pendingPayments,
        successfulPayments,
        failedPayments,
        refunds,
        subscriptions: subscriptionRevenue,
        businessRevenue,
        withdrawals: withdrawalsAmount,
        netPlatformRevenue,
      },
    });
  } catch (error) {
    console.error('[revenue summary]', error);
    res.status(500).json({ message: 'Unable to load revenue summary' });
  }
});

router.get('/settings', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await ensurePlatformSettings(prisma);
    const settings = await getPlatformSettings(prisma);
    res.json({ settings });
  } catch (error) {
    console.error('[revenue settings get]', error);
    res.status(500).json({ message: 'Unable to load revenue settings' });
  }
});

router.get('/settings/revenue', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await ensurePlatformSettings(prisma);
    const settings = await getPlatformSettings(prisma);
    res.json({ settings });
  } catch (error) {
    console.error('[revenue settings get]', error);
    res.status(500).json({ message: 'Unable to load revenue settings' });
  }
});

router.put('/settings', authenticate, authorize(['admin']), [
  body('commissionRate').optional().isFloat({ min: 0, max: 100 }),
  body('minimumWithdrawalAmount').optional().isFloat({ min: 0 }),
  body('currency').optional().isString(),
  body('customerServiceFee').optional().isFloat({ min: 0 }),
], validate, async (req, res) => {
  try {
    const updates = req.body;
    const entries = [
      ['commissionRate', updates.commissionRate],
      ['minimumWithdrawalAmount', updates.minimumWithdrawalAmount],
      ['currency', updates.currency],
      ['customerServiceFee', updates.customerServiceFee],
    ].filter(([, value]) => value !== undefined && value !== null);

    for (const [key, value] of entries) {
      await upsertPlatformSetting(prisma, key, value, typeof value === 'number' ? 'number' : 'string');
    }

    const settings = await getPlatformSettings(prisma);
    res.json({ message: 'Revenue settings updated.', settings });
  } catch (error) {
    console.error('[revenue settings put]', error);
    res.status(500).json({ message: 'Unable to update revenue settings' });
  }
});

router.put('/settings/revenue', authenticate, authorize(['admin']), [
  body('commissionRate').optional().isFloat({ min: 0, max: 100 }),
  body('minimumWithdrawalAmount').optional().isFloat({ min: 0 }),
  body('currency').optional().isString(),
  body('customerServiceFee').optional().isFloat({ min: 0 }),
], validate, async (req, res) => {
  try {
    const updates = req.body;
    const entries = [
      ['commissionRate', updates.commissionRate],
      ['minimumWithdrawalAmount', updates.minimumWithdrawalAmount],
      ['currency', updates.currency],
      ['customerServiceFee', updates.customerServiceFee],
    ].filter(([, value]) => value !== undefined && value !== null);

    for (const [key, value] of entries) {
      await upsertPlatformSetting(prisma, key, value, typeof value === 'number' ? 'number' : 'string');
    }

    const settings = await getPlatformSettings(prisma);
    res.json({ message: 'Revenue settings updated.', settings });
  } catch (error) {
    console.error('[revenue settings put]', error);
    res.status(500).json({ message: 'Unable to update revenue settings' });
  }
});

router.get('/transactions', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { customer: { select: { id: true, name: true, email: true } }, collector: { select: { id: true, name: true, email: true } }, booking: { select: { id: true, bookingReference: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ transactions });
  } catch (error) {
    console.error('[revenue transactions]', error);
    res.status(500).json({ message: 'Unable to load transactions' });
  }
});

module.exports = router;
