const router = require('express').Router();
const ctrl = require('../controllers/spot.controller');
const { authenticate } = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/enums');
const { idParam } = require('../validators/common.validator');

// Event-day dashboard. Spot registrars only act on workshops assigned to them (checked in the service).
router.use(authenticate, authorize(ROLES.SPOT_REGISTRAR, ROLES.ADMIN));

router.get('/workshops', ctrl.myWorkshops);
router.get('/workshops/:id/roster', validate({ params: idParam }), ctrl.roster);
router.patch('/registrations/:id/present', validate({ params: idParam }), ctrl.markPresent);
router.patch('/registrations/:id/check-in', validate({ params: idParam }), ctrl.checkIn);
router.patch('/registrations/:id/no-show', validate({ params: idParam }), ctrl.markNoShow);

module.exports = router;
