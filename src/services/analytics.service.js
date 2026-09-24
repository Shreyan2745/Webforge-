// Analytics: aggregation pipelines for overview and per-workshop stats
// Services own the business rules. They throw ApiError and emit events after commit.

async function overview() { throw new Error('overview not implemented'); }
async function workshopStats() { throw new Error('workshopStats not implemented'); }

module.exports = { overview, workshopStats };
