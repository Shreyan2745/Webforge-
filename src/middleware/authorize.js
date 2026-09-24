const ApiError = require('../utils/ApiError');

// Role check. Must run after authenticate.
// Usage: authorize(ROLES.ADMIN) or authorize(ROLES.ADMIN, ROLES.SPOT_REGISTRAR)
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!allowedRoles.includes(req.user.role)) {
    return next(ApiError.forbidden(`This action requires role: ${allowedRoles.join(' or ')}`));
  }
  next();
};

module.exports = authorize;
