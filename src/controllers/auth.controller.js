const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/apiResponse');
const { setAuthCookie, clearAuthCookie } = require('../utils/cookie');
const { requestInfo } = require('../utils/requestContext');

async function register(req, res) {
  const { user, token, expiresAt } = await authService.registerUser(req.body, requestInfo(req));
  setAuthCookie(res, token, expiresAt);
  sendSuccess(res, { statusCode: 201, message: 'Account created', data: { user } });
}

async function login(req, res) {
  const { user, token, expiresAt } = await authService.loginUser(req.body, requestInfo(req));
  setAuthCookie(res, token, expiresAt);
  sendSuccess(res, { message: 'Logged in', data: { user } });
}

async function logout(req, res) {
  clearAuthCookie(res);
  sendSuccess(res, { message: 'Logged out' });
}

async function me(req, res) {
  const user = await authService.getMe(req.user.id);
  sendSuccess(res, { data: { user } });
}

// Express 5 forwards rejected promises to the error handler automatically.
module.exports = { register, login, logout, me };
