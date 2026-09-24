// Waitlist promotion (R11, R12). Always called inside the caller's transaction session.
// Services own the business rules. They throw ApiError and emit events after commit.

async function promoteNext() { throw new Error('promoteNext not implemented'); }
async function promoteMany() { throw new Error('promoteMany not implemented'); }

module.exports = { promoteNext, promoteMany };
