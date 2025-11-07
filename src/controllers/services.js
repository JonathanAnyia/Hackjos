const Service = require('../models/Service');
exports.list = async (req, res) => { const services = await Service.find().populate('provider','name'); res.json(services); };
exports.create = async (req, res) => { const s = await Service.create({ ...req.body, provider: req.user._id }); res.json(s); };
exports.get = async (req, res) => { const s = await Service.findById(req.params.id).populate('provider','name'); if(!s) return res.status(404).json({}); res.json(s); };
exports.update = async (req, res) => { const s = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(s); };
exports.remove = async (req, res) => { await Service.findByIdAndDelete(req.params.id); res.json({ ok: true }); };