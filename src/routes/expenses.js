const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/expenses');
const auth = require('../middleware/auth');
router.get('/', auth, ctrl.list);
router.post('/', auth, ctrl.create);
router.delete('/:id', auth, ctrl.remove);
module.exports = router;