const CODES = require('../constants/errorCodes');

// Throw these from anywhere; the central error handler turns them into JSON responses.
class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message, details = [], code = CODES.VALIDATION_ERROR) {
    return new ApiError(400, code, message, details);
  }
  static unauthorized(message = 'Authentication required', code = CODES.UNAUTHENTICATED) {
    return new ApiError(401, code, message);
  }
  static forbidden(message = 'You do not have permission to do this') {
    return new ApiError(403, CODES.FORBIDDEN, message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, CODES.NOT_FOUND, message);
  }
  static conflict(code, message) {
    return new ApiError(409, code, message);
  }
  static unprocessable(code, message) {
    return new ApiError(422, code, message);
  }
}

module.exports = ApiError;
