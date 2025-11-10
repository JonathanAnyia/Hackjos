const Payment = require('../models/Payment');
const axios = require('axios');
const Invoice = require('../models/Invoice');
require('dotenv').config();

// 🔍 Verify payment with Flutterwave
exports.verifyPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({ message: 'Transaction ID is required' });
    }

    // Verify the transaction from Flutterwave API
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const data = response.data;

    if (data.status !== 'success') {
      return res.status(400).json({ message: 'Verification failed', data });
    }

    const tx = data.data;

    // Try to match invoice using tx reference
    const invoice = await Invoice.findOne({ paymentReference: tx.tx_ref });

    if (!invoice) {
      return res.status(404).json({
        message: 'Payment verified, but no matching invoice found',
        transaction: tx,
      });
    }

    // Update invoice
    invoice.status = 'paid';
    invoice.totalAmount = tx.amount;
    await invoice.save();

    res.status(200).json({
      message: 'Payment verified successfully',
      invoice,
      transaction: tx,
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// 1️⃣ Create a payment record (called when Flutter initiates payment)
exports.createPayment = async (req, res) => {
  try {
    const { userId, amount, currency, reference } = req.body;

    if (!userId || !amount || !reference) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await Payment.findOne({ reference });
    if (existing) {
      return res.status(400).json({ message: 'Payment with this reference already exists' });
    }

    const payment = new Payment({
      userId,
      amount,
      currency: currency || 'NGN',
      reference,
      status: 'pending'
    });

    await payment.save();
    res.status(201).json({ message: 'Payment created', payment });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// 2️⃣ Handle webhook from Flutter payment provider
exports.handleWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const secret = process.env.FLUTTERWAVE_SECRET_KEY;

    // Flutterwave sends an event type (e.g. charge.completed)
    if (!payload || !payload.data) {
      return res.status(400).json({ message: 'Invalid webhook payload' });
    }

    const tx = payload.data;
    const status = tx.status?.toLowerCase();

    if (status === 'successful' || status === 'success') {
      const invoice = await Invoice.findOne({ paymentReference: tx.tx_ref });
      if (invoice) {
        invoice.status = 'paid';
        invoice.totalAmount = tx.amount;
        await invoice.save();
      }
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 3️⃣ Get payment status (called from Flutter after payment completes)
exports.getPaymentStatus = async (req, res) => {
  try {
    const { ref } = req.params;
    const payment = await Payment.findOne({ reference: ref });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.status(200).json({
      reference: payment.reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      updatedAt: payment.updatedAt
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
