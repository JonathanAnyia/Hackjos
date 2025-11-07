const mongoose = require('mongoose');
const { Schema: S } = mongoose;
const BookingSchema = new S({
service: { type: S.Types.ObjectId, ref: 'Service' },
clientName: String,
clientId: { type: S.Types.ObjectId, ref: 'User' },
date: String,
time: String,
status: { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending' },
amount: Number,
createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Booking', BookingSchema);