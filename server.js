console.log("server.js loaded~");
const express = require('express');
const connectDB = require(__dirname + '/src/config/db.js');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
console.log("ENV PORT:", process.env.PORT);


const authRoutes = require('./src/routes/auth');
const servicesRoutes = require('./src/routes/services');
const bookingsRoutes = require('./src/routes/bookings');
const clientsRoutes = require('./src/routes/clients');
const expensesRoutes = require('./src/routes/expenses');
const inventoryRoutes = require('./src/routes/inventory');
const salesRoutes = require('./src/routes/sales');
// const adminRoutes = require('./src/routes/admin');
// const payRoutes = require('./src/routes/paystack_sim');
const cookieParser = require("cookie-parser");
const userRoutes = require('./src/routes/users');

const app = express();

console.log("connectDB is:", connectDB);
connectDB();

app.use(express.json());
app.use(cors());
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/pay', payRoutes);
app.use('/api/users', userRoutes);


app.get('/', (req, res) => res.json({ ok: true }));


const PORT = process.env.PORT || 4000;


mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => {
console.log('MongoDB connected');
app.listen(PORT, () => console.log('Server running on', PORT));
})
.catch(err => {
console.error('MongoDB connection error', err.message);
process.exit(1);
});