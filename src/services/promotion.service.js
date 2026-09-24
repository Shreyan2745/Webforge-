const Workshop = require('../models/Workshop.model');
const Registration = require('../models/Registration.model');
const EVENTS = require('../constants/events');
const { WORKSHOP_STATUS: W, REGISTRATION_STATUS: R } = require('../constants/enums');
const { isCheckinWindowOpen } = require('../utils/time');
const { emit } = require('../events/bus');

const PROMOTION_REASON = 'PROMOTED_FROM_WAITLIST';

/**
 * R11/R12 - fill open seats of a PUBLISHED workshop from its waitlist, oldest first.
 * Before the check-in window: any waitlisted person.
 * During the check-in window: only waitlisted people marked present at the venue.
 * Must run inside the caller's transaction. Returns the promoted registrations.
 */
async function fillOpenSeats(workshopOrId, { session, now = new Date(), max = Infinity } = {}) {
  const workshopId = workshopOrId?._id || workshopOrId;
  const promoted = [];

  while (promoted.length < max) {
    const ws = await Workshop.findById(workshopId).session(session).lean();
    if (!ws || ws.status !== W.PUBLISHED || now >= ws.endAt) break;

    const queueFilter = { workshop: ws._id, status: R.WAITLISTED };
    if (isCheckinWindowOpen(ws, now)) queueFilter.presentAt = { $ne: null };

    const next = await Registration.findOne(queueFilter).sort({ createdAt: 1, _id: 1 }).session(session);
    if (!next) break;

    // Atomic seat claim - never exceeds capacity
    const claimed = await Workshop.findOneAndUpdate(
      { _id: ws._id, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
      { $inc: { seatsTaken: 1 } },
      { new: true, session }
    );
    if (!claimed) break;

    const reg = await Registration.findOneAndUpdate(
      { _id: next._id, status: R.WAITLISTED },
      {
        $set: { status: R.CONFIRMED },
        $push: { statusHistory: { status: R.CONFIRMED, at: now, by: null, byRole: 'SYSTEM', reason: PROMOTION_REASON } },
      },
      { new: true, session }
    );
    if (!reg) {
      // someone else changed it meanwhile - give the seat back and try the next person
      await Workshop.updateOne({ _id: ws._id }, { $inc: { seatsTaken: -1 } }, { session });
      continue;
    }
    promoted.push(reg);
  }

  return promoted;
}

function promoteNext(workshopOrId, opts = {}) {
  return fillOpenSeats(workshopOrId, { ...opts, max: 1 });
}

// Call AFTER the transaction commits
function emitPromotions(promoted = [], ctx = {}) {
  for (const reg of promoted) {
    emit(EVENTS.WAITLIST_PROMOTED, {
      actor: null, // SYSTEM
      resourceType: 'Registration',
      resourceId: reg._id,
      data: { workshop: reg.workshop, user: reg.user, triggeredBy: ctx.actor || null },
      req: ctx.req,
    });
  }
}

module.exports = { fillOpenSeats, promoteNext, emitPromotions, PROMOTION_REASON };
