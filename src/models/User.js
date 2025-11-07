const mongoose = require('mongoose');
const { Schema } = mongoose;
const UserSchema = new Schema({
name: String,
email: { type: String, unique: true, sparse: true },
phone: { type: String, unique: true, sparse: true },
password: String,
role: { type: String, enum: ['user','admin','provider'], default: 'user' },
walletBalance: { type: Number, default: 0 },
createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('User', UserSchema);