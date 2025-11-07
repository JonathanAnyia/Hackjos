const mongoose = require('mongoose');
const { Schema: S } = mongoose;
const TxSchema = new S({
user: { type: S.Types.ObjectId, ref: 'User' },
type: { type: String, enum: ['deposit','withdraw','sale','payout','refund'] },
amount: Number,
reference: String,
meta: Object,
createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Transaction', TxSchema);