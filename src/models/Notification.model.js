const mongoose = require('mongoose');

/*
 * Notification
 * - user (ObjectId -> User)
 * - type (event name), title, message, data (Mixed)
 * - readAt (null = unread)
 * - index: { user: 1, createdAt: -1 }
 */

// TODO(build): define fields, indexes and hooks from the spec above.
const notificationSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
