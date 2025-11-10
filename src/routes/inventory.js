const express = require('express');
const router = express.Router();
const { protect, checkEmailVerified, logActivity } = require('../middleware/auth');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addStock,
  removeStock,
  getLowStockProducts,
  getOutOfStockProducts,
  getTopSellingProducts,
  getInventoryStatistics,
  exportInventory
} = require('../controllers/inventory');



// All routes require authentication
router.use(protect);

// Special routes (must come before /:id)
router.get('/low-stock', getLowStockProducts);
router.get('/out-of-stock', getOutOfStockProducts);
router.get('/top-selling', getTopSellingProducts);
router.get('/statistics', getInventoryStatistics);
router.get('/export', exportInventory);

// Main CRUD routes
router.route('/')
  .get(getProducts)
  //.post(checkEmailVerified, logActivity('product_created'), createProduct);

router.route('/:id')
  .get(getProduct)
  .put(logActivity('product_updated'), updateProduct)
  .delete(logActivity('product_deleted'), deleteProduct);

// Stock management
router.post('/:id/add-stock', logActivity('stock_added'), addStock);
router.post('/:id/remove-stock', logActivity('stock_removed'), removeStock);
router.post('/', protect, createProduct);

module.exports = router;

