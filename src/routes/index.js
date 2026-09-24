const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/workshops', require('./workshop.routes'));
router.use('/registrations', require('./registration.routes'));
router.use('/spot', require('./spot.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/certificates', require('./certificate.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/audit-logs', require('./audit.routes'));
router.use('/analytics', require('./analytics.routes'));

module.exports = router;
