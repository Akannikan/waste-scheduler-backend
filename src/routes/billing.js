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

      if (billId) {
        const bill = await prisma.bill.findFirst({ where: { id: Number(billId), userId: req.user.id } });
        if (!bill) return res.status(404).json({ message: 'Bill not found' });
        if (bill.status === 'paid') return res.status(409).json({ message: 'Bill has already been paid' });
        if (Number(amountNaira) > Number(bill.amountNaira)) {
          return res.status(422).json({ message: 'Payment cannot exceed the bill amount' });
        }
      }

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

// ── GET /api/billing/receipt/:billId  (generate receipt) ────
router.get('/receipt/:billId', authenticate, async (req, res) => {
  try {
    const billId = parseInt(req.params.billId);
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, address: true, state: true, lga: true } },
        payments: { where: { status: 'paid' }, orderBy: { confirmedAt: 'desc' }, take: 1 },
      },
    });

    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    // Only the owner or admin can view
    if (req.user.role !== 'admin' && bill.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const payment = bill.payments[0];
    const monthName = new Date(bill.year, bill.month - 1).toLocaleString('en-NG', { month: 'long', year: 'numeric' });

    // Build HTML receipt
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Waste Fee Receipt — ${monthName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 40px 20px; }
    .receipt { background: #fff; max-width: 580px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg,#2E7D32,#1B5E20); padding: 30px 36px; color: #fff; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header p { opacity: 0.8; font-size: 13px; }
    .badge { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block; margin-top: 8px; }
    .body { padding: 32px 36px; }
    .amount-box { background: #F1F8E9; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 28px; }
    .amount-box .label { color: #666; font-size: 13px; margin-bottom: 6px; }
    .amount-box .amount { font-size: 42px; font-weight: 800; color: #2E7D32; line-height: 1; }
    .amount-box .month { color: #888; font-size: 14px; margin-top: 6px; }
    .section { margin-bottom: 24px; }
    .section h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .row .key { color: #666; }
    .row .val { font-weight: 600; color: #1a1a2e; text-align: right; max-width: 60%; }
    .status-paid { background: #E8F5E9; color: #2E7D32; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .status-pending { background: #FFF9C4; color: #F57F17; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .footer { background: #1B5E20; padding: 18px 36px; text-align: center; color: rgba(255,255,255,0.7); font-size: 12px; }
    .ng-bar { height: 4px; background: linear-gradient(90deg,#008751 33%,#fff 33%,#fff 66%,#008751 66%); }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt { box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="ng-bar"></div>
    <div class="header">
      <div style="font-size:28px;margin-bottom:8px;">♻️</div>
      <h1>WasteScheduler Nigeria</h1>
      <p>Waste Management Fee Receipt</p>
      <span class="badge">Receipt #WST-${String(bill.id).padStart(6,'0')}</span>
    </div>

    <div class="body">
      <div class="amount-box">
        <div class="label">Amount ${bill.status === 'paid' ? 'Paid' : 'Due'}</div>
        <div class="amount">₦${Number(bill.amountNaira).toLocaleString('en-NG')}</div>
        <div class="month">${monthName}</div>
        <div style="margin-top:10px;">
          <span class="${bill.status === 'paid' ? 'status-paid' : 'status-pending'}">
            ${bill.status === 'paid' ? '✅ Paid' : '⏳ Pending'}
          </span>
        </div>
      </div>

      <div class="section">
        <h3>Resident Details</h3>
        ${[
          ['Name', bill.user.name],
          ['Email', bill.user.email],
          ['Phone', bill.user.phone || '—'],
          ['Address', bill.user.address || '—'],
          ['State / LGA', bill.user.state ? `${bill.user.state}${bill.user.lga ? ' / ' + bill.user.lga : ''}` : '—'],
        ].map(([k,v]) => `<div class="row"><span class="key">${k}</span><span class="val">${v}</span></div>`).join('')}
      </div>

      <div class="section">
        <h3>Bill Details</h3>
        ${[
          ['Bill Period', monthName],
          ['Billing Type', bill.billingType.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())],
          ['Due Date', new Date(bill.dueDate).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})],
          ['Bill Reference', `WST-${String(bill.id).padStart(6,'0')}`],
        ].map(([k,v]) => `<div class="row"><span class="key">${k}</span><span class="val">${v}</span></div>`).join('')}
      </div>

      ${payment ? `
      <div class="section">
        <h3>Payment Details</h3>
        ${[
          ['Amount Paid', `₦${Number(payment.amountNaira).toLocaleString('en-NG')}`],
          ['Transfer Reference', payment.transferRef || '—'],
          ['Bank', payment.bankName || process.env.BANK_NAME || 'First Bank Nigeria'],
          ['Confirmed On', payment.confirmedAt ? new Date(payment.confirmedAt).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) : '—'],
        ].map(([k,v]) => `<div class="row"><span class="key">${k}</span><span class="val">${v}</span></div>`).join('')}
      </div>
      ` : `
      <div class="section">
        <h3>Payment Instructions</h3>
        <div style="background:#FFF9C4;border-radius:8px;padding:14px 18px;font-size:13px;line-height:1.7;">
          <strong>Transfer to:</strong><br/>
          🏦 ${process.env.BANK_NAME || 'First Bank Nigeria'}<br/>
          Account: <strong>${process.env.BANK_ACCOUNT_NUMBER || '3012345678'}</strong><br/>
          Name: ${process.env.BANK_ACCOUNT_NAME || 'WasteScheduler Nigeria Ltd'}
        </div>
      </div>
      `}
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} WasteScheduler Nigeria · Building a Cleaner Nigeria 🇳🇬<br/>
      Generated: ${new Date().toLocaleString('en-NG')}
    </div>
    <div class="ng-bar"></div>
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('[receipt]', err);
    res.status(500).json({ message: 'Failed to generate receipt' });
  }
});
