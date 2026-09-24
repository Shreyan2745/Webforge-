const bcrypt = require('bcryptjs');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const CODES = require('../constants/errorCodes');
const EVENTS = require('../constants/events');
const { ROLES } = require('../constants/enums');
const { signToken } = require('../utils/jwt');
const { emit } = require('../events/bus');

// Used when the email doesn't exist, so a failed login takes the same time either way
const DUMMY_HASH = '$2b$10$/jElG2QaknD8hM.OzFgEz.94Kt0Sr3eq8ZYUU4QNiFYtxXLLlXhNu';

async function registerUser({ name, email, password }, ctx) {
  const exists = await User.exists({ email });
  if (exists) throw ApiError.conflict(CODES.EMAIL_TAKEN, 'An account with this email already exists');

  const user = await User.create({ name, email, password, role: ROLES.USER });
  const session = signToken(user);

  emit(EVENTS.USER_REGISTERED, {
    actor: { id: String(user._id), role: user.role },
    resourceType: 'User',
    resourceId: user._id,
    data: { email: user.email },
    req: ctx,
  });

  return { user, ...session };
}

async function loginUser({ email, password }, ctx) {
  const user = await User.findOne({ email }).select('+password');
  const ok = user ? await user.comparePassword(password) : await bcrypt.compare(password, DUMMY_HASH).then(() => false);
  if (!ok) throw ApiError.unauthorized('Invalid email or password', CODES.INVALID_CREDENTIALS);

  const session = signToken(user);

  emit(EVENTS.USER_LOGGED_IN, {
    actor: { id: String(user._id), role: user.role },
    resourceType: 'User',
    resourceId: user._id,
    data: {},
    req: ctx,
  });

  return { user, ...session };
}

async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  return user;
}

module.exports = { registerUser, loginUser, getMe };
