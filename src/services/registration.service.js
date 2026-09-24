// Registrations: atomic seat claim or waitlist (R3-R6), cancel with cutoff (R7), admin status change, my registrations
// Services own the business rules. They throw ApiError and emit events after commit.

async function registerForWorkshop() { throw new Error('registerForWorkshop not implemented'); }
async function listMyRegistrations() { throw new Error('listMyRegistrations not implemented'); }
async function getRegistration() { throw new Error('getRegistration not implemented'); }
async function cancelRegistration() { throw new Error('cancelRegistration not implemented'); }
async function changeRegistrationStatus() { throw new Error('changeRegistrationStatus not implemented'); }

module.exports = { registerForWorkshop, listMyRegistrations, getRegistration, cancelRegistration, changeRegistrationStatus };
