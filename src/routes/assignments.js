const express = require('express');
const { body, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── Health check (public) ─────────────────────────────────────
router.get('/health', async (req, res) => {
  try {
    const count = await prisma.assignment.count();
    res.json({ 
      status: 'ok',
      route: 'assignments',
      message: 'Assignments route is working',
      assignmentCount: count
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      message: err.message
    });
  }
});

// ── GET /api/assignments  (admin sees all, collector sees own) ─
router.get('/', authenticate, async (req, res) => {
  try {
    console.log(`[GET /assignments] User role: ${req.user.role}, ID: ${req.user.id}`);
    
    const where = req.user.role === 'admin'
      ? {}
      : { collectorId: req.user.id };

    if (req.query.status) where.status = req.query.status;

    console.log(`[GET /assignments] Query where: ${JSON.stringify(where)}`);
    
    const assignments = await prisma.assignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: { select: { id: true, name: true, email: true, avatarUrl: true } },
        collector: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { messages: true } },
      },
    });

    console.log(`[GET /assignments] Found ${assignments.length} assignments`);

    // Unread message counts per assignment
    const unreadCounts = await Promise.all(
      assignments.map(a =>
        prisma.assignmentMessage.count({
          where: { assignmentId: a.id, isRead: false, senderId: { not: req.user.id } },
        })
      )
    );

    const result = assignments.map((a, i) => ({ ...a, unreadMessages: unreadCounts[i] }));
    res.json({ assignments: result });
  } catch (err) {
    console.error('[GET /assignments] ERROR:', err.message, err.code);
    res.status(500).json({ message: `Failed to fetch assignments: ${err.message}` });
  }
});

// ── GET /api/assignments/:id ──────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        admin: { select: { id: true, name: true, email: true, avatarUrl: true } },
        collector: { select: { id: true, name: true, email: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, name: true, role: true, avatarUrl: true } } },
        },
      },
    });

    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    // Only admin or assigned collector can view
    if (req.user.role !== 'admin' && assignment.collectorId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark messages as read
    await prisma.assignmentMessage.updateMany({
      where: { assignmentId: id, isRead: false, senderId: { not: req.user.id } },
      data: { isRead: true },
    });

    res.json({ assignment });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch assignment' });
  }
});

// ── POST /api/assignments  (admin only) ───────────────────────
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('collectorId').isInt({ min: 1 }).withMessage('Collector is required'),
    body('scheduleId').optional().isInt({ min: 1 }).withMessage('Invalid schedule'),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('dueDate').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const { title, description, collectorId, scheduleId, zoneId, priority, dueDate, notes } = req.body;

      const numericCollectorId = Number(collectorId);
      const numericScheduleId = scheduleId ? Number(scheduleId) : null;
      const [collector, schedule] = await Promise.all([
        prisma.user.findFirst({ where: { id: numericCollectorId, role: 'collector', isActive: true }, select: { id: true } }),
        numericScheduleId ? prisma.pickupSchedule.findUnique({ where: { id: numericScheduleId } }) : null,
      ]);
      if (!collector) return res.status(422).json({ message: 'Selected collector is not available' });
      if (numericScheduleId && !schedule) return res.status(404).json({ message: 'Schedule not found' });
      if (numericScheduleId && schedule.collectorId && schedule.collectorId !== numericCollectorId) {
        return res.status(409).json({ message: 'Schedule is already assigned to another collector' });
      }

      const assignment = await prisma.$transaction(async (tx) => {
        const created = await tx.assignment.create({
          data: {
            title,
            description,
            adminId: req.user.id,
            collectorId: numericCollectorId,
            scheduleId: numericScheduleId || undefined,
            zoneId: zoneId ? Number(zoneId) : undefined,
            priority: priority || 'normal',
            dueDate: dueDate ? new Date(dueDate) : undefined,
            notes,
          },
          include: {
            admin: { select: { id: true, name: true } },
            collector: { select: { id: true, name: true, email: true } },
          },
        });
        if (numericScheduleId) {
          await tx.pickupSchedule.update({ where: { id: numericScheduleId }, data: { collectorId: numericCollectorId } });
        }
        await tx.notification.create({
          data: {
            userId: numericCollectorId,
            title: `📋 New Assignment: ${title}`,
            message: `You have been assigned a new task by admin. Priority: ${priority || 'normal'}. Check your assignments tab.`,
            channel: 'in_app',
            sentAt: new Date(),
          },
        });
        return created;
      });

      res.status(201).json({ assignment });
    } catch (err) {
      console.error('[POST /assignments]', err);
      res.status(500).json({ message: 'Failed to create assignment' });
    }
  }
);

// ── PUT /api/assignments/:id  (status updates by collector, notes by admin) ──
router.put(
  '/:id',
  authenticate,
  [
    body('status').optional().isIn(['pending', 'accepted', 'in_progress', 'completed', 'rejected']),
    body('notes').optional().isString(),
    body('proofImageUrl').optional().isURL(),
  ],
  validate,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await prisma.assignment.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ message: 'Assignment not found' });

      // Only admin or assigned collector
      if (req.user.role !== 'admin' && existing.collectorId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const data = {};
      if (req.body.status) {
        data.status = req.body.status;
        if (req.body.status === 'completed') data.completedAt = new Date();
      }
      if (req.body.notes !== undefined) data.notes = req.body.notes;
      if (req.body.proofImageUrl) data.proofImageUrl = req.body.proofImageUrl;
      if (req.body.title && req.user.role === 'admin') data.title = req.body.title;
      if (req.body.description && req.user.role === 'admin') data.description = req.body.description;
      if (req.body.priority && req.user.role === 'admin') data.priority = req.body.priority;
      if (req.body.dueDate && req.user.role === 'admin') data.dueDate = new Date(req.body.dueDate);

      const assignment = await prisma.assignment.update({
        where: { id },
        data,
        include: {
          admin: { select: { id: true, name: true } },
          collector: { select: { id: true, name: true } },
        },
      });

      if (existing.scheduleId && req.body.status) {
        const scheduleStatus = req.body.status === 'completed'
          ? 'completed'
          : req.body.status === 'rejected'
            ? 'cancelled'
            : undefined;
        if (scheduleStatus) {
          await prisma.pickupSchedule.update({ where: { id: existing.scheduleId }, data: { status: scheduleStatus } });
        }
      }

      // Notify admin when collector updates status
      if (req.body.status && req.user.role === 'collector') {
        await prisma.notification.create({
          data: {
            userId: existing.adminId,
            title: `Assignment "${existing.title}" — Status Updated`,
            message: `Collector ${req.user.name || 'Collector'} updated assignment status to: ${req.body.status}`,
            channel: 'in_app',
            sentAt: new Date(),
          },
        });
      }

      res.json({ assignment });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ message: 'Assignment not found' });
      res.status(500).json({ message: 'Failed to update assignment' });
    }
  }
);

// ── POST /api/assignments/:id/messages  (admin or collector) ──
router.post(
  '/:id/messages',
  authenticate,
  [body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 1000 })],
  validate,
  async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id);
      const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

      if (req.user.role !== 'admin' && assignment.collectorId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const msg = await prisma.assignmentMessage.create({
        data: {
          assignmentId,
          senderId: req.user.id,
          message: req.body.message,
        },
        include: { sender: { select: { id: true, name: true, role: true, avatarUrl: true } } },
      });

      // Notify the other party
      const notifyUserId = req.user.id === assignment.adminId
        ? assignment.collectorId
        : assignment.adminId;

      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          title: `💬 New message on "${assignment.title}"`,
          message: req.body.message.slice(0, 100),
          channel: 'in_app',
          sentAt: new Date(),
        },
      });

      res.status(201).json({ message: msg });
    } catch (err) {
      res.status(500).json({ message: 'Failed to send message' });
    }
  }
);

// ── DELETE /api/assignments/:id  (admin only) ─────────────────
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await prisma.assignment.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: 'Failed to delete assignment' });
  }
});

module.exports = router;
