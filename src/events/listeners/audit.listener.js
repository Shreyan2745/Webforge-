const { bus } = require('../bus');
const EVENTS = require('../../constants/events');
const auditService = require('../../services/audit.service');

// Every domain event becomes one audit log entry.
module.exports = function registerAuditListener() {
  for (const event of Object.values(EVENTS)) {
    bus.on(event, (payload) => {
      auditService.record(payload); // best-effort, never throws
    });
  }
};
