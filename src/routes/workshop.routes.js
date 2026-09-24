const router = require('express').Router();
const ctrl = require('../controllers/workshop.controller');
const regCtrl = require('../controllers/registration.controller');
const { authenticate, optionalAuth } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/enums');
const schemas = require('../validators/workshop.validator');
const { idParam } = require('../validators/common.validator');

// Public catalogue (optionalAuth lets admins also see drafts)
router.get('/', optionalAuth, validate({ query: schemas.listQuery }), ctrl.list);
router.get('/:id', optionalAuth, validate({ params: idParam }), ctrl.getById);

// Admin management
router.post('/', authenticate, authorize(ROLES.ADMIN), validate({ body: schemas.create }), ctrl.create);
router.patch('/:id', authenticate, authorize(ROLES.ADMIN), validate({ params: idParam, body: schemas.update }), ctrl.update);
router.patch('/:id/status', authenticate, authorize(ROLES.ADMIN), validate({ params: idParam, body: schemas.changeStatus }), ctrl.changeStatus);
router.put('/:id/spot-registrars', authenticate, authorize(ROLES.ADMIN), validate({ params: idParam, body: schemas.assignSpotRegistrars }), ctrl.assignSpotRegistrars);
router.get('/:id/participants', authenticate, authorize(ROLES.ADMIN), validate({ params: idParam, query: schemas.participantsQuery }), ctrl.participants);

// Student registration
router.post('/:id/register', authenticate, authorize(ROLES.USER), validate({ params: idParam }), regCtrl.register);

module.exports = router;
