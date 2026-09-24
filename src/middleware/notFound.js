const ApiError = require('../utils/ApiError');
const CODES = require('../constants/errorCodes');

module.exports = (req, res, next) => {
  next(new ApiError(404, CODES.ROUTE_NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
};
