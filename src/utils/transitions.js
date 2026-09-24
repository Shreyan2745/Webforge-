const ApiError = require('./ApiError');
const CODES = require('../constants/errorCodes');
const { WORKSHOP_STATUS: W, REGISTRATION_STATUS: R } = require('../constants/enums');

// Allowed status moves. Anything not listed is rejected with 409 INVALID_TRANSITION.
const WORKSHOP_TRANSITIONS = Object.freeze({
  [W.DRAFT]: [W.PUBLISHED, W.CANCELLED],
  [W.PUBLISHED]: [W.CANCELLED, W.COMPLETED],
  [W.CANCELLED]: [],
  [W.COMPLETED]: [],
});

const REGISTRATION_TRANSITIONS = Object.freeze({
  [R.WAITLISTED]: [R.CONFIRMED, R.CANCELLED],
  [R.CONFIRMED]: [R.CANCELLED, R.ATTENDED, R.NO_SHOW],
  [R.ATTENDED]: [],
  [R.NO_SHOW]: [],
  [R.CANCELLED]: [],
});

function canTransition(map, from, to) {
  return Boolean(map[from] && map[from].includes(to));
}

function assertTransition(map, from, to, entity = 'resource') {
  if (!canTransition(map, from, to)) {
    const allowed = map[from] && map[from].length ? map[from].join(', ') : 'none (final state)';
    throw ApiError.conflict(
      CODES.INVALID_TRANSITION,
      `Cannot change ${entity} from ${from} to ${to}. Allowed from ${from}: ${allowed}`
    );
  }
}

module.exports = { WORKSHOP_TRANSITIONS, REGISTRATION_TRANSITIONS, canTransition, assertTransition };
