const config = require('../config/env');

// Options for the HTTP-only auth cookie.
function authCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // keep in sync with JWT_EXPIRES_IN
    path: '/',
  };
}

module.exports = { authCookieOptions };
