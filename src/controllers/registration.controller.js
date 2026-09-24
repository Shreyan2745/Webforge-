const registrationService = require('../services/registration.service');
const { sendSuccess } = require('../utils/apiResponse');
const { contextFrom } = require('../utils/requestContext');

async function register(req, res) {
  const registration = await registrationService.registerForWorkshop(req.params.id, contextFrom(req));
  const message =
    registration.status === 'CONFIRMED'
      ? 'You are confirmed for this workshop'
      : `Workshop is full - you are #${registration.waitlistPosition} on the waitlist`;
  sendSuccess(res, { statusCode: 201, message, data: { registration } });
}

async function listMine(req, res) {
  const data = await registrationService.listMyRegistrations(req.user.id, req.query);
  sendSuccess(res, { message: 'Your registrations', data });
}

async function getById(req, res) {
  const registration = await registrationService.getRegistration(req.params.id, contextFrom(req));
  sendSuccess(res, { data: { registration } });
}

async function cancel(req, res) {
  const data = await registrationService.cancelRegistration(req.params.id, req.body, contextFrom(req));
  const message = data.promoted.length ? 'Registration cancelled - the next person on the waitlist got the seat' : 'Registration cancelled';
  sendSuccess(res, { message, data });
}

async function changeStatus(req, res) {
  const data = await registrationService.changeRegistrationStatus(req.params.id, req.body, contextFrom(req));
  sendSuccess(res, { message: `Registration is now ${data.registration.status}`, data });
}

module.exports = { register, listMine, getById, cancel, changeStatus };
