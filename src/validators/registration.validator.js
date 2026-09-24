// Registration schemas. cancel: { reason? }. changeStatus: { status, reason }
const { z } = require('zod');
// const { objectId, paginationQuery } = require('./common.validator');
// const { ROLES, WORKSHOP_STATUS, REGISTRATION_STATUS } = require('../constants/enums');

const myQuery = z.object({}).passthrough(); // TODO
const cancel = z.object({}).passthrough(); // TODO
const changeStatus = z.object({}).passthrough(); // TODO

module.exports = { myQuery, cancel, changeStatus };
