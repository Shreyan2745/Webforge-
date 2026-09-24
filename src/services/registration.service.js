const Workshop = require('../models/Workshop.model');
const Registration = require('../models/Registration.model');
const ApiError = require('../utils/ApiError');
const CODES = require('../constants/errorCodes');
const EVENTS = require('../constants/events');
const { ROLES, WORKSHOP_STATUS: W, REGISTRATION_STATUS: R, CANCEL_REASONS } = require('../constants/enums');
const { REGISTRATION_TRANSITIONS, assertTransition } = require('../utils/transitions');
const { withTransaction } = require('../utils/transaction');
const time = require('../utils/time');
const { emit } = require('../events/bus');
const promotionService = require('./promotion.service');

const isAdmin = (actor) => actor?.role === ROLES.ADMIN;

function historyEntry(status, actor, reason) {
  return { status, at: new Date(), by: actor?.id || null, byRole: actor?.role || 'SYSTEM', reason };
}

function emitRegEvent(event, reg, ctx, data = {}) {
  emit(event, {
    actor: ctx.actor,
    resourceType: 'Registration',
    resourceId: reg._id,
    data: { workshop: reg.workshop?._id || reg.workshop, user: reg.user?._id || reg.user, ...data },
    req: ctx.req,
  });
}

// Queue order: ticket number first, then createdAt/_id as tie-breakers (for rows without a ticket)
const QUEUE_SORT = { queueSeq: 1, createdAt: 1, _id: 1 };

// 1-based position in the workshop's waitlist (derived, never stored)
async function waitlistPosition(reg, session) {
  if (reg.status !== R.WAITLISTED) return null;
  const aheadFilter =
    reg.queueSeq != null
      ? { $or: [{ queueSeq: { $lt: reg.queueSeq } }, { queueSeq: null }] }
      : { queueSeq: null, $or: [{ createdAt: { $lt: reg.createdAt } }, { createdAt: reg.createdAt, _id: { $lt: reg._id } }] };
  const ahead = await Registration.countDocuments({
    workshop: reg.workshop?._id || reg.workshop,
    status: R.WAITLISTED,
    ...aheadFilter,
  }).session(session || null);
  return ahead + 1;
}

// What the owner is allowed to do right now (handy for any UI)
function canUserCancel(reg, ws, now = new Date()) {
  if (reg.status === R.WAITLISTED) return now < new Date(ws.endAt);
  if (reg.status === R.CONFIRMED) return time.isBeforeCancellationCutoff(ws, now);
  return false;
}

function toView(reg, ws, extra = {}) {
  const json = reg.toJSON ? reg.toJSON() : { ...reg, id: String(reg._id) };
  const workshop = ws
    ? { id: String(ws._id), title: ws.title, trainer: ws.trainer, venue: ws.venue, startAt: ws.startAt, endAt: ws.endAt, status: ws.status }
    : json.workshop;
  return {
    id: json.id,
    status: json.status,
    workshop,
    user: json.user,
    registeredAt: json.createdAt,
    cancelledAt: json.cancelledAt || null,
    cancelReason: json.cancelReason || null,
    presentAt: json.presentAt || null,
    checkedInAt: json.checkedInAt || null,
    ...extra,
  };
}

// ---------- Register (R3-R6) ----------

async function registerForWorkshop(workshopId, ctx) {
  const userId = ctx.actor.id;
  let result;
  try {
    result = await withTransaction(async (session) => {
      const now = new Date();
      const ws = await Workshop.findById(workshopId).session(session);
      if (!ws || ws.status === W.DRAFT) throw ApiError.notFound('Workshop not found');

      if (ws.status !== W.PUBLISHED) {
        throw ApiError.conflict(CODES.REGISTRATION_CLOSED, `Registration is closed: this workshop is ${ws.status}`);
      }
      if (ws.startAt <= now) {
        throw ApiError.conflict(CODES.REGISTRATION_CLOSED, 'Registration is closed: this workshop has already started');
      }

      const existing = await Registration.findOne({ user: userId, workshop: ws._id, isActive: true }).session(session).lean();
      if (existing) {
        throw ApiError.conflict(CODES.ALREADY_REGISTERED, `You already have a ${existing.status} registration for this workshop`);
      }

      // Atomic seat claim (only while seatsTaken < capacity) + queue ticket in the same write
      let updated = await Workshop.findOneAndUpdate(
        { _id: ws._id, status: W.PUBLISHED, startAt: { $gt: now }, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
        { $inc: { seatsTaken: 1, queueSeq: 1 } },
        { new: true, session }
      );
      const status = updated ? R.CONFIRMED : R.WAITLISTED;
      if (!updated) {
        // Full -> just take a ticket. Writing the workshop doc makes concurrent registrations queue up.
        updated = await Workshop.findOneAndUpdate({ _id: ws._id }, { $inc: { queueSeq: 1 } }, { new: true, session });
      }

      const [reg] = await Registration.create(
        [{ user: userId, workshop: ws._id, status, queueSeq: updated.queueSeq, statusHistory: [historyEntry(status, ctx.actor)] }],
        { session }
      );
      const position = await waitlistPosition(reg, session);
      return { reg, ws: updated, position };
    });
  } catch (err) {
    // Two identical requests raced past the check - the partial unique index stops the 2nd
    if (err.code === 11000) throw ApiError.conflict(CODES.ALREADY_REGISTERED, 'You are already registered for this workshop');
    throw err;
  }

  const { reg, ws, position } = result;
  if (reg.status === R.CONFIRMED) emitRegEvent(EVENTS.REGISTRATION_CONFIRMED, reg, ctx);
  else emitRegEvent(EVENTS.WAITLIST_JOINED, reg, ctx, { position });

  return toView(reg, ws, { waitlistPosition: position, canCancel: canUserCancel(reg, ws) });
}

// ---------- Read ----------

async function listMyRegistrations(userId, query = {}) {
  const filter = { user: userId };
  if (query.status) filter.status = query.status;

  const regs = await Registration.find(filter).sort({ createdAt: -1 }).limit(200).populate('workshop', 'title trainer venue startAt endAt status');
  const now = new Date();

  const views = await Promise.all(
    regs.map(async (reg) => {
      const ws = reg.workshop;
      return toView(reg, ws, {
        waitlistPosition: await waitlistPosition(reg),
        canCancel: ws ? canUserCancel(reg, ws, now) : false,
      });
    })
  );

  if (query.status) return { registrations: views };

  const byStart = (a, b) => new Date(a.workshop?.startAt) - new Date(b.workshop?.startAt);
  const groups = {
    upcoming: views.filter((v) => v.status === R.CONFIRMED && v.workshop && new Date(v.workshop.endAt) > now).sort(byStart),
    waitlisted: views.filter((v) => v.status === R.WAITLISTED).sort(byStart),
    past: views.filter((v) => [R.ATTENDED, R.NO_SHOW].includes(v.status) || (v.status === R.CONFIRMED && v.workshop && new Date(v.workshop.endAt) <= now)),
    cancelled: views.filter((v) => v.status === R.CANCELLED),
  };
  const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
  return { counts, groups };
}

async function getRegistration(id, ctx) {
  const reg = await Registration.findById(id).populate('workshop', 'title trainer venue startAt endAt status').populate('user', 'name email');
  // Not yours -> 404, so we don't reveal the registration exists
  if (!reg || (!isAdmin(ctx.actor) && String(reg.user._id) !== ctx.actor.id)) throw ApiError.notFound('Registration not found');

  const ws = reg.workshop;
  return toView(reg, ws, {
    user: { id: String(reg.user._id), name: reg.user.name, email: reg.user.email },
    waitlistPosition: await waitlistPosition(reg),
    canCancel: ws ? canUserCancel(reg, ws) : false,
    statusHistory: reg.statusHistory,
  });
}

// ---------- Cancel (R7) + promotion ----------

async function cancelRegistration(id, { reason } = {}, ctx) {
  const result = await withTransaction(async (session) => {
    const now = new Date();
    const reg = await Registration.findById(id).session(session);
    const admin = isAdmin(ctx.actor);
    if (!reg || (!admin && String(reg.user) !== ctx.actor.id)) throw ApiError.notFound('Registration not found');

    assertTransition(REGISTRATION_TRANSITIONS, reg.status, R.CANCELLED, 'registration');
    const ws = await Workshop.findById(reg.workshop).session(session);

    if (reg.status === R.CONFIRMED) {
      if (!admin && !time.isBeforeCancellationCutoff(ws, now)) {
        throw ApiError.unprocessable(
          CODES.CANCELLATION_CUTOFF_PASSED,
          `Confirmed seats can only be cancelled until ${time.cancellationCutoff(ws).toISOString()} (2 hours before start)`
        );
      }
      if (admin && ws.startAt <= now) {
        throw ApiError.unprocessable(CODES.CANCELLATION_CUTOFF_PASSED, 'The workshop has started - mark the attendee as NO_SHOW instead');
      }
    }

    const previousStatus = reg.status;
    reg.status = R.CANCELLED;
    reg.cancelledAt = now;
    reg.cancelReason = admin ? CANCEL_REASONS.ADMIN_CANCELLED : CANCEL_REASONS.USER_CANCELLED;
    reg.statusHistory.push(historyEntry(R.CANCELLED, ctx.actor, reason || reg.cancelReason));
    await reg.save({ session }); // pre-save sets isActive = false

    let promoted = [];
    if (previousStatus === R.CONFIRMED) {
      await Workshop.updateOne({ _id: ws._id }, { $inc: { seatsTaken: -1 } }, { session });
      promoted = await promotionService.fillOpenSeats(ws._id, { session, now });
    }
    return { reg, ws, previousStatus, promoted };
  });

  const { reg, ws, previousStatus, promoted } = result;
  emitRegEvent(EVENTS.REGISTRATION_CANCELLED, reg, ctx, {
    previousStatus,
    reason: reason || reg.cancelReason,
    promoted: promoted.map((p) => String(p._id)),
  });
  promotionService.emitPromotions(promoted, ctx);

  return {
    registration: toView(reg, ws, { canCancel: false }),
    promoted: promoted.map((p) => ({ registrationId: String(p._id), user: String(p.user) })),
  };
}

// ---------- Attendance (shared with the spot registrar dashboard) ----------

async function checkInInTx(reg, ws, ctx, session, now = new Date()) {
  assertTransition(REGISTRATION_TRANSITIONS, reg.status, R.ATTENDED, 'registration');
  if (!time.isCheckinWindowOpen(ws, now)) {
    const { opensAt, closesAt } = time.checkinWindow(ws);
    throw ApiError.unprocessable(CODES.CHECKIN_WINDOW_CLOSED, `Check-in is open from ${opensAt.toISOString()} to ${closesAt.toISOString()}`);
  }
  reg.status = R.ATTENDED;
  reg.checkedInAt = now;
  reg.statusHistory.push(historyEntry(R.ATTENDED, ctx.actor, 'CHECKED_IN'));
  await reg.save({ session });
  return { promoted: [] };
}

async function noShowInTx(reg, ws, ctx, session, now = new Date(), reason) {
  assertTransition(REGISTRATION_TRANSITIONS, reg.status, R.NO_SHOW, 'registration');
  if (!time.canMarkNoShow(ws, now)) {
    throw ApiError.unprocessable(
      CODES.NO_SHOW_TOO_EARLY,
      `No-shows can be marked from ${time.noShowAllowedFrom(ws).toISOString()} until the workshop ends`
    );
  }
  reg.status = R.NO_SHOW;
  reg.statusHistory.push(historyEntry(R.NO_SHOW, ctx.actor, reason || 'DID_NOT_ARRIVE'));
  await reg.save({ session });

  // Seat frees up -> earliest waitlisted person who is at the venue gets it (R12)
  await Workshop.updateOne({ _id: ws._id }, { $inc: { seatsTaken: -1 } }, { session });
  const promoted = await promotionService.fillOpenSeats(ws._id, { session, now, max: 1 });
  return { promoted };
}

async function manualPromoteInTx(reg, ws, ctx, session, now = new Date(), reason) {
  assertTransition(REGISTRATION_TRANSITIONS, reg.status, R.CONFIRMED, 'registration');
  if (ws.status !== W.PUBLISHED || now >= ws.endAt) {
    throw ApiError.conflict(CODES.REGISTRATION_CLOSED, `Cannot confirm seats for a ${ws.status} workshop`);
  }
  const claimed = await Workshop.findOneAndUpdate(
    { _id: ws._id, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
    { $inc: { seatsTaken: 1 } },
    { new: true, session }
  );
  if (!claimed) throw ApiError.conflict(CODES.WORKSHOP_FULL, 'No free seat - increase capacity first');
  reg.status = R.CONFIRMED;
  reg.statusHistory.push(historyEntry(R.CONFIRMED, ctx.actor, reason || 'CONFIRMED_BY_ADMIN'));
  await reg.save({ session });
  return { promoted: [] };
}

const STATUS_EVENTS = {
  [R.ATTENDED]: EVENTS.CHECKED_IN,
  [R.NO_SHOW]: EVENTS.MARKED_NO_SHOW,
  [R.CONFIRMED]: EVENTS.REGISTRATION_STATUS_CHANGED,
};

/**
 * Runs one attendance/status action in a transaction.
 * guard(reg, ws) lets callers add checks (e.g. spot registrar must be assigned).
 */
async function runStatusAction(id, action, ctx, { reason, guard } = {}) {
  const result = await withTransaction(async (session) => {
    const now = new Date();
    const reg = await Registration.findById(id).session(session);
    if (!reg) throw ApiError.notFound('Registration not found');
    const ws = await Workshop.findById(reg.workshop).session(session);
    if (guard) await guard(reg, ws);

    const previousStatus = reg.status;
    const fn = { [R.ATTENDED]: checkInInTx, [R.NO_SHOW]: noShowInTx, [R.CONFIRMED]: manualPromoteInTx }[action];
    const { promoted } = await fn(reg, ws, ctx, session, now, reason);
    return { reg, ws, previousStatus, promoted };
  });

  const { reg, ws, previousStatus, promoted } = result;
  emitRegEvent(STATUS_EVENTS[action], reg, ctx, { from: previousStatus, to: action, reason, promoted: promoted.map((p) => String(p._id)) });
  promotionService.emitPromotions(promoted, ctx);
  return { reg, ws, previousStatus, promoted };
}

// Admin: PATCH /registrations/:id/status
async function changeRegistrationStatus(id, { status, reason }, ctx) {
  if (status === R.CANCELLED) return cancelRegistration(id, { reason }, ctx);

  const { reg, ws, promoted } = await runStatusAction(id, status, ctx, { reason });
  return {
    registration: toView(reg, ws),
    promoted: promoted.map((p) => ({ registrationId: String(p._id), user: String(p.user) })),
  };
}

module.exports = {
  registerForWorkshop,
  listMyRegistrations,
  getRegistration,
  cancelRegistration,
  changeRegistrationStatus,
  runStatusAction,
  waitlistPosition,
  canUserCancel,
  toView,
  QUEUE_SORT,
};
