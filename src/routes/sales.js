const express = require('express');
const router = express.Router();
const {
  getSales,
  getSale,
  createSale,
  updateSale,
  addPayment,
  cancelSale,
  getSalesAnalytics,
  getMonthlyPerformance,
  exportSales
} = require('../controllers/sales');

const { protect, checkEmailVerified, logActivity } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Special routes
router.get('/analytics', getSalesAnalytics);
router.get('/monthly-performance', getMonthlyPerformance);
router.get('/export', exportSales);

// Main CRUD routes
router.route('/')
  .get(getSales)
  .post(checkEmailVerified, logActivity('sale_created'), createSale);

router.route('/:id')
  .get(getSale)
  .put(logActivity('sale_updated'), updateSale);

// Sale actions
router.post('/:id/add-payment', logActivity('payment_added'), addPayment);
router.post('/:id/cancel', logActivity('sale_cancelled'), cancelSale);

module.exports = router;
