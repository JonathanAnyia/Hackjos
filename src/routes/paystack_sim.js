const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// initialize - simulated
router.post('/initialize', async (req, res) => {
const { email, amount, userId } = req.body;
const reference = `SIM-${uuidv4()}`;
// create pending transaction
await Transaction.create({ user: userId, type: 'deposit', amount, reference, meta: { simulated: true }, createdAt: new Date() });
return res.json({ status: true, data: { authorization_url: `https://paystack.sim/checkout/${reference}`, reference } });
});


// verify - simulated: mark tx as success and credit wallet
router.post('/verify', async (req, res) => {
const { reference } = req.body;
const tx = await Transaction.findOne({ reference });
if(!tx) return res.status(404).json({ status: false, message: 'Not found' });
// credit user wallet
const user = await User.findById(tx.user);
user.walletBalance += tx.amount;
await user.save();
tx.meta.verified = true;
await tx.save();
res.json({ status: true, message: 'verified', reference });
});


module.exports = router;