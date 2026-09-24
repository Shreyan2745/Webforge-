const mongoose = require('mongoose');

/*
 * User
 * - name, email (unique, lowercase, trimmed)
 * - password (bcrypt hash, select: false) - hashed in a pre('save') hook
 * - role: USER | SPOT_REGISTRAR | ADMIN (default USER)
 * - methods: comparePassword(plain)
 * - toJSON: strip password and __v
 */

// TODO(build): define fields, indexes and hooks from the spec above.
const userSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
