const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { calculateBookingBreakdown, getPlatformSettings, ensurePlatformSettings } = require('../services/payment.service');

const router = express.Router();
const prisma = new PrismaClient();

function buildReference(prefix = 'WS') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

router.post(
  '/initialize',
  authenticate,
  [
    body('amount').isFloat({ min: 1 }).withMessage('Valid booking amount is required'),
    body('serviceName').optional().isString(),
    body('customerId').optional().isInt(),
    body('collectorId').optional().isInt(),
    body('bookingId').optional().isString(),
    body('provider').optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      await ensurePlatformSettings(prisma);
      const settings = await getPlatformSettings(prisma);
      const amount = Number(req.body.amount);
      const customerId = req.user.id;
      const collectorId = req.body.collectorId ? Number(req.body.collectorId) : null;
      const provider = req.body.provider || 'manual';
      const bookingId = req.body.bookingId || buildReference('BOOK');
      const serviceName = req.body.serviceName || 'Waste Collection';
      const breakdown = calculateBookingBreakdown(amount, settings.commissionRate);

      const payment = await prisma.$transaction(async (tx) => {
        if (collectorId) {
          const collector = await tx.user.findFirst({ where: { id: collectorId, role: 'collector', isActive: true } });
          if (!collector) throw Object.assign(new Error('Selected collector is not available'), { status: 422 });
        }
        const created = await tx.booking.create({
          data: {
            bookingReference: bookingId,
            customerId,
            collectorId,
            serviceName,
            amount: breakdown.totalAmount,
            totalAmount: breakdown.totalAmount,
            commissionRate: breakdown.commissionRate,
            platformCommission: breakdown.platformCommission,
            collectorEarnings: breakdown.collectorEarnings,
            paymentStatus: 'pending',
            status: 'pending',
            location: req.body.location || 'Not specified',
            collectionDate: req.body.collectionDate ? new Date(req.body.collectionDate) : null,
            collectionTime: req.body.collectionTime || null,
            notes: req.body.notes || null,
          },
        });

        const transaction = await tx.transaction.create({
          data: {
            bookingId: created.id,
            customerId,
            collectorId,
            amount: breakdown.totalAmount,
            commission: breakdown.platformCommission,
            collectorEarnings: breakdown.collectorEarnings,
            paymentProvider: provider,
            paymentReference: req.body.reference || buildReference('PAY'),
            status: 'pending',
            notes: `Initialized ${provider} payment for order ${created.bookingReference}`,
          },
        });

        return { booking: created, paymentReference: transaction.paymentReference };
      });

      res.status(201).json({
        message: 'Payment initialized successfully.',
        booking: payment.booking,
        provider,
        breakdown,
        paymentReference: payment.paymentReference,
      });
    } catch (error) {
      console.error('[payments initialize]', error);
      res.status(500).json({ message: 'Unable to initialize payment' });
    }
  }
);

router.post(
  '/verify',
  authenticate,
  [
    body('bookingId').optional().isString(),
    body('paymentReference').optional().isString(),
    body('status').optional().isIn(['pending', 'successful', 'failed', 'refunded']),
  ],
  validate,
  async (req, res) => {
    try {
      const paymentReference = req.body.paymentReference || req.body.reference || req.body.bookingId || buildReference('PAY');
      const requestedStatus = req.body.status || 'successful';
      const paymentStatus = requestedStatus;

      const transaction = await prisma.$transaction(async (tx) => {
        const record = await tx.transaction.findFirst({
          where: { OR: [{ paymentReference }, { booking: { bookingReference: req.body.bookingId || paymentReference } }] },
          include: { booking: true },
        });

        if (!record) {
          const booking = await tx.booking.findFirst({ where: { bookingReference: req.body.bookingId || paymentReference } });
          if (!booking) {
            throw Object.assign(new Error('Transaction not found'), { status: 404 });
          }
          if (req.user.role !== 'admin' && booking.customerId !== req.user.id) {
            throw Object.assign(new Error('You can only update your own payment'), { status: 403 });
          }

          const updatedBooking = await tx.booking.update({
            where: { id: booking.id },
            data: { paymentStatus, status: paymentStatus === 'successful' ? 'confirmed' : 'failed' },
          });

          return { booking: updatedBooking, status: paymentStatus };
        }

        if (req.user.role !== 'admin' && record.booking?.customerId !== req.user.id) {
          throw Object.assign(new Error('You can only update your own payment'), { status: 403 });
        }

        const updatedRecord = await tx.transaction.update({
          where: { id: record.id },
          data: { status: paymentStatus, paymentReference: record.paymentReference || paymentReference },
        });

        const booking = await tx.booking.update({
          where: { id: record.bookingId },
          data: { paymentStatus, status: paymentStatus === 'successful' ? 'confirmed' : 'failed' },
        });

        if (paymentStatus === 'successful') {
          const existingEarning = await tx.collectorEarning.findFirst({ where: { bookingId: booking.id } });
          if (!existingEarning) {
            await tx.collectorEarning.create({
              data: {
                collectorId: booking.collectorId || record.collectorId || req.user.id,
                customerId: booking.customerId,
                bookingId: booking.id,
                collectionAmount: booking.amount,
                platformCommission: booking.platformCommission,
                collectorEarnings: booking.collectorEarnings,
                paymentStatus: 'successful',
              },
            });
          }
        }

        return { transaction: updatedRecord, booking, status: paymentStatus };
      });

      res.json({ message: paymentStatus === 'successful' ? 'Payment confirmed.' : 'Payment status updated.', payment: transaction });
    } catch (error) {
      console.error('[payments verify]', error);
      const status = error.status || 500;
      res.status(status).json({ message: error.message || 'Unable to verify payment' });
    }
  }
);

router.get('/transactions', authenticate, async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { customerId: req.user.id };
    const transactions = await prisma.transaction.findMany({
      where,
      include: { booking: true, customer: { select: { id: true, name: true, email: true } }, collector: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ transactions });
  } catch (error) {
    console.error('[payments transactions]', error);
    res.status(500).json({ message: 'Unable to load transactions' });
  }
});

router.get('/health', async (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
