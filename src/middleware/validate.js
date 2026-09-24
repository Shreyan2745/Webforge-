const ApiError = require('../utils/ApiError');
const CODES = require('../constants/errorCodes');

const LOCATIONS = ['params', 'query', 'body'];

/**
 * validate({ body, params, query }) - each value is a Zod schema.
 * On success the request parts are replaced by the parsed values
 * (coerced types, trimmed strings, unknown keys stripped).
 */
const validate = (schemas = {}) => (req, res, next) => {
  const details = [];
  const parsed = {};

  for (const location of LOCATIONS) {
    const schema = schemas[location];
    if (!schema) continue;
    const result = schema.safeParse(req[location] ?? {});
    if (result.success) {
      parsed[location] = result.data;
    } else {
      for (const issue of result.error.issues) {
        details.push({ location, field: issue.path.join('.') || location, message: issue.message });
      }
    }
  }

  if (details.length) {
    const onlyBadId = details.every((d) => d.location === 'params' && d.field === 'id');
    return next(ApiError.badRequest(onlyBadId ? 'Invalid id' : 'Validation failed', details, onlyBadId ? CODES.INVALID_ID : CODES.VALIDATION_ERROR));
  }

  if (parsed.body) req.body = parsed.body;
  if (parsed.params) req.params = parsed.params;
  // Express 5 makes req.query a getter, so redefine it
  if (parsed.query) Object.defineProperty(req, 'query', { value: parsed.query, writable: true, configurable: true, enumerable: true });

  next();
};

module.exports = validate;
