const Customer = require('../models/Client');
exports.list = async (req, res) => { res.json(await Customer.find()); };
exports.create = async (req, res) => { res.json(await Customer.create(req.body)); };
exports.update = async (req, res) => { res.json(await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true })); };
exports.remove = async (req, res) => { await Customer.findByIdAndDelete(req.params.id); res.json({ ok: true }); };