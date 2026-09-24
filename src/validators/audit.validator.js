const { z } = require('zod');
const { objectId, paginationQuery } = require('./common.validator');
const EVENTS = require('../constants/events');

const listQuery = paginationQuery.extend({
  actor: z.union([objectId, z.literal('SYSTEM')]).optional(),
  actorRole: z.enum(['USER', 'SPOT_REGISTRAR', 'ADMIN', 'SYSTEM']).optional(),
  action: z.enum(Object.values(EVENTS)).optional(),
  resourceType: z.enum(['User', 'Workshop', 'Registration', 'Certificate']).optional(),
  resourceId: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = { listQuery };
