// Registrations: register, my registrations, cancel, admin status change
// Controllers stay thin: read req -> call service -> sendSuccess(). Business rules live in services.
const notImplemented = require('../utils/notImplemented');
// const asyncHandler = require('../utils/asyncHandler');
// const { sendSuccess } = require('../utils/apiResponse');

module.exports = {
  register: notImplemented('registration.controller.register'),
  listMine: notImplemented('registration.controller.listMine'),
  getById: notImplemented('registration.controller.getById'),
  cancel: notImplemented('registration.controller.cancel'),
  changeStatus: notImplemented('registration.controller.changeStatus'),
};
