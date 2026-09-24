const config = require('../config/env');
const CODES = require('../constants/errorCodes');

// Central error handler. Every error ends up here and leaves as:
// { success: false, error: { code, message, details } }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || CODES.INTERNAL_ERROR;
  let message = err.message || 'Something went wrong';
  let details = err.details || [];

  // Malformed ObjectId etc.
  if (err.name === 'CastError') {
    statusCode = 400;
    code = CODES.INVALID_ID;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose schema validation
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    code = CODES.VALIDATION_ERROR;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Unique index violation
  if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyValue || err.keyPattern || {});
    code = fields.includes('email') ? CODES.EMAIL_TAKEN : CODES.DUPLICATE;
    message = fields.includes('email')
      ? 'An account with this email already exists'
      : `Duplicate value for: ${fields.join(', ')}`;
  }

  // JWT problems
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = CODES.UNAUTHENTICATED;
    message = err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token';
  }

  // Bad JSON body
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = CODES.VALIDATION_ERROR;
    message = 'Malformed JSON in request body';
  }

  if (statusCode >= 500) {
    console.error(err);
    if (config.isProd) message = 'Something went wrong';
  }

  const body = { success: false, error: { code, message, details } };
  if (!config.isProd && statusCode >= 500) body.error.stack = err.stack;
  res.status(statusCode).json(body);
}

module.exports = errorHandler;
