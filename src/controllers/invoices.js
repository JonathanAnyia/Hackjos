const Invoice = require('../models/Invoice');
const { Parser } = require('json2csv');

// 🧾 Create a new invoice
exports.createInvoice = async (req, res) => {
  try {
    const { clientId, services, totalAmount, dueDate, notes } = req.body;

    if (!clientId || !services || !totalAmount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const invoice = new Invoice({
      clientId,
      services,
      totalAmount,
      dueDate,
      notes,
      createdBy: req.user.id,
    });

    await invoice.save();
    res.status(201).json({ message: 'Invoice created successfully', invoice });
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 📄 Get all invoices
exports.getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find().populate('clientId', 'name email');
    res.status(200).json(invoices);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 🔍 Get a single invoice
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('clientId', 'name email');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.status(200).json(invoice);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✏️ Update an invoice
exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.status(200).json({ message: 'Invoice updated', invoice });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 🗑️ Delete an invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.status(200).json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 💵 Mark invoice as paid
exports.markAsPaid = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    invoice.status = 'paid';
    invoice.paymentReference = req.body.paymentReference || null;
    await invoice.save();

    res.status(200).json({ message: 'Invoice marked as paid', invoice });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 📤 Export all invoices as CSV
exports.exportInvoicesCSV = async (req, res) => {
  try {
    const invoices = await Invoice.find().populate('clientId', 'name email');

    if (!invoices.length) {
      return res.status(404).json({ message: 'No invoices to export' });
    }

    const fields = [
      'clientId.name',
      'clientId.email',
      'totalAmount',
      'status',
      'currency',
      'dueDate',
      'createdAt',
      'updatedAt',
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(invoices);

    res.header('Content-Type', 'text/csv');
    res.attachment('invoices.csv');
    res.send(csv);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
