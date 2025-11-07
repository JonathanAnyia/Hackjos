const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sales');
const auth = require('../middleware/auth');
router.get('/', auth, ctrl.list);
router.post('/', auth, ctrl.create);
module.exports = router;