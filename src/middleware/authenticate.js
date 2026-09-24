const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User.model');

async function resolveUser(req) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return null;
  const payload = verifyToken(token); // throws JsonWebTokenError / TokenExpiredError -> 401 in error handler
  const user = await User.findById(payload.sub).lean();
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

// Requires a valid session cookie. Sets req.user = { id, name, email, role }.
async function authenticate(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) throw ApiError.unauthorized('Please log in to continue');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Public routes that behave differently for signed-in users (e.g. admins see drafts). Never throws.
async function optionalAuth(req, res, next) {
  try {
    req.user = (await resolveUser(req)) || undefined;
  } catch {
    req.user = undefined;
  }
  next();
}

module.exports = { authenticate, optionalAuth };
