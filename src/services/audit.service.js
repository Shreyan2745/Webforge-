// Audit logs: record (best-effort) and list with filters
// Services own the business rules. They throw ApiError and emit events after commit.

async function record() { throw new Error('record not implemented'); }
async function listLogs() { throw new Error('listLogs not implemented'); }

module.exports = { record, listLogs };
