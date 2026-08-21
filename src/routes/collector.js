const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getPlatformSettings } = require('../services/payment.service');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/earnings', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  try {
    const collectorId = req.user.role === 'admin' ? Number(req.query.collectorId || 0) : req.user.id;
    const where = collectorId ? { collectorId } : { collectorId: req.user.id };

    const [earnings, withdrawals, monthly, yearly, completedJobs] = await Promise.all([
      prisma.collectorEarning.findMany({ where: { collectorId: collectorId || req.user.id }, orderBy: { createdAt: 'desc' } }),
      prisma.withdrawal.aggregate({ _sum: { amount: true }, where: { collectorId: collectorId || req.user.id, status: { in: ['pending', 'processing', 'successful'] } } }),
      prisma.collectorEarning.aggregate({ _sum: { collectorEarnings: true }, where: { collectorId: collectorId || req.user.id, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
      prisma.collectorEarning.aggregate({ _sum: { collectorEarnings: true }, where: { collectorId: collectorId || req.user.id, createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) } } }),
      prisma.bookings ? prisma.booking.count({ where: { collectorId: collectorId || req.user.id, paymentStatus: 'successful' } }) : 0,
    ]);

    const totalEarnings = earnings.reduce((sum, item) => sum + Number(item.collectorEarnings || 0), 0);
    const totalCommission = earnings.reduce((sum, item) => sum + Number(item.platformCommission || 0), 0);
    const pendingEarnings = earnings.filter((item) => item.paymentStatus !== 'successful').reduce((sum, item) => sum + Number(item.collectorEarnings || 0), 0);
    const availableBalance = totalEarnings - Number(withdrawals._sum.amount || 0);

    res.json({
      summary: {
        totalEarnings,
        pendingEarnings,
        availableBalance,
        completedJobs: completedJobs || 0,
        commissionDeducted: totalCommission,
        earningsThisMonth: Number(monthly._sum.collectorEarnings || 0),
        earningsThisYear: Number(yearly._sum.collectorEarnings || 0),
      },
      earnings,
    });
  } catch (error) {
    console.error('[collector earnings]', error);
    res.status(500).json({ message: 'Unable to load earnings' });
  }
});

router.get('/withdrawals', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  try {
    const collectorId = req.user.role === 'admin' ? Number(req.query.collectorId || 0) : req.user.id;
    const where = collectorId ? { collectorId } : { collectorId: req.user.id };
    const withdrawals = await prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { collector: { select: { id: true, name: true, email: true } } },
    });
    res.json({ withdrawals });
  } catch (error) {
    console.error('[collector withdrawals]', error);
    res.status(500).json({ message: 'Unable to load withdrawals' });
  }
});

router.post('/withdrawals', authenticate, authorize(['collector']), [
  body('amount').isFloat({ min: 1 }).withMessage('Withdrawal amount is required'),
  body('bankName').optional().isString(),
  body('accountName').optional().isString(),
  body('accountNumber').optional().isString(),
], validate, async (req, res) => {
  try {
    const settings = await getPlatformSettings(prisma);
    const amount = Number(req.body.amount);
    const available = await prisma.collectorEarning.aggregate({
      _sum: { collectorEarnings: true },
      where: { collectorId: req.user.id, paymentStatus: 'successful' },
    });
    const currentBalance = Number(available._sum.collectorEarnings || 0);
    const withdrawalsSum = await prisma.withdrawal.aggregate({ _sum: { amount: true }, where: { collectorId: req.user.id, status: { in: ['pending', 'processing', 'successful'] } } });
    const netBalance = currentBalance - Number(withdrawalsSum._sum.amount || 0);

    if (amount > netBalance) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }
    if (amount < settings.minimumWithdrawalAmount) {
      return res.status(400).json({ message: `Minimum withdrawal is ₦${settings.minimumWithdrawalAmount.toLocaleString('en-NG')}.` });
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        collectorId: req.user.id,
        amount,
        bankName: req.body.bankName || 'Bank transfer',
        accountName: req.body.accountName || '',
        accountNumber: req.body.accountNumber || '',
        status: 'pending',
        note: req.body.note || 'Withdrawal requested',
      },
    });
    res.status(201).json({ message: 'Withdrawal request submitted.', withdrawal });
  } catch (error) {
    console.error('[collector withdrawals create]', error);
    res.status(500).json({ message: 'Unable to request withdrawal' });
  }
});

router.put('/withdrawals/:id/status', authenticate, authorize(['admin']), [
  body('status').isIn(['pending', 'processing', 'successful', 'failed', 'cancelled']).withMessage('Invalid withdrawal status'),
], validate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const withdrawal = await prisma.withdrawal.update({
      where: { id },
      data: { status: req.body.status, reviewedBy: req.user.id, reviewedAt: new Date() },
    });
    res.json({ message: 'Withdrawal status updated.', withdrawal });
  } catch (error) {
    console.error('[collector withdrawal status]', error);
    res.status(500).json({ message: 'Unable to update withdrawal status' });
  }
});

module.exports = router;
