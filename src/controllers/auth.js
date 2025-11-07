const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


exports.register = async (req, res) => {
const { name, email, phone, password } = req.body;
try {
const hashed = await bcrypt.hash(password, 10);
const user = await User.create({ name, email, phone, password: hashed });
const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role }, token });
} catch (err) { res.status(400).json({ message: err.message }); }
};


exports.login = async (req, res) => {
const { emailOrPhone, password } = req.body;
const user = await User.findOne({ $or: [{ email: emailOrPhone }, { phone: emailOrPhone }] });
if (!user) return res.status(400).json({ message: 'Invalid credentials' });
const ok = await bcrypt.compare(password, user.password);
if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, walletBalance: user.walletBalance }, token });
};


exports.me = (req, res) => res.json({ user: req.user });