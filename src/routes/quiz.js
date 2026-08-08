const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/quiz  (all active quizzes) ──────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { isActive: true },
      include: { _count: { select: { questions: true, attempts: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ quizzes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch quizzes' });
  }
});

// ── GET /api/quiz/:id  (quiz with questions) ─────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { questions: { orderBy: { id: 'asc' } } },
    });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    // Remove correct answers from response (prevent cheating)
    const safeQuiz = {
      ...quiz,
      questions: quiz.questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
        points: q.points,
        // correctAnswer NOT sent to client
      })),
    };

    res.json({ quiz: safeQuiz });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch quiz' });
  }
});

// ── POST /api/quiz/:id/submit ────────────────────────────────
router.post(
  '/:id/submit',
  authenticate,
  [
    body('answers').isObject().withMessage('Answers must be an object { questionId: selectedIndex }'),
  ],
  validate,
  async (req, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const { answers } = req.body;

      const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: { questions: true },
      });
      if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

      let score = 0;
      let totalPoints = 0;
      const results = [];

      for (const question of quiz.questions) {
        totalPoints += question.points;
        const userAnswer = answers[question.id];
        const correct = userAnswer === question.correctAnswer;
        if (correct) score += question.points;

        results.push({
          questionId: question.id,
          question: question.question,
          correctAnswer: question.correctAnswer,
          userAnswer,
          correct,
          explanation: question.explanation,
          points: correct ? question.points : 0,
        });
      }

      const passed = score >= totalPoints * 0.6; // 60% to pass
      const earnedPoints = passed ? score + quiz.points : Math.floor(score / 2);

      // Save attempt
      const attempt = await prisma.quizAttempt.create({
        data: {
          userId: req.user.id,
          quizId,
          score,
          totalPoints,
          passed,
          answers: answers,
        },
      });

      // Update user points
      await prisma.user.update({
        where: { id: req.user.id },
        data: { points: { increment: earnedPoints } },
      });

      // Update leaderboard
      await prisma.leaderboard.upsert({
        where: { userId: req.user.id },
        create: { userId: req.user.id, points: earnedPoints },
        update: { points: { increment: earnedPoints } },
      });

      // Award badge if passed and first time
      if (passed) {
        const previousAttempts = await prisma.quizAttempt.count({
          where: { userId: req.user.id, quizId, passed: true, id: { not: attempt.id } },
        });

        if (previousAttempts === 0) {
          const badge = `quiz_${quiz.category || 'master'}_${quizId}`;
          await prisma.user.update({
            where: { id: req.user.id },
            data: { badges: { push: badge } },
          });
        }
      }

      res.json({
        attempt: { id: attempt.id, score, totalPoints, passed, earnedPoints },
        results,
        message: passed
          ? `🎉 Excellent! You passed with ${score}/${totalPoints} points!`
          : `Keep trying! You scored ${score}/${totalPoints}. You need 60% to pass.`,
      });
    } catch (err) {
      console.error('[quiz submit]', err);
      res.status(500).json({ message: 'Failed to submit quiz' });
    }
  }
);

// ── GET /api/quiz/leaderboard/top ────────────────────────────
router.get('/leaderboard/top', authenticate, async (req, res) => {
  try {
    const top = await prisma.leaderboard.findMany({
      take: 20,
      orderBy: { points: 'desc' },
    });

    // Get user info for each entry
    const userIds = top.map(e => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatarUrl: true, badges: true },
    });

    const leaderboard = top.map((entry, index) => {
      const user = users.find(u => u.id === entry.userId);
      return {
        rank: index + 1,
        userId: entry.userId,
        name: user?.name || 'Anonymous',
        avatarUrl: user?.avatarUrl,
        points: entry.points,
        badges: user?.badges || [],
      };
    });

    // Get current user's rank
    const myEntry = await prisma.leaderboard.findUnique({ where: { userId: req.user.id } });
    const myRank = myEntry ? await prisma.leaderboard.count({ where: { points: { gt: myEntry.points } } }) + 1 : null;

    res.json({ leaderboard, myRank, myPoints: myEntry?.points || 0 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

// ── POST /api/quiz  (admin create quiz) ──────────────────────
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  [
    body('title').trim().notEmpty(),
    body('difficulty').isIn(['easy', 'medium', 'hard']),
    body('questions').isArray({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { title, description, category, difficulty, timeLimit, points, questions } = req.body;

      const quiz = await prisma.quiz.create({
        data: {
          title,
          description,
          category,
          difficulty,
          timeLimit: timeLimit || 30,
          points: points || 10,
          questions: {
            create: questions.map(q => ({
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              points: q.points || 5,
            })),
          },
        },
        include: { questions: true },
      });

      res.status(201).json({ quiz });
    } catch (err) {
      res.status(500).json({ message: 'Failed to create quiz' });
    }
  }
);

module.exports = router;
