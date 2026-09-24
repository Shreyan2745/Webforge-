// Subscribes to every domain event and writes an AuditLog entry (best-effort: log failures, never throw).
// TODO(build: audit): loop over constants/events and bus.on(event, payload => auditService.record(payload))

module.exports = function registerAuditListener() {};
