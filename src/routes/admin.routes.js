const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/enums');
const schemas = require('../validators/admin.validator');

router.use(authenticate, authorize(ROLES.ADMIN));

router.post('/users', validate({ body: schemas.createStaff }), ctrl.createStaff);
router.get('/users', validate({ query: schemas.listUsersQuery }), ctrl.listUsers);

module.exports = router;
