const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { JWT_SECRET } = require('../config/auth');

const prisma = new PrismaClient();

/**
 * Verifies the Bearer token and attaches decoded user to req.user
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true, zoneId: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Account is inactive or no longer exists' });
    }
    req.user = { id: user.id, email: user.email, role: user.role, zoneId: user.zoneId };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired, please log in again' });
    }
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token' });
    console.error('[authenticate]', err.message);
    return res.status(500).json({ message: 'Authentication service unavailable' });
  }
}

/**
 * Role-based access control.
 * Usage: authorize(['admin']) or authorize(['admin', 'collector'])
 */
function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
