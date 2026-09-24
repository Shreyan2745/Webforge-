// Admin user management (create SPOT_REGISTRAR / ADMIN accounts)
// Controllers stay thin: read req -> call service -> sendSuccess(). Business rules live in services.
const notImplemented = require('../utils/notImplemented');
// const asyncHandler = require('../utils/asyncHandler');
// const { sendSuccess } = require('../utils/apiResponse');

module.exports = {
  createStaff: notImplemented('admin.controller.createStaff'),
  listUsers: notImplemented('admin.controller.listUsers'),
};
