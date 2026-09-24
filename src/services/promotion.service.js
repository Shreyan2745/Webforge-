// Waitlist promotion (R11, R12). Always called inside the caller's transaction session.
// TODO(component 3): implement promoteNext / fillOpenSeats with atomic findOneAndUpdate.

/**
 * Fill every open seat of a PUBLISHED workshop from its waitlist.
 * Returns the promoted registrations (so the caller can emit events after commit).
 */
async function fillOpenSeats(/* workshop, { session, actor } */) {
  return []; // no-op until component 3
}

async function promoteNext() {
  throw new Error('promoteNext not implemented');
}

// Emit WAITLIST_PROMOTED for each promoted registration (call after commit)
function emitPromotions(/* promoted, ctx */) {}

module.exports = { fillOpenSeats, promoteNext, emitPromotions };
