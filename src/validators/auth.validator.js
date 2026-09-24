// Auth schemas. register: name, email, password (min 8). Never accept role.
const { z } = require('zod');
// const { objectId, paginationQuery } = require('./common.validator');
// const { ROLES, WORKSHOP_STATUS, REGISTRATION_STATUS } = require('../constants/enums');

const register = z.object({}).passthrough(); // TODO
const login = z.object({}).passthrough(); // TODO

module.exports = { register, login };
