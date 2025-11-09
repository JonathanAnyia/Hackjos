const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getDashboard,
  addFavoriteService,
  removeFavoriteService
} = require('../controllers/userCtrl');

const { protectCustomer } = require('../middleware/customerAuth');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.use(protectCustomer);

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.put('/change-password', changePassword);
router.get('/dashboard', getDashboard);

// Favorites
router.post('/favorites/service/:serviceId', addFavoriteService);
router.delete('/favorites/service/:serviceId', removeFavoriteService);

module.exports = router;