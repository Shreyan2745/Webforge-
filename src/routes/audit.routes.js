const router = require('express').Router();
const ctrl = require('../controllers/audit.controller');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/enums');
const schemas = require('../validators/audit.validator');

router.get('/', authenticate, authorize(ROLES.ADMIN), validate({ query: schemas.listQuery }), ctrl.list);

module.exports = router;
