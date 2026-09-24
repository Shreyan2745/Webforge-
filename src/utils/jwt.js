const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Payload is minimal: user id (sub) and role. The user is re-loaded on every request.
function signToken(user) {
  const token = jwt.sign({ sub: String(user._id || user.id), role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
  const { exp } = jwt.decode(token);
  return { token, expiresAt: new Date(exp * 1000) };
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { signToken, verifyToken };
