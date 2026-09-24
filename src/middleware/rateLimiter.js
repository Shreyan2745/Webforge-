const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const CODES = require('../constants/errorCodes');

const handler = (req, res) =>
  res.status(429).json({
    success: false,
    error: { code: CODES.RATE_LIMITED, message: 'Too many requests, please try again later', details: [] },
  });

// Relaxed limit for the whole API
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.rateLimit.globalMax, standardHeaders: true, legacyHeaders: false, handler });

// Strict limit for login/register
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.rateLimit.authMax, standardHeaders: true, legacyHeaders: false, handler });

module.exports = { globalLimiter, authLimiter };
