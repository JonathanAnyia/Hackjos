const Expense = require('../models/Expense');
exports.list = async (req, res) => res.json(await Expense.find());
exports.create = async (req, res) => res.json(await Expense.create(req.body));
exports.remove = async (req, res) => { await Expense.findByIdAndDelete(req.params.id); res.json({ ok: true }); };