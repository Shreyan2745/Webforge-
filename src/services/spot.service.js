const Workshop = require('../models/Workshop.model');
const Registration = require('../models/Registration.model');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const CODES = require('../constants/errorCodes');
const EVENTS = require('../constants/events');
const { ROLES, WORKSHOP_STATUS: W, REGISTRATION_STATUS: R } = require('../constants/enums');
const { withTransaction } = require('../utils/transaction');
const time = require('../utils/time');
const { emit } = require('../events/bus');
const promotionService = require('./promotion.service');
const registrationService = require('./registration.service');

const isAdmin = (actor) => actor?.role === ROLES.ADMIN;
const QUEUE_SORT = { queueSeq: 1, createdAt: 1, _id: 1 };

// R13: spot registrars only see/act on workshops assigned to them (others -> 404, nothing leaks)
function assertAssigned(ws, actor, what = 'Workshop') {
  if (!ws) throw ApiError.notFound(`${what} not found`);
  if (isAdmin(actor)) return;
  const assigned = (ws.spotRegistrars || []).some((id) => String(id) === actor.id);
  if (!assigned) throw ApiError.notFound(`${what} not found`);
}

function windowInfo(ws, now = new Date()) {
  const { opensAt, closesAt } = time.checkinWindow(ws);
  return {
    checkinOpensAt: opensAt,
    checkinClosesAt: closesAt,
    windowOpen: time.isCheckinWindowOpen(ws, now),
    noShowAllowedFrom: time.noShowAllowedFrom(ws),
    canMarkNoShow: time.canMarkNoShow(ws, now),
  };
}

function workshopSummary(ws, now) {
  return {
    id: String(ws._id),
    title: ws.title,
    venue: ws.venue,
    trainer: ws.trainer,
    status: ws.status,
    startAt: ws.startAt,
    endAt: ws.endAt,
    capacity: ws.capacity,
    seatsTaken: ws.seatsTaken,
    seatsLeft: Math.max(0, ws.capacity - ws.seatsTaken),
    ...windowInfo(ws, now),
  };
}

// ---------- GET /spot/workshops ----------
async function listAssignedWorkshops(ctx) {
  const now = new Date();
  const filter = { status: W.PUBLISHED, endAt: { $gt: now } };
  if (!isAdmin(ctx.actor)) filter.spotRegistrars = ctx.actor.id;

  const workshops = await Workshop.find(filter).sort({ startAt: 1 }).limit(50).lean();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  return workshops.map((ws) => ({ ...workshopSummary(ws, now), isToday: ws.startAt <= todayEnd }));
}

// ---------- GET /spot/workshops/:id/roster ----------
async function getRoster(workshopId, ctx) {
  const now = new Date();
  const ws = await Workshop.findById(workshopId).lean();
  if (ws && ws.status === W.DRAFT) throw ApiError.notFound('Workshop not found');
  assertAssigned(ws, ctx.actor);

  const regs = await Registration.find({ workshop: ws._id, status: { $in: [R.CONFIRMED, R.ATTENDED, R.NO_SHOW, R.WAITLISTED] } })
    .sort(QUEUE_SORT)
    .populate('user', 'name email')
    .lean();

  const person = (r) => ({
    registrationId: String(r._id),
    name: r.user?.name,
    email: r.user?.email,
    status: r.status,
  });

  const confirmed = regs.filter((r) => r.status === R.CONFIRMED).map(person);
  const attended = regs
    .filter((r) => r.status === R.ATTENDED)
    .map((r) => ({ ...person(r), checkedInAt: r.checkedInAt || null }));
  const noShow = regs.filter((r) => r.status === R.NO_SHOW).map(person);
  const waitlisted = regs
    .filter((r) => r.status === R.WAITLISTED)
    .map((r, i) => ({ ...person(r), position: i + 1, present: Boolean(r.presentAt), presentAt: r.presentAt || null }));

  const info = windowInfo(ws, now);
  // Who gets the next free seat (R12)
  const nextInLine = (info.windowOpen ? waitlisted.find((w) => w.present) : waitlisted[0]) || null;

  return {
    workshop: workshopSummary(ws, now),
    counts: {
      confirmed: confirmed.length,
      attended: attended.length,
      noShow: noShow.length,
      waitlisted: waitlisted.length,
      present: waitlisted.filter((w) => w.present).length,
    },
    nextInLine,
    confirmed,
    attended,
    noShow,
    waitlisted,
  };
}

// Populate names for promoted people so the dashboard can say who got the seat
async function describePromoted(promoted) {
  if (!promoted.length) return [];
  const users = await User.find({ _id: { $in: promoted.map((p) => p.user) } }).select('name email').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return promoted.map((p) => ({
    registrationId: String(p._id),
    name: byId.get(String(p.user))?.name,
    email: byId.get(String(p.user))?.email,
    status: p.status,
  }));
}

// ---------- PATCH /spot/registrations/:id/present ----------
async function markPresent(registrationId, ctx) {
  const result = await withTransaction(async (session) => {
    const now = new Date();
    const reg = await Registration.findById(registrationId).session(session);
    if (!reg) throw ApiError.notFound('Registration not found');
    const ws = await Workshop.findById(reg.workshop).session(session);
    assertAssigned(ws, ctx.actor, 'Registration');

    if (reg.status !== R.WAITLISTED) {
      throw ApiError.conflict(CODES.INVALID_TRANSITION, `Only WAITLISTED people can be marked present (this one is ${reg.status})`);
    }
    if (!time.isCheckinWindowOpen(ws, now)) {
      const { opensAt, closesAt } = time.checkinWindow(ws);
      throw ApiError.unprocessable(CODES.CHECKIN_WINDOW_CLOSED, `Check-in is open from ${opensAt.toISOString()} to ${closesAt.toISOString()}`);
    }

    const alreadyPresent = Boolean(reg.presentAt);
    if (!alreadyPresent) {
      reg.presentAt = now;
      await reg.save({ session });
    }

    // A seat may already be free (e.g. a no-show earlier with nobody present) -> fill it now
    const promoted = await promotionService.fillOpenSeats(ws._id, { session, now });
    return { reg, alreadyPresent, promoted };
  });

  const { reg, alreadyPresent, promoted } = result;
  if (!alreadyPresent) {
    emit(EVENTS.MARKED_PRESENT, {
      actor: ctx.actor,
      resourceType: 'Registration',
      resourceId: reg._id,
      data: { workshop: reg.workshop, user: reg.user },
      req: ctx.req,
    });
  }
  promotionService.emitPromotions(promoted, ctx);

  const fresh = await Registration.findById(reg._id).lean();
  return {
    registrationId: String(reg._id),
    status: fresh.status,
    presentAt: fresh.presentAt,
    alreadyPresent,
    position: await registrationService.waitlistPosition(fresh),
    promoted: await describePromoted(promoted),
  };
}

// ---------- check-in / no-show (reuse the registration state machine) ----------
async function checkIn(registrationId, ctx) {
  const guard = (reg, ws) => assertAssigned(ws, ctx.actor, 'Registration');
  const { reg } = await registrationService.runStatusAction(registrationId, R.ATTENDED, ctx, { guard });
  return { registrationId: String(reg._id), status: reg.status, checkedInAt: reg.checkedInAt };
}

async function markNoShow(registrationId, ctx) {
  const guard = (reg, ws) => assertAssigned(ws, ctx.actor, 'Registration');
  const { reg, promoted } = await registrationService.runStatusAction(registrationId, R.NO_SHOW, ctx, { guard, reason: 'DID_NOT_ARRIVE' });
  return {
    noShow: { registrationId: String(reg._id), status: reg.status },
    promoted: await describePromoted(promoted),
  };
}

module.exports = { listAssignedWorkshops, getRoster, markPresent, checkIn, markNoShow };
