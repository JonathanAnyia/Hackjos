const mongoose = require('mongoose');
const { Schema: S } = mongoose;
const ClientSchema = new S({
name: String,
email: String,
phone: String,
totalBookings: { type: Number, default: 0 },
totalSpent: { type: Number, default: 0 }
});
module.exports = mongoose.model('Client', ClientSchema);