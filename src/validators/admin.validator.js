// Admin schemas. createStaff: name, email, password, role in [SPOT_REGISTRAR, ADMIN]
const { z } = require('zod');
// const { objectId, paginationQuery } = require('./common.validator');
// const { ROLES, WORKSHOP_STATUS, REGISTRATION_STATUS } = require('../constants/enums');

const createStaff = z.object({}).passthrough(); // TODO
const listUsersQuery = z.object({}).passthrough(); // TODO

module.exports = { createStaff, listUsersQuery };
