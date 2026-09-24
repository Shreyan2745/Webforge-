const workshopService = require('../services/workshop.service');
const { sendSuccess } = require('../utils/apiResponse');
const { contextFrom } = require('../utils/requestContext');

async function list(req, res) {
  const { items, meta } = await workshopService.listWorkshops(req.query, req.user);
  sendSuccess(res, { message: 'Workshops fetched', data: { workshops: items }, meta });
}

async function getById(req, res) {
  const workshop = await workshopService.getWorkshop(req.params.id, req.user);
  sendSuccess(res, { data: { workshop } });
}

async function create(req, res) {
  const workshop = await workshopService.createWorkshop(req.body, contextFrom(req));
  sendSuccess(res, { statusCode: 201, message: 'Workshop created as DRAFT', data: { workshop } });
}

async function update(req, res) {
  const result = await workshopService.updateWorkshop(req.params.id, req.body, contextFrom(req));
  const changed = Object.keys(result.changes);
  sendSuccess(res, { message: changed.length ? `Updated: ${changed.join(', ')}` : 'Nothing changed', data: result });
}

async function changeStatus(req, res) {
  const result = await workshopService.changeWorkshopStatus(req.params.id, req.body, contextFrom(req));
  sendSuccess(res, { message: `Workshop is now ${result.workshop.status}`, data: result });
}

async function assignSpotRegistrars(req, res) {
  const result = await workshopService.assignSpotRegistrars(req.params.id, req.body, contextFrom(req));
  sendSuccess(res, { message: 'Spot registrars assigned', data: result });
}

async function participants(req, res) {
  const { meta, ...data } = await workshopService.listParticipants(req.params.id, req.query);
  sendSuccess(res, { message: 'Participants fetched', data, meta });
}

module.exports = { list, getById, create, update, changeStatus, assignSpotRegistrars, participants };
