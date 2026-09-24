// State machines for workshops and registrations.
// Every status change in every service MUST go through assertTransition().
// TODO(build: workshops/registrations): fill the maps and implement assertTransition.

const WORKSHOP_TRANSITIONS = {
  // DRAFT: [PUBLISHED, CANCELLED], PUBLISHED: [CANCELLED, COMPLETED], CANCELLED: [], COMPLETED: []
};

const REGISTRATION_TRANSITIONS = {
  // WAITLISTED: [CONFIRMED, CANCELLED], CONFIRMED: [CANCELLED, ATTENDED, NO_SHOW],
  // ATTENDED: [], NO_SHOW: [], CANCELLED: []
};

function assertTransition(map, from, to) {
  // TODO: throw ApiError.conflict(INVALID_TRANSITION, ...) when not allowed
}

module.exports = { WORKSHOP_TRANSITIONS, REGISTRATION_TRANSITIONS, assertTransition };
