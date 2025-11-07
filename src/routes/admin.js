const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AdminCtrl = require('../controllers/admin');
router.use(auth);
router.get('/users', AdminCtrl.users);
router.get('/transactions', AdminCtrl.transactions);
module.exports = router;