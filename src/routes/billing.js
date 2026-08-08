const express = require('express');
const { body, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sendBillEmail, sendPaymentConfirmedEmail } = require('../services/email.service');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/billing/my-bills ────────────────────────────────
router.get('/my-bills', authenticate, async (req, res) => {
  try {
    const bills = await prisma.bill.findMany({
      where: { userId: req.user.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { payments: true },
    });

    const summary = {
      totalOwed: bills.filter(b => b.status !== 'paid').reduce((s, b) => s + b.amountNaira, 0),
      totalPaid: bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.amountNaira, 0),
      overdueCount: bills.filter(b => b.status === 'overdue').length,
    };

    res.json({ bills, summary });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bills' });
  }
});

// ── GET /api/billing/all  (admin) ────────────────────────────
router.get('/all', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const where = status ? { status } : {};
    const [total, bills] = await Promise.all([
      prisma.bill.count({ where }),
      prisma.bill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          payments: true,
        },
      }),
    ]);

    res.json({ bills, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bills' });
  }
});

// ── POST /api/billing/generate-bill  (admin) ─────────────────
router.post(
  '/generate-bill',
  authenticate,
  authorize(['admin']),
  [
    body('userId').isInt(),
    body('month').isInt({ min: 1, max: 12 }),
    body('year').isInt({ min: 2020 }),
    body('billingType').isIn(['per_kg', 'monthly_flat', 'per_bin']),
    body('amountNaira').isFloat({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { userId, month, year, billingType, amountNaira, totalKg, notes } = req.body;

      const existing = await prisma.bill.findFirst({ where: { userId: Number(userId), month, year } });
      if (existing) return res.status(409).json({ message: 'Bill already exists for this month' });

      const dueDate = new Date(year, month - 1, 28);
      const bill = await prisma.bill.create({
        data: {
          userId: Number(userId),
          month,
          year,
          billingType,
          amountNaira,
          totalKg: totalKg ? Number(totalKg) : undefined,
          dueDate,
          notes,
        },
        include: { user: true },
      });

      // Send bill email
      try { await sendBillEmail(bill.user, bill); } catch (e) { console.error('[billing] email error:', e.message); }

      res.status(201).json({ bill });
    } catch (err) {
      res.status(500).json({ message: 'Failed to generate bill' });
    }
  }
);

// ── POST /api/billing/calculate-by-weight ───────────────────
router.post(
  '/calculate-by-weight',
  authenticate,
  [
    body('month').isInt({ min: 1, max: 12 }),
    body('year').isInt({ min: 2020 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { month, year } = req.body;
      const userId = req.user.id;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const logs = await prisma.wasteLog.aggregate({
        where: { userId, loggedAt: { gte: startDate, lt: endDate } },
        _sum: { quantityKg: true },
      });

      const totalKg = logs._sum.quantityKg || 0;

      // Get pricing rule
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const rule = await prisma.pricingRule.findFirst({
        where: { OR: [{ zoneId: user?.zoneId }, { zoneId: null }], isActive: true },
        orderBy: { zoneId: 'desc' },
      });

      const pricePerKg = rule?.pricePerKg || 50;
      const estimatedAmount = totalKg * pricePerKg;

      res.json({
        totalKg,
        pricePerKg,
        estimatedAmount,
        currency: 'NGN',
        month,
        year,
      });
    } catch (err) {
      res.status(500).json({ message: 'Failed to calculate charges' });
    }
  }
);

// ── POST /api/billing/submit-payment ────────────────────────
router.post(
  '/submit-payment',
  authenticate,
  [
    body('billId').optional().isInt(),
    body('amountNaira').isFloat({ min: 1 }).withMessage('Amount is required'),
    body('bankName').optional().isString(),
    body('transferRef').optional().isString(),
    body('proofImageUrl').optional().isURL(),
  ],
  validate,
  async (req, res) => {
    try {
      const { billId, amountNaira, bankName, accountName, transferRef, proofImageUrl, notes } = req.body;

      const payment = await prisma.payment.create({
        data: {
          userId: req.user.id,
          billId: billId ? Number(billId) : undefined,
          amountNaira,
          bankName,
          accountName,
          accountNumber: process.env.BANK_ACCOUNT_NUMBER,
          transferRef,
          proofImageUrl,
          notes,
          status: 'pending',
        },
      });

      res.status(201).json({
        payment,
        message: 'Payment submitted! It will be confirmed by our team within 24 hours.',
      });
    } catch (err) {
      res.status(500).json({ message: 'Failed to submit payment' });
    }
  }
);

// ── PUT /api/billing/confirm-payment/:id  (admin) ────────────
router.put('/confirm-payment/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const payment = await prisma.payment.update({
      where: { id },
      data: { status: 'paid', confirmedAt: new Date(), confirmedBy: req.user.id },
      include: { user: true, bill: true },
    });

    // Update bill status
    if (payment.billId) {
      await prisma.bill.update({ where: { id: payment.billId }, data: { status: 'paid', paidAt: new Date() } });
    }

    // Send confirmation email
    try { await sendPaymentConfirmedEmail(payment.user, payment); } catch (e) { console.error('[billing] confirm email error:', e.message); }

    res.json({ payment });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Payment not found' });
    res.status(500).json({ message: 'Failed to confirm payment' });
  }
});

// ── GET /api/billing/payments  (admin or own) ────────────────
router.get('/payments', authenticate, async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
        bill: true,
      },
    });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payments' });
  }
});

// ── GET /api/billing/pricing-rules ──────────────────────────
router.get('/pricing-rules', async (req, res) => {
  try {
    const rules = await prisma.pricingRule.findMany({
      where: { isActive: true },
      include: {
        zone: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pricing rules' });
  }
});

// ── POST /api/billing/pricing-rules  (admin) ─────────────────
router.post(
  '/pricing-rules',
  authenticate,
  authorize(['admin']),
  [
    body('billingType').isIn(['per_kg', 'monthly_flat', 'per_bin']),
    body('pricePerKg').optional().isFloat({ min: 0 }),
    body('monthlyFlat').optional().isFloat({ min: 0 }),
    body('pricePerBin').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { zoneId, categoryId, billingType, pricePerKg, monthlyFlat, pricePerBin } = req.body;
      const rule = await prisma.pricingRule.create({
        data: {
          zoneId: zoneId ? Number(zoneId) : undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          billingType,
          pricePerKg,
          monthlyFlat,
          pricePerBin,
        },
      });
      res.status(201).json({ rule });
    } catch (err) {
      res.status(500).json({ message: 'Failed to create pricing rule' });
    }
  }
);

module.exports = router;
