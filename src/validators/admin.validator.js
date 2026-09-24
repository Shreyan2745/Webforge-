const { z } = require('zod');
const { paginationQuery } = require('./common.validator');
const { register } = require('./auth.validator');
const { ROLES } = require('../constants/enums');

// Admins create staff accounts. Public signup can only ever create USERs.
const createStaff = register.extend({
  role: z.enum([ROLES.SPOT_REGISTRAR, ROLES.ADMIN], { error: 'role must be SPOT_REGISTRAR or ADMIN' }),
});

const listUsersQuery = paginationQuery.extend({
  role: z.enum(Object.values(ROLES)).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

module.exports = { createStaff, listUsersQuery };
