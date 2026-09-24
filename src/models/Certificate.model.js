const mongoose = require('mongoose');

/*
 * Certificate
 * - user, workshop, registration (unique)
 * - verificationCode (unique, random)
 * - issuedAt
 */

// TODO(build): define fields, indexes and hooks from the spec above.
const certificateSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);
