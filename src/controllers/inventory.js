const Item = require('../models/InventoryItem');
exports.list = async (req, res) => res.json(await Item.find());
exports.create = async (req, res) => res.json(await Item.create(req.body));
exports.updateQty = async (req, res) => {
const { delta } = req.body;
const it = await Item.findById(req.params.id);
if(!it) return res.status(404).json({});
it.qty = Math.max(0, it.qty + Number(delta));
await it.save();
res.json(it);
};
exports.remove = async (req, res) => { await Item.findByIdAndDelete(req.params.id); res.json({ ok: true }); };