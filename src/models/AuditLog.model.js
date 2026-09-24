const mongoose = require('mongoose');

/*
 * AuditLog
 * - actor (ObjectId -> User, null = SYSTEM), actorRole
 * - action (event name, e.g. WORKSHOP_CANCELLED)
 * - resourceType, resourceId
 * - metadata (Mixed: from, to, reason, ...)
 * - ip, userAgent
 * - indexes: { createdAt: -1 }, { actor: 1 }, { resourceType: 1, resourceId: 1 }
 */

// TODO(build): define fields, indexes and hooks from the spec above.
const auditLogSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
