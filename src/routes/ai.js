const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { chatWithGemini } = require('../services/ai.service');

const router = express.Router();

// ── POST /api/ai/chat ─────────────────────────────────────────
router.post(
  '/chat',
  authenticate,
  [
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 500 }),
    body('history').optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      const { message, history = [] } = req.body;
      const result = await chatWithGemini(message, history);
      res.json(result);
    } catch (err) {
      console.error('[AI route]', err);
      res.status(500).json({ message: 'AI service unavailable', success: false });
    }
  }
);

module.exports = router;
