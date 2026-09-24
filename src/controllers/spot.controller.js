const spotService = require('../services/spot.service');
const { sendSuccess } = require('../utils/apiResponse');
const { contextFrom } = require('../utils/requestContext');

async function myWorkshops(req, res) {
  const workshops = await spotService.listAssignedWorkshops(contextFrom(req));
  sendSuccess(res, { message: 'Your assigned workshops', data: { workshops } });
}

async function roster(req, res) {
  const data = await spotService.getRoster(req.params.id, contextFrom(req));
  sendSuccess(res, { message: 'Roster', data });
}

async function markPresent(req, res) {
  const data = await spotService.markPresent(req.params.id, contextFrom(req));
  const message = data.promoted.length
    ? `Marked present - a free seat was given to ${data.promoted[0].name}`
    : data.alreadyPresent
      ? 'Already marked present'
      : 'Marked present at the venue';
  sendSuccess(res, { message, data });
}

async function checkIn(req, res) {
  const data = await spotService.checkIn(req.params.id, contextFrom(req));
  sendSuccess(res, { message: 'Checked in', data });
}

async function markNoShow(req, res) {
  const data = await spotService.markNoShow(req.params.id, contextFrom(req));
  const message = data.promoted.length
    ? `Marked as no-show - seat given to ${data.promoted[0].name}`
    : 'Marked as no-show - nobody present on the waitlist, seat stays open';
  sendSuccess(res, { message, data });
}

module.exports = { myWorkshops, roster, markPresent, checkIn, markNoShow };
