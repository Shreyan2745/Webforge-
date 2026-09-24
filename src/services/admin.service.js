// Admin: create staff accounts (SPOT_REGISTRAR / ADMIN), list users
// Services own the business rules. They throw ApiError and emit events after commit.

async function createStaff() { throw new Error('createStaff not implemented'); }
async function listUsers() { throw new Error('listUsers not implemented'); }

module.exports = { createStaff, listUsers };
