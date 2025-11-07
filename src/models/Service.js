const mongoose = require('mongoose');
const { Schema: S } = mongoose;
const ServiceSchema = new S({
name: String,
description: String,
price: Number,
duration: Number,
status: { type: String, enum: ['active','inactive'], default: 'active' },
provider: { type: S.Types.ObjectId, ref: 'User' },
createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Service', ServiceSchema);