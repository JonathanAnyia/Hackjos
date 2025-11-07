const mongoose = require('mongoose');
const { Schema: S } = mongoose;
const ItemSchema = new S({ sku: String, name: String, qty: Number, value: Number });
module.exports = mongoose.model('InventoryItem', ItemSchema);