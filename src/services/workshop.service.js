const Workshop = require('../models/Workshop.model');
const Registration = require('../models/Registration.model');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const CODES = require('../constants/errorCodes');
const EVENTS = require('../constants/events');
const { ROLES, WORKSHOP_STATUS: W, REGISTRATION_STATUS: R, CANCEL_REASONS } = require('../constants/enums');
const { WORKSHOP_TRANSITIONS, assertTransition } = require('../utils/transitions');
const { parsePagination, buildMeta } = require('../utils/paginate');
const { withTransaction } = require('../utils/transaction');
const { emit } = require('../events/bus');
const promotionService = require('./promotion.service');

const PUBLIC_STATUSES = [W.PUBLISHED, W.COMPLETED, W.CANCELLED];
const EDITABLE_STATUSES = [W.DRAFT, W.PUBLISHED];
const SCHEDULE_FIELDS = ['startAt', 'endAt', 'venue'];
const SORT_MAP = {
  startAt: { startAt: 1, _id: 1 },
  '-startAt': { startAt: -1, _id: -1 },
  createdAt: { createdAt: 1, _id: 1 },
  '-createdAt': { createdAt: -1, _id: -1 },
  title: { title: 1, _id: 1 },
  '-title': { title: -1, _id: -1 },
};

const isAdmin = (user) => user?.role === ROLES.ADMIN;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SYSTEM = { id: null, role: 'SYSTEM' };

function emitEvent(event, ws, ctx, data = {}) {
  emit(event, { actor: ctx.actor, resourceType: 'Workshop', resourceId: ws._id, data, req: ctx.req });
}

// Shape returned to clients. Non-admins don't see staff assignments or internal fields.
function toView(ws, user) {
  const json = typeof ws.toJSON === 'function' ? ws.toJSON() : ws;
  if (!isAdmin(user)) {
    delete json.spotRegistrars;
    delete json.createdBy;
    delete json.noShowGraceMinutes;
  }
  return json;
}

async function findOr404(id, session) {
  const ws = await Workshop.findById(id).session(session || null);
  if (!ws) throw ApiError.notFound('Workshop not found');
  return ws;
}

// ---------- Catalogue ----------

/** Pure function (unit-tested): turns validated query + viewer into a Mongo filter. */
function buildListFilter(query, user, now = new Date()) {
  const filter = {};
  const admin = isAdmin(user);

  if (query.status) {
    if (!admin && !PUBLIC_STATUSES.includes(query.status)) filter._id = { $exists: false }; // DRAFT hidden -> empty
    else filter.status = query.status;
  } else if (!admin) {
    filter.status = W.PUBLISHED; // default public catalogue
  }

  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { trainer: rx }];
  }
  if (query.trainer) filter.trainer = new RegExp(escapeRegex(query.trainer), 'i');

  const startAt = {};
  if (query.from) startAt.$gte = query.from;
  if (query.to) startAt.$lte = query.to;
  if (query.upcoming) startAt.$gt = now;
  if (Object.keys(startAt).length) filter.startAt = startAt;

  return filter;
}

async function listWorkshops(query, user) {
  const { page, limit, skip } = parsePagination(query);
  const filter = buildListFilter(query, user);
  const [items, total] = await Promise.all([
    Workshop.find(filter).sort(SORT_MAP[query.sort] || SORT_MAP.startAt).skip(skip).limit(limit),
    Workshop.countDocuments(filter),
  ]);
  return { items: items.map((ws) => toView(ws, user)), meta: buildMeta({ page, limit, total }) };
}

async function getWorkshop(id, user) {
  const ws = await Workshop.findById(id);
  if (!ws || (!isAdmin(user) && ws.status === W.DRAFT)) throw ApiError.notFound('Workshop not found');
  return toView(ws, user);
}

// ---------- Admin management ----------

async function createWorkshop(data, ctx) {
  const ws = await Workshop.create({ ...data, status: W.DRAFT, seatsTaken: 0, createdBy: ctx.actor.id });
  emitEvent(EVENTS.WORKSHOP_CREATED, ws, ctx, { title: ws.title });
  return toView(ws, { role: ROLES.ADMIN });
}

async function updateWorkshop(id, data, ctx) {
  const now = new Date();

  const { ws, changes, promoted } = await withTransaction(async (session) => {
    const ws = await findOr404(id, session);

    if (!EDITABLE_STATUSES.includes(ws.status)) {
      throw ApiError.conflict(CODES.WORKSHOP_NOT_EDITABLE, `A ${ws.status} workshop cannot be edited`);
    }

    const touchesSchedule = data.startAt !== undefined || data.endAt !== undefined;
    if (touchesSchedule) {
      if (ws.startAt <= now) {
        throw ApiError.conflict(CODES.WORKSHOP_NOT_EDITABLE, 'The workshop has already started, its schedule cannot change');
      }
      const newStart = data.startAt ?? ws.startAt;
      const newEnd = data.endAt ?? ws.endAt;
      if (newStart <= now) throw ApiError.badRequest('Validation failed', [{ location: 'body', field: 'startAt', message: 'startAt must be in the future' }]);
      if (newEnd <= newStart) throw ApiError.badRequest('Validation failed', [{ location: 'body', field: 'endAt', message: 'endAt must be after startAt' }]);
    }

    // R9: capacity can never drop below booked seats
    if (data.capacity !== undefined && data.capacity < ws.seatsTaken) {
      throw ApiError.conflict(
        CODES.CAPACITY_BELOW_BOOKED,
        `Capacity cannot be lower than the ${ws.seatsTaken} seats already booked`
      );
    }

    const changes = {};
    for (const [key, value] of Object.entries(data)) {
      const before = ws[key] instanceof Date ? ws[key].toISOString() : ws[key];
      const after = value instanceof Date ? value.toISOString() : value;
      if (before !== after) {
        changes[key] = { from: before, to: after };
        ws[key] = value;
      }
    }
    if (!Object.keys(changes).length) return { ws, changes, promoted: [] };

    await ws.save({ session });

    // R9: more capacity -> pull people off the waitlist
    let promoted = [];
    if (changes.capacity && changes.capacity.to > changes.capacity.from && ws.status === W.PUBLISHED) {
      promoted = await promotionService.fillOpenSeats(ws, { session, actor: ctx.actor });
    }
    return { ws, changes, promoted };
  });

  if (Object.keys(changes).length) {
    // R10: schedule/venue change on a live workshop -> registrants get notified
    const notifyRegistrants = ws.status === W.PUBLISHED && SCHEDULE_FIELDS.some((f) => changes[f]);
    emitEvent(EVENTS.WORKSHOP_UPDATED, ws, ctx, { changes, notifyRegistrants });
    promotionService.emitPromotions(promoted, ctx);
  }

  return { workshop: toView(ws, { role: ROLES.ADMIN }), changes, promotedCount: promoted.length };
}

function historyEntry(status, actor, reason) {
  return { status, at: new Date(), by: actor?.id || null, byRole: actor?.role || 'SYSTEM', reason };
}

async function changeWorkshopStatus(id, { status, reason }, ctx) {
  const now = new Date();

  const result = await withTransaction(async (session) => {
    const ws = await findOr404(id, session);
    const from = ws.status;
    assertTransition(WORKSHOP_TRANSITIONS, from, status, 'workshop');

    let affected = { cancelled: [], noShow: [] };

    if (status === W.PUBLISHED) {
      if (ws.startAt <= now) {
        throw ApiError.unprocessable(CODES.WORKSHOP_IN_PAST, 'Cannot publish a workshop whose start time has passed');
      }
      ws.publishedAt = now;
    }

    if (status === W.CANCELLED) {
      // R8: cascade to every live registration
      const live = await Registration.find({ workshop: ws._id, status: { $in: [R.CONFIRMED, R.WAITLISTED] } })
        .select('user status')
        .session(session)
        .lean();
      if (live.length) {
        await Registration.updateMany(
          { _id: { $in: live.map((r) => r._id) } },
          {
            $set: { status: R.CANCELLED, isActive: false, cancelledAt: now, cancelReason: CANCEL_REASONS.WORKSHOP_CANCELLED },
            $push: { statusHistory: historyEntry(R.CANCELLED, ctx.actor, reason || CANCEL_REASONS.WORKSHOP_CANCELLED) },
          },
          { session }
        );
      }
      affected.cancelled = live;
      ws.seatsTaken = 0;
      ws.cancelledAt = now;
      ws.cancelReason = reason;
    }

    if (status === W.COMPLETED) {
      if (now < ws.endAt) {
        throw ApiError.unprocessable(CODES.WORKSHOP_NOT_ENDED, 'A workshop can only be completed after it ends');
      }
      // R14: whoever never checked in is a no-show; leftover waitlist is closed
      const [confirmed, waitlisted] = await Promise.all([
        Registration.find({ workshop: ws._id, status: R.CONFIRMED }).select('user status').session(session).lean(),
        Registration.find({ workshop: ws._id, status: R.WAITLISTED }).select('user status').session(session).lean(),
      ]);
      if (confirmed.length) {
        await Registration.updateMany(
          { _id: { $in: confirmed.map((r) => r._id) } },
          { $set: { status: R.NO_SHOW }, $push: { statusHistory: historyEntry(R.NO_SHOW, SYSTEM, CANCEL_REASONS.WORKSHOP_ENDED) } },
          { session }
        );
      }
      if (waitlisted.length) {
        await Registration.updateMany(
          { _id: { $in: waitlisted.map((r) => r._id) } },
          {
            $set: { status: R.CANCELLED, isActive: false, cancelledAt: now, cancelReason: CANCEL_REASONS.WORKSHOP_ENDED },
            $push: { statusHistory: historyEntry(R.CANCELLED, SYSTEM, CANCEL_REASONS.WORKSHOP_ENDED) },
          },
          { session }
        );
      }
      affected = { noShow: confirmed, cancelled: waitlisted };
      ws.seatsTaken = await Registration.countDocuments({ workshop: ws._id, status: R.ATTENDED }).session(session);
      ws.completedAt = now;
    }

    ws.status = status;
    await ws.save({ session });
    return { ws, from, affected };
  });

  const { ws, from, affected } = result;
  const eventByStatus = {
    [W.PUBLISHED]: EVENTS.WORKSHOP_PUBLISHED,
    [W.CANCELLED]: EVENTS.WORKSHOP_CANCELLED,
    [W.COMPLETED]: EVENTS.WORKSHOP_COMPLETED,
  };
  emitEvent(eventByStatus[status], ws, ctx, {
    from,
    to: status,
    reason,
    cancelledRegistrations: affected.cancelled.map((r) => ({ id: r._id, user: r.user, previousStatus: r.status })),
    noShowRegistrations: affected.noShow.map((r) => ({ id: r._id, user: r.user })),
  });

  return {
    workshop: toView(ws, { role: ROLES.ADMIN }),
    affected: { cancelled: affected.cancelled.length, markedNoShow: affected.noShow.length },
  };
}

async function assignSpotRegistrars(id, { userIds }, ctx) {
  const ws = await findOr404(id);
  if (!EDITABLE_STATUSES.includes(ws.status)) {
    throw ApiError.conflict(CODES.WORKSHOP_NOT_EDITABLE, `Cannot assign staff to a ${ws.status} workshop`);
  }

  const staff = await User.find({ _id: { $in: userIds }, role: ROLES.SPOT_REGISTRAR }).select('name email role');
  if (staff.length !== userIds.length) {
    const found = new Set(staff.map((u) => String(u._id)));
    const invalid = userIds.filter((uid) => !found.has(uid));
    throw new ApiError(422, CODES.INVALID_ASSIGNEE, 'Some users are not spot registrars', invalid.map((uid) => ({ field: 'userIds', message: `${uid} is not a SPOT_REGISTRAR` })));
  }

  const before = ws.spotRegistrars.map(String);
  ws.spotRegistrars = userIds;
  await ws.save();

  emitEvent(EVENTS.SPOT_REGISTRARS_ASSIGNED, ws, ctx, { from: before, to: userIds });
  return { workshop: toView(ws, { role: ROLES.ADMIN }), spotRegistrars: staff };
}

async function listParticipants(id, query) {
  const ws = await findOr404(id);
  const { page, limit, skip } = parsePagination(query);

  const filter = { workshop: ws._id };
  if (query.status) filter.status = query.status;
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').lean();
    filter.user = { $in: users.map((u) => u._id) };
  }

  const [items, total, countsAgg, waitlist] = await Promise.all([
    Registration.find(filter).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit).populate('user', 'name email'),
    Registration.countDocuments(filter),
    Registration.aggregate([{ $match: { workshop: ws._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Registration.find({ workshop: ws._id, status: R.WAITLISTED }).sort({ createdAt: 1, _id: 1 }).select('_id').lean(),
  ]);

  const positions = new Map(waitlist.map((r, i) => [String(r._id), i + 1]));
  const counts = Object.fromEntries(Object.values(R).map((s) => [s, 0]));
  countsAgg.forEach((c) => { counts[c._id] = c.n; });

  const participants = items.map((reg) => ({
    id: String(reg._id),
    user: reg.user ? { id: String(reg.user._id), name: reg.user.name, email: reg.user.email } : null,
    status: reg.status,
    waitlistPosition: positions.get(String(reg._id)) || null,
    presentAt: reg.presentAt || null,
    checkedInAt: reg.checkedInAt || null,
    registeredAt: reg.createdAt,
  }));

  return {
    workshop: { id: String(ws._id), title: ws.title, status: ws.status, capacity: ws.capacity, seatsTaken: ws.seatsTaken, seatsLeft: ws.seatsLeft },
    counts,
    participants,
    meta: buildMeta({ page, limit, total }),
  };
}

module.exports = {
  buildListFilter,
  toView,
  listWorkshops,
  getWorkshop,
  createWorkshop,
  updateWorkshop,
  changeWorkshopStatus,
  assignSpotRegistrars,
  listParticipants,
};
