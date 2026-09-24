const mongoose = require('mongoose');

/*
 * Registration
 * - user, workshop (ObjectId refs)
 * - status: WAITLISTED | CONFIRMED | ATTENDED | NO_SHOW | CANCELLED
 * - isActive (false only when CANCELLED)
 * - presentAt (waitlisted person confirmed at venue), checkedInAt, cancelledAt, cancelReason
 * - statusHistory: [{ status, at, by, byRole, reason }]
 * - createdAt = waitlist queue order (no stored position)
 * - indexes: unique { user, workshop } partial where isActive: true
 *            { workshop, status, createdAt }
 */

// TODO(build): define fields, indexes and hooks from the spec above.
const registrationSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Registration', registrationSchema);
