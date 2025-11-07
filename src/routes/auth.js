const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth');
router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.get('/me', require('../middleware/auth'), authCtrl.me);
module.exports = router;