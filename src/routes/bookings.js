const express = require('express');
const router = express.Router();
const bk = require('../controllers/bookings');
const auth = require('../middleware/auth');
router.get('/', auth, bk.list);
router.post('/', auth, bk.create);
router.put('/:id', auth, bk.update);
router.get('/:id', auth, bk.get);
module.exports = router;