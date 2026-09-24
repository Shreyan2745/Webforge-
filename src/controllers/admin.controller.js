const adminService = require('../services/admin.service');
const { sendSuccess } = require('../utils/apiResponse');
const { contextFrom } = require('../utils/requestContext');

async function createStaff(req, res) {
  const user = await adminService.createStaff(req.body, contextFrom(req));
  sendSuccess(res, { statusCode: 201, message: `${user.role} account created`, data: { user } });
}

async function listUsers(req, res) {
  const { users, meta } = await adminService.listUsers(req.query);
  sendSuccess(res, { message: 'Users', data: { users }, meta });
}

module.exports = { createStaff, listUsers };
