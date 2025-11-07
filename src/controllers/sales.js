const Sale = require('../models/Sale');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
exports.list = async (req, res) => res.json(await Sale.find());
exports.create = async (req, res) => {
const sale = await Sale.create(req.body);
await Transaction.create({ user: req.user._id, type: 'sale', amount: sale.amount, reference: `S-${Date.now()}` });
res.json(sale);
};