const router = require('express').Router();
const ctrl = require('../controllers/certificate.controller');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/enums');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/certificate.validator');

router.get('/verify/:code', validate({ params: schemas.verifyParams }), ctrl.verify); // Public
router.get('/me', authenticate, authorize(ROLES.USER), ctrl.listMine);
router.get('/:id/pdf', authenticate, authorize(ROLES.USER), validate({ params: idParam }), ctrl.downloadPdf);

module.exports = router;
