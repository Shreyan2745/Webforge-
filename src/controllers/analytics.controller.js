// Admin analytics
// Controllers stay thin: read req -> call service -> sendSuccess(). Business rules live in services.
const notImplemented = require('../utils/notImplemented');
// const asyncHandler = require('../utils/asyncHandler');
// const { sendSuccess } = require('../utils/apiResponse');

module.exports = {
  overview: notImplemented('analytics.controller.overview'),
  workshop: notImplemented('analytics.controller.workshop'),
};
