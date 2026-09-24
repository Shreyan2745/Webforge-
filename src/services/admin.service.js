const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const CODES = require('../constants/errorCodes');
const EVENTS = require('../constants/events');
const { parsePagination, buildMeta } = require('../utils/paginate');
const { emit } = require('../events/bus');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function createStaff({ name, email, password, role }, ctx) {
  if (await User.exists({ email })) throw ApiError.conflict(CODES.EMAIL_TAKEN, 'An account with this email already exists');
  const user = await User.create({ name, email, password, role });
  emit(EVENTS.STAFF_CREATED, { actor: ctx.actor, resourceType: 'User', resourceId: user._id, data: { email, role }, req: ctx.req });
  return user;
}

async function listUsers(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { users, meta: buildMeta({ page, limit, total }) };
}

module.exports = { createStaff, listUsers };
