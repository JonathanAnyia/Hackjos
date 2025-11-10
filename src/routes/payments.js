const express = require('express');
const router = express.Router();
const paymentCtrl = require('../controllers/payments');
const auth = require('../middleware/auth');

// Routes
router.post('/create', auth, paymentCtrl.createPayment);
router.post('/webhook', paymentCtrl.handleWebhook);
router.get('/status/:ref', auth, paymentCtrl.getPaymentStatus);
router.get('/verify/:transactionId', auth, paymentCtrl.verifyPayment);
router.post('/webhook', paymentCtrl.handleWebhook);
module.exports = router;
