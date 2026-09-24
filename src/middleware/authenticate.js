// Verifies the JWT from the HTTP-only cookie and attaches req.user.
// TODO(build: auth):
//   - read req.cookies[config.cookieName]
//   - jwt.verify -> load user (must still exist) -> req.user = { id, role, name, email }
//   - no/invalid token -> ApiError.unauthorized()
//   - also export optionalAuth: same, but never throws (used by public catalogue so admins see drafts)

const authenticate = (req, res, next) => next(); // placeholder
const optionalAuth = (req, res, next) => next(); // placeholder

module.exports = { authenticate, optionalAuth };
