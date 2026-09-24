// Role check. Usage: authorize(ROLES.ADMIN) or authorize(ROLES.ADMIN, ROLES.SPOT_REGISTRAR)
// TODO(build: auth): throw ApiError.forbidden() when req.user.role is not allowed.

const authorize = (...roles) => (req, res, next) => next(); // placeholder

module.exports = authorize;
