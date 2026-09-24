// Workshops: catalogue + admin management
// Controllers stay thin: read req -> call service -> sendSuccess(). Business rules live in services.
const notImplemented = require('../utils/notImplemented');
// const asyncHandler = require('../utils/asyncHandler');
// const { sendSuccess } = require('../utils/apiResponse');

module.exports = {
  list: notImplemented('workshop.controller.list'),
  getById: notImplemented('workshop.controller.getById'),
  create: notImplemented('workshop.controller.create'),
  update: notImplemented('workshop.controller.update'),
  changeStatus: notImplemented('workshop.controller.changeStatus'),
  assignSpotRegistrars: notImplemented('workshop.controller.assignSpotRegistrars'),
  participants: notImplemented('workshop.controller.participants'),
};
