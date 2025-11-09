const express = require('express');
const router = express.Router();
const {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  markAsPaid,
  getExpensesByCategory,
  getExpenseStatistics,
  getMonthlyTrend,
  getRecurringExpenses,
  getUpcomingExpenses,
  exportExpenses
} = require('../controllers/expenses');

const { protect, checkEmailVerified, logActivity } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Special routes
router.get('/by-category', getExpensesByCategory);
router.get('/statistics', getExpenseStatistics);
router.get('/monthly-trend', getMonthlyTrend);
router.get('/recurring', getRecurringExpenses);
router.get('/upcoming', getUpcomingExpenses);
router.get('/export', exportExpenses);

// Main CRUD routes
router.route('/')
  .get(getExpenses)
  .post(checkEmailVerified, logActivity('expense_created'), createExpense);

router.route('/:id')
  .get(getExpense)
  .put(logActivity('expense_updated'), updateExpense)
  .delete(logActivity('expense_deleted'), deleteExpense);

// Expense actions
router.post('/:id/mark-paid', logActivity('expense_paid'), markAsPaid);

module.exports = router;
