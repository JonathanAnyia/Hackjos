const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ExpenseSchema = new Schema({
description: String,
amount: Number,
category: String,
date: String,
createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Expense', ExpenseSchema);