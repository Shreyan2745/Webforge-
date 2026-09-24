// In-app notifications
// Controllers stay thin: read req -> call service -> sendSuccess(). Business rules live in services.
const notImplemented = require('../utils/notImplemented');
// const asyncHandler = require('../utils/asyncHandler');
// const { sendSuccess } = require('../utils/apiResponse');

module.exports = {
  listMine: notImplemented('notification.controller.listMine'),
  markRead: notImplemented('notification.controller.markRead'),
};
