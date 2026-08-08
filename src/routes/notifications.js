const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/notifications  (own notifications) ──────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const where = {
      OR: [{ userId: req.user.id }, { userId: null }],
    };
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// ── POST /api/notifications  (admin: broadcast or send to user) ──
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('userId').optional().isInt().withMessage('Invalid user ID'),
    body('channel').optional().isIn(['in_app', 'email', 'push']),
  ],
  validate,
  async (req, res) => {
    try {
      const { title, message, userId, channel } = req.body;
      const notification = await prisma.notification.create({
        data: {
          title,
          message,
          userId: userId ? Number(userId) : null, // null = broadcast to all
          channel: channel || 'in_app',
          sentAt: new Date(),
        },
      });
      res.status(201).json({ notification });
    } catch (err) {
      res.status(500).json({ message: 'Failed to create notification' });
    }
  }
);

// ── PATCH /api/notifications/:id/read ────────────────────────
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    if (notification.userId && notification.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.json({ notification: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

// ── PATCH /api/notifications/read-all ────────────────────────
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { OR: [{ userId: req.user.id }, { userId: null }], isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
});

// ── DELETE /api/notifications/:id ────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    if (req.user.role !== 'admin' && notification.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prisma.notification.delete({ where: { id } });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete notification' });
  }
});

module.exports = router;
