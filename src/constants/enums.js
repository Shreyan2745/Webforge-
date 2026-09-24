// Single source of truth for every enum used by models, validators and services.

const ROLES = Object.freeze({
  USER: 'USER',
  SPOT_REGISTRAR: 'SPOT_REGISTRAR',
  ADMIN: 'ADMIN',
});

const WORKSHOP_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
});

const REGISTRATION_STATUS = Object.freeze({
  WAITLISTED: 'WAITLISTED',
  CONFIRMED: 'CONFIRMED',
  ATTENDED: 'ATTENDED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
});

// Why a registration was cancelled (stored in cancelReason + statusHistory.reason)
const CANCEL_REASONS = Object.freeze({
  USER_CANCELLED: 'USER_CANCELLED',
  ADMIN_CANCELLED: 'ADMIN_CANCELLED',
  WORKSHOP_CANCELLED: 'WORKSHOP_CANCELLED',
  WORKSHOP_ENDED: 'WORKSHOP_ENDED',
});

module.exports = { ROLES, WORKSHOP_STATUS, REGISTRATION_STATUS, CANCEL_REASONS };
