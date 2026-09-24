const config = require('../config/env');

const baseOptions = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax',
  path: '/',
});

function setAuthCookie(res, token, expiresAt) {
  res.cookie(config.cookieName, token, { ...baseOptions(), expires: expiresAt });
}

function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, baseOptions());
}

module.exports = { setAuthCookie, clearAuthCookie };
