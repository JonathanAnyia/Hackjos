const Client = require('../models/Client');
exports.list = async (req, res) => { res.json(await Client.find()); };
exports.create = async (req, res) => { res.json(await Client.create(req.body)); };
exports.update = async (req, res) => { res.json(await Client.findByIdAndUpdate(req.params.id, req.body, { new: true })); };
exports.remove = async (req, res) => { await Client.findByIdAndDelete(req.params.id); res.json({ ok: true }); };