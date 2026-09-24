// Spot registrar event-day dashboard
// Controllers stay thin: read req -> call service -> sendSuccess(). Business rules live in services.
const notImplemented = require('../utils/notImplemented');
// const asyncHandler = require('../utils/asyncHandler');
// const { sendSuccess } = require('../utils/apiResponse');

module.exports = {
  myWorkshops: notImplemented('spot.controller.myWorkshops'),
  roster: notImplemented('spot.controller.roster'),
  markPresent: notImplemented('spot.controller.markPresent'),
  checkIn: notImplemented('spot.controller.checkIn'),
  markNoShow: notImplemented('spot.controller.markNoShow'),
};
