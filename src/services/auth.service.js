// Auth: register (always USER), login (verify + sign JWT), getMe
// Services own the business rules. They throw ApiError and emit events after commit.

async function registerUser() { throw new Error('registerUser not implemented'); }
async function loginUser() { throw new Error('loginUser not implemented'); }
async function getMe() { throw new Error('getMe not implemented'); }

module.exports = { registerUser, loginUser, getMe };
