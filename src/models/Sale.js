const mongoose = require('mongoose');
const { Schema: S } = mongoose;
const SaleSchema = new S({
items: Array,
amount: Number,
createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Sale', SaleSchema);