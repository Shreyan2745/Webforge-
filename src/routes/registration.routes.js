const router = require('express').Router();
const ctrl = require('../controllers/registration.controller');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/enums');
const schemas = require('../validators/registration.validator');
const { idParam } = require('../validators/common.validator');

router.use(authenticate);

router.get('/me', authorize(ROLES.USER), validate({ query: schemas.myQuery }), ctrl.listMine);
router.get('/:id', authorize(ROLES.USER, ROLES.ADMIN), validate({ params: idParam }), ctrl.getById);          // owner or admin
router.patch('/:id/cancel', authorize(ROLES.USER, ROLES.ADMIN), validate({ params: idParam, body: schemas.cancel }), ctrl.cancel);
router.patch('/:id/status', authorize(ROLES.ADMIN), validate({ params: idParam, body: schemas.changeStatus }), ctrl.changeStatus);

module.exports = router;
