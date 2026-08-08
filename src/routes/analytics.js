const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/analytics/dashboard  (admin) ───────────────────
router.get('/dashboard', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const [
      totalUsers,
      totalSchedules,
      completedSchedules,
      missedSchedules,
      pendingReports,
      resolvedReports,
      totalCenters,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.pickupSchedule.count(),
      prisma.pickupSchedule.count({ where: { status: 'completed' } }),
      prisma.pickupSchedule.count({ where: { status: 'missed' } }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.report.count({ where: { status: 'resolved' } }),
      prisma.recyclingCenter.count({ where: { isActive: true } }),
    ]);

    const collectionRate = totalSchedules > 0
      ? Math.round((completedSchedules / totalSchedules) * 100)
      : 0;

    res.json({
      stats: {
        totalUsers,
        totalSchedules,
        completedSchedules,
        missedSchedules,
        pendingReports,
        resolvedReports,
        totalCenters,
        collectionRate,
      },
    });
  } catch (err) {
    console.error('[analytics/dashboard]', err);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
});

// ── GET /api/analytics/schedules-by-month  (admin) ──────────
router.get('/schedules-by-month', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const records = await prisma.pickupSchedule.findMany({
      where: {
        pickupDate: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
      select: { pickupDate: true, status: true },
    });

    // Group by month
    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
      scheduled: 0,
      completed: 0,
      missed: 0,
    }));

    for (const r of records) {
      const m = new Date(r.pickupDate).getMonth(); // 0-indexed
      monthly[m].scheduled++;
      if (r.status === 'completed') monthly[m].completed++;
      if (r.status === 'missed') monthly[m].missed++;
    }

    res.json({ year, monthly });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch schedule analytics' });
  }
});

// ── GET /api/analytics/waste-by-category  (admin) ───────────
router.get('/waste-by-category', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const groups = await prisma.wasteLog.groupBy({
      by: ['categoryId'],
      _sum: { quantityKg: true },
      _count: { id: true },
    });

    const categories = await prisma.wasteCategory.findMany({
      where: { id: { in: groups.map((g) => g.categoryId) } },
      select: { id: true, name: true, color: true },
    });

    const result = groups.map((g) => {
      const cat = categories.find((c) => c.id === g.categoryId);
      return {
        categoryId: g.categoryId,
        name: cat?.name || 'Unknown',
        color: cat?.color || '#ccc',
        totalKg: g._sum.quantityKg || 0,
        logCount: g._count.id,
      };
    });

    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch waste analytics' });
  }
});

// ── GET /api/analytics/reports-by-status  (admin) ───────────
router.get('/reports-by-status', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const groups = await prisma.report.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const result = groups.map((g) => ({ status: g.status, count: g._count.id }));
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch report analytics' });
  }
});

// ── GET /api/analytics/user-registrations  (admin) ──────────
router.get('/user-registrations', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
      select: { createdAt: true },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
      count: 0,
    }));

    for (const u of users) {
      const m = new Date(u.createdAt).getMonth();
      monthly[m].count++;
    }

    res.json({ year, monthly });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch registration analytics' });
  }
});

module.exports = router;
