const Booking = require('../models/Booking');
exports.list = async (req, res) => { const b = await Booking.find().populate('service'); res.json(b); };
exports.create = async (req, res) => { const payload = { ...req.body, clientId: req.user._id }; const created = await Booking.create(payload); res.json(created); };
exports.update = async (req, res) => { const u = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(u); };
exports.get = async (req, res) => { const b = await Booking.findById(req.params.id).populate('service'); res.json(b); };