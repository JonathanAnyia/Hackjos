const User = require('../models/User');
const Transaction = require('../models/Transaction');
exports.users = async (req, res) => {
if(req.user.role !== 'admin') return res.status(403).json({});
res.json(await User.find().select('-password'));
};
exports.transactions = async (req, res) => {
if(req.user.role !== 'admin') return res.status(403).json({});
res.json(await Transaction.find().populate('user','name email'));
};