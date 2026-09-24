// Certificates: issue on workshop completion, list mine, build PDF (pdfkit), verify by code
// Services own the business rules. They throw ApiError and emit events after commit.

async function issueForWorkshop() { throw new Error('issueForWorkshop not implemented'); }
async function listMyCertificates() { throw new Error('listMyCertificates not implemented'); }
async function buildPdf() { throw new Error('buildPdf not implemented'); }
async function verifyCode() { throw new Error('verifyCode not implemented'); }

module.exports = { issueForWorkshop, listMyCertificates, buildPdf, verifyCode };
