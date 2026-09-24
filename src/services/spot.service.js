// Spot registrar: assigned workshops, roster, mark present, check-in, no-show + promote (R12, R13)
// Services own the business rules. They throw ApiError and emit events after commit.

async function listAssignedWorkshops() { throw new Error('listAssignedWorkshops not implemented'); }
async function getRoster() { throw new Error('getRoster not implemented'); }
async function markPresent() { throw new Error('markPresent not implemented'); }
async function checkIn() { throw new Error('checkIn not implemented'); }
async function markNoShow() { throw new Error('markNoShow not implemented'); }

module.exports = { listAssignedWorkshops, getRoster, markPresent, checkIn, markNoShow };
