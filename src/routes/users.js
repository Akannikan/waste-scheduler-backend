const express = require('express');
const bcrypt = require('bcryptjs');
const { body, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const prisma = new PrismaClient();
const avatarDir = path.join(__dirname, '../../uploads/avatars');
fs.mkdirSync(avatarDir, { recursive: true });
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarDir,
    filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

function safeUser(user) {
  const { passwordHash, resetToken, resetExpires, ...safe } = user;
  return safe;
}

// ── GET /api/users  (admin only, paginated) ──────────────────
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['resident', 'collector', 'admin']),
    query('search').optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const where = {};
      if (req.query.role) where.role = req.query.role;
      if (req.query.search) {
        where.OR = [
          { name: { contains: req.query.search, mode: 'insensitive' } },
          { email: { contains: req.query.search, mode: 'insensitive' } },
        ];
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { zone: { select: { id: true, name: true, code: true } } },
        }),
      ]);

      res.json({
        users: users.map(safeUser),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error('[GET /users]', err);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  }
);

// ── GET /api/users/me ────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { zone: { select: { id: true, name: true, code: true } } },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

router.post('/me/avatar', authenticate, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Upload a JPG, PNG, or WebP image under 2 MB' });
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl } });
    res.json({ user: safeUser(user) });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Image must be smaller than 2 MB' });
    res.status(400).json({ message: 'Invalid profile image' });
  }
});

// ── GET /api/users/:id  (admin or self) ──────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const user = await prisma.user.findUnique({
      where: { id },
      include: { zone: { select: { id: true, name: true, code: true } } },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// ── PUT /api/users/me  (update own profile) ──────────────────
router.put(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('phone').optional({ checkFalsy: true }).isMobilePhone().withMessage('Invalid phone number'),
    body('address').optional().isString(),
    body('zoneId').optional().isInt(),
    body('state').optional().isString().isLength({ max: 60 }),
    body('lga').optional().isString().isLength({ max: 100 }),
    body('theme').optional().isIn(['light', 'dark', 'forest', 'sunset']),
    body('fontFamily').optional().isIn(['Inter', 'Poppins', 'Playfair Display', 'Nunito']),
    body('fontSize').optional().isInt({ min: 14, max: 20 }),
    body('reminderEmails').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, phone, address, zoneId, state, lga, theme, fontFamily, fontSize, reminderEmails } = req.body;
      let location = { state, lga, zoneId: zoneId ? Number(zoneId) : undefined };
      if (location.zoneId) {
        const zone = await prisma.zone.findUnique({ where: { id: location.zoneId } });
        if (!zone || (state && zone.state !== state) || (lga && zone.lga !== lga)) {
          return res.status(422).json({ message: 'State, zone, and LGA must belong together' });
        }
        location = { state: zone.state, lga: zone.lga, zoneId: zone.id };
      }
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { name, phone, address, ...location, theme, fontFamily, fontSize: fontSize ? Number(fontSize) : undefined, reminderEmails },
      });
      res.json({ user: safeUser(user) });
    } catch (err) {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  }
);

// ── PUT /api/users/me/password ───────────────────────────────
router.put(
  '/me/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });

      const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
      await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Failed to update password' });
    }
  }
);

// ── PUT /api/users/:id  (admin update any user) ──────────────
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('role').optional().isIn(['resident', 'collector', 'admin']),
    body('isActive').optional().isBoolean(),
    body('zoneId').optional().isInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, role, isActive, phone, address, zoneId } = req.body;
      const user = await prisma.user.update({
        where: { id },
        data: { name, role, isActive, phone, address, zoneId: zoneId ? Number(zoneId) : undefined },
      });
      res.json({ user: safeUser(user) });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ message: 'User not found' });
      res.status(500).json({ message: 'Failed to update user' });
    }
  }
);

// ── DELETE /api/users/:id  (admin only) ──────────────────────
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account' });
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'User not found' });
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;
