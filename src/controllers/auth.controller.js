// Auth: register, login (sets cookie), logout (clears cookie), me
// Controllers stay thin: read req -> call service -> sendSuccess(). Business rules live in services.
const notImplemented = require('../utils/notImplemented');
// const asyncHandler = require('../utils/asyncHandler');
// const { sendSuccess } = require('../utils/apiResponse');

module.exports = {
  register: notImplemented('auth.controller.register'),
  login: notImplemented('auth.controller.login'),
  logout: notImplemented('auth.controller.logout'),
  me: notImplemented('auth.controller.me'),
};
