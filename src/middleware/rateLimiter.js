const rateLimit = require('express-rate-limit');
const CODES = require('../constants/errorCodes');

const handler = (req, res) =>
  res.status(429).json({
    success: false,
    error: { code: CODES.RATE_LIMITED, message: 'Too many requests, please try again later', details: [] },
  });

// Relaxed limit for the whole API
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false, handler });

// Strict limit for login/register
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, handler });

module.exports = { globalLimiter, authLimiter };
