const { z } = require('zod');
const { REGISTRATION_STATUS: R } = require('../constants/enums');

const reason = z.string().trim().min(1).max(300);

const myQuery = z.object({
  status: z.enum(Object.values(R)).optional(),
});

const cancel = z.object({ reason: reason.optional() });

// Admin "manage registration status" - every move is still checked by the state machine
const changeStatus = z.object({
  status: z.enum([R.CONFIRMED, R.CANCELLED, R.ATTENDED, R.NO_SHOW], {
    error: 'status must be CONFIRMED, CANCELLED, ATTENDED or NO_SHOW',
  }),
  reason: reason.optional(),
});

module.exports = { myQuery, cancel, changeStatus };
