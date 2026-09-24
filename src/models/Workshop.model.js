const mongoose = require('mongoose');

/*
 * Workshop
 * - title, description, trainer, venue
 * - startAt, endAt (Date, UTC)
 * - capacity (int >= 1)
 * - seatsTaken (CONFIRMED + ATTENDED; only changed atomically, default 0)
 * - status: DRAFT | PUBLISHED | CANCELLED | COMPLETED (default DRAFT)
 * - spotRegistrars: [ObjectId -> User]
 * - noShowGraceMinutes (default from config)
 * - reminder24hSentAt, reminder1hSentAt
 * - createdBy (ObjectId -> User)
 * - indexes: { status: 1, startAt: 1 }, text index on title/description/trainer
 */

// TODO(build): define fields, indexes and hooks from the spec above.
const workshopSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Workshop', workshopSchema);
