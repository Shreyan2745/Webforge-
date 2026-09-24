// Notifications: create in-app record + send email (Nodemailer). Never throws to callers.
// Services own the business rules. They throw ApiError and emit events after commit.

async function notify() { throw new Error('notify not implemented'); }
async function notifyMany() { throw new Error('notifyMany not implemented'); }
async function listMine() { throw new Error('listMine not implemented'); }
async function markRead() { throw new Error('markRead not implemented'); }

module.exports = { notify, notifyMany, listMine, markRead };
