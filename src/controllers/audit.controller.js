const auditService = require('../services/audit.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const { items, meta } = await auditService.listLogs(req.query);
  sendSuccess(res, { message: 'Audit logs', data: { logs: items }, meta });
}

module.exports = { list };
