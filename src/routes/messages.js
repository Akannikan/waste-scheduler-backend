const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/messages/inbox ───────────────────────────────────
router.get('/inbox', authenticate, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { receiverId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: { select: { id: true, name: true, role: true, avatarUrl: true } },
      },
    });
    const unread = messages.filter(m => !m.isRead).length;
    res.json({ messages, unread });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch inbox' });
  }
});

// ── GET /api/messages/sent ────────────────────────────────────
router.get('/sent', authenticate, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { senderId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        receiver: { select: { id: true, name: true, role: true, avatarUrl: true } },
      },
    });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sent messages' });
  }
});

// ── POST /api/messages  (send a message) ─────────────────────
router.post(
  '/',
  authenticate,
  [
    body('receiverId').isInt().withMessage('Receiver is required'),
    body('body').trim().notEmpty().withMessage('Message body is required').isLength({ max: 2000 }),
    body('subject').optional().isString().isLength({ max: 255 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { receiverId, subject, body: msgBody } = req.body;

      // Can't message yourself
      if (Number(receiverId) === req.user.id) {
        return res.status(400).json({ message: 'Cannot message yourself' });
      }

      const receiver = await prisma.user.findUnique({ where: { id: Number(receiverId) } });
      if (!receiver) return res.status(404).json({ message: 'Recipient not found' });

      const message = await prisma.message.create({
        data: {
          senderId: req.user.id,
          receiverId: Number(receiverId),
          subject,
          body: msgBody,
        },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          receiver: { select: { id: true, name: true, role: true } },
        },
      });

      // In-app notification
      await prisma.notification.create({
        data: {
          userId: Number(receiverId),
          title: `✉️ New message from ${req.user.name || 'Someone'}`,
          message: subject || msgBody.slice(0, 80),
          channel: 'in_app',
          sentAt: new Date(),
        },
      });

      res.status(201).json({ message });
    } catch (err) {
      res.status(500).json({ message: 'Failed to send message' });
    }
  }
);

// ── PATCH /api/messages/:id/read ─────────────────────────────
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ message: 'Not found' });
    if (msg.receiverId !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    const updated = await prisma.message.update({ where: { id }, data: { isRead: true } });
    res.json({ message: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

// ── DELETE /api/messages/:id ──────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ message: 'Not found' });
    if (msg.senderId !== req.user.id && msg.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await prisma.message.delete({ where: { id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete' });
  }
});

module.exports = router;
