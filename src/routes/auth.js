const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/email.service');
const passport = require('../config/passport');

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function safeUser(user) {
  const { passwordHash, resetToken, resetExpires, ...safe } = user;
  return safe;
}

// ── POST /api/auth/register ──────────────────────────────────
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['resident', 'collector', 'admin']).withMessage('Invalid role'),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, email, password, role = 'resident', phone, address, zoneId } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ message: 'An account with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { name, email, passwordHash, role, phone, address, zoneId: zoneId ? Number(zoneId) : undefined },
      });

      const token = signToken(user);
      // Send welcome email (non-blocking)
      sendWelcomeEmail(user).catch(e => console.error('[welcome email]', e.message));
      res.status(201).json({ token, user: safeUser(user) });
    } catch (err) {
      console.error('[register]', err);
      res.status(500).json({ message: 'Registration failed' });
    }
  }
);

// ── POST /api/auth/login ─────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = signToken(user);
      res.json({ token, user: safeUser(user) });
    } catch (err) {
      console.error('[login]', err);
      res.status(500).json({ message: 'Login failed' });
    }
  }
);

// ── POST /api/auth/logout ────────────────────────────────────
// Stateless JWT: client discards the token.
// This endpoint exists for completeness (e.g. audit logging).
router.post('/logout', authenticate, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch user' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required').normalizeEmail()],
  validate,
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      // Always return 200 to prevent email enumeration
      if (!user) {
        return res.json({ message: 'If that email exists, a reset link has been sent.' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetExpires },
      });

      // In production, send email here via Nodemailer
      // For development: return token in response body
      const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      console.log(`[forgot-password] Reset URL for ${email}: ${resetUrl}`);

      res.json({ message: 'If that email exists, a reset link has been sent.', ...(process.env.NODE_ENV !== 'production' && { resetUrl }) });
    } catch (err) {
      console.error('[forgot-password]', err);
      res.status(500).json({ message: 'Failed to process request' });
    }
  }
);

// ── POST /api/auth/reset-password ────────────────────────────
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  async (req, res) => {
    try {
      const { token, password } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetExpires: { gt: new Date() },
        },
      });

      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, resetToken: null, resetExpires: null },
      });

      res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
      console.error('[reset-password]', err);
      res.status(500).json({ message: 'Failed to reset password' });
    }
  }
);

module.exports = router;

// ── GET /api/auth/google ──────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// ── GET /api/auth/google/callback ────────────────────────────
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=google_failed` }),
  (req, res) => {
    try {
      const token = signToken(req.user);
      const userJson = encodeURIComponent(JSON.stringify(safeUser(req.user)));
      // Redirect to frontend with token in URL (frontend reads and stores it)
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/callback?token=${token}&user=${userJson}`);
    } catch (err) {
      res.redirect(`${process.env.CLIENT_URL}/login?error=token_failed`);
    }
  }
);
