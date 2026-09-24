const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/notification.validator');

router.use(authenticate);

router.get('/me', validate({ query: schemas.listQuery }), ctrl.listMine);
router.patch('/:id/read', validate({ params: idParam }), ctrl.markRead);

module.exports = router;
