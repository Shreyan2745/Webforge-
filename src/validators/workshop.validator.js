// Workshop schemas. create: title, description, trainer, venue, startAt, endAt (> startAt, future), capacity (int >= 1), noShowGraceMinutes?
const { z } = require('zod');
// const { objectId, paginationQuery } = require('./common.validator');
// const { ROLES, WORKSHOP_STATUS, REGISTRATION_STATUS } = require('../constants/enums');

const create = z.object({}).passthrough(); // TODO
const update = z.object({}).passthrough(); // TODO
const changeStatus = z.object({}).passthrough(); // TODO
const assignSpotRegistrars = z.object({}).passthrough(); // TODO
const listQuery = z.object({}).passthrough(); // TODO
const participantsQuery = z.object({}).passthrough(); // TODO

module.exports = { create, update, changeStatus, assignSpotRegistrars, listQuery, participantsQuery };
