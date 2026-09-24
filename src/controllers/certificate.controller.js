// Certificates: list mine, PDF download, public verify
// Controllers stay thin: read req -> call service -> sendSuccess(). Business rules live in services.
const notImplemented = require('../utils/notImplemented');
// const asyncHandler = require('../utils/asyncHandler');
// const { sendSuccess } = require('../utils/apiResponse');

module.exports = {
  listMine: notImplemented('certificate.controller.listMine'),
  downloadPdf: notImplemented('certificate.controller.downloadPdf'),
  verify: notImplemented('certificate.controller.verify'),
};
