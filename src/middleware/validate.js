// Validates req.body / req.params / req.query against Zod schemas.
// Usage: validate({ body: schema, params: schema, query: schema })
// TODO(build: auth): on failure -> ApiError.badRequest('Validation failed', details)
//                    on success -> replace with parsed (coerced, stripped) values

const validate = (schemas = {}) => (req, res, next) => next(); // placeholder

module.exports = validate;
