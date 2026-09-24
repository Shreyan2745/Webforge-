// Certificate schemas. verifyParams: { code }
const { z } = require('zod');
// const { objectId, paginationQuery } = require('./common.validator');
// const { ROLES, WORKSHOP_STATUS, REGISTRATION_STATUS } = require('../constants/enums');

const verifyParams = z.object({}).passthrough(); // TODO

module.exports = { verifyParams };
