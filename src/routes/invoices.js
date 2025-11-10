const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const invoiceCtrl = require('../controllers/invoices');

router.post('/', auth, invoiceCtrl.createInvoice);
router.get('/', auth, invoiceCtrl.getAllInvoices);
router.get('/:id', auth, invoiceCtrl.getInvoiceById);
router.put('/:id', auth, invoiceCtrl.updateInvoice);
router.delete('/:id', auth, invoiceCtrl.deleteInvoice);
router.patch('/:id/mark-paid', auth, invoiceCtrl.markAsPaid);
router.get('/export/csv', auth, invoiceCtrl.exportInvoicesCSV);

module.exports = router;
