const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const schemas = require('../validators/auth.validator');

router.post('/register', authLimiter, validate({ body: schemas.register }), ctrl.register); // Public
router.post('/login', authLimiter, validate({ body: schemas.login }), ctrl.login);          // Public
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
