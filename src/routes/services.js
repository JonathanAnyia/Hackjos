const express = require('express');
const router = express.Router();
const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  togglePublish,
  getActiveServices,
  getPublishedServices,
  searchServices,
  getTopRatedServices,
  getFeaturedServices,
  getServiceStatistics
} = require('../controllers/services');

const { protect, checkEmailVerified, logActivity } = require('../middleware/auth');

// Public routes (no authentication required)
router.get('/published', getPublishedServices);
router.get('/search', searchServices);
router.get('/top-rated', getTopRatedServices);
router.get('/featured', getFeaturedServices);

// Protected routes (require authentication)
router.use(protect);

// Special routes
router.get('/active', getActiveServices);

// Main CRUD routes
router.route('/')
  .get(getServices)
  .post(checkEmailVerified, logActivity('service_created'), createService);

router.route('/:id')
  .get(getService)
  .put(logActivity('service_updated'), updateService)
  .delete(logActivity('service_deleted'), deleteService);

// Service actions
router.put('/:id/publish', logActivity('service_published'), togglePublish);
router.get('/:id/statistics', getServiceStatistics);

module.exports = router;
