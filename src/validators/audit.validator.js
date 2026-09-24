// Audit log schemas. listQuery: page, limit, actor, action, resourceType, from, to
const { z } = require('zod');
// const { objectId, paginationQuery } = require('./common.validator');
// const { ROLES, WORKSHOP_STATUS, REGISTRATION_STATUS } = require('../constants/enums');

const listQuery = z.object({}).passthrough(); // TODO

module.exports = { listQuery };
