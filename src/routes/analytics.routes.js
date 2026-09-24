const router = require('express').Router();
const ctrl = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/enums');
const { idParam } = require('../validators/common.validator');

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/overview', ctrl.overview);
router.get('/workshops/:id', validate({ params: idParam }), ctrl.workshop);

module.exports = router;
