const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  refreshToken,
  deleteAccount
} = require('../controllers/auth');

const { 
  protect, 
  rateLimit,
  checkEmailVerified,
  logActivity
} = require('../middleware/auth');

router.post(
  '/register', 
  rateLimit({ max: 3, windowMs: 60 * 60 * 1000 }), // 3 registrations per hour
  register
);

router.post(
  '/login', 
  rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }), // 5 login attempts per 15 minutes
  login
);

router.post(
  '/forgot-password',
  rateLimit({ max: 3, windowMs: 60 * 60 * 1000 }), // 3 requests per hour
  forgotPassword
);

router.put(
  '/reset-password/:resettoken',
  rateLimit({ max: 3, windowMs: 60 * 60 * 1000 }),
  resetPassword
);

router.get('/verify-email/:token', verifyEmail);

router.post('/refresh-token', refreshToken);

// Protected routes (require authentication)
router.use(protect); // All routes below this require authentication

router.post('/logout', logout);

router.get('/me', getMe);

router.put(
  '/update-details',
  logActivity('profile_update'),
  updateDetails
);

router.put(
  '/update-password',
  rateLimit({ max: 3, windowMs: 60 * 60 * 1000, identifier: 'user' }),
  logActivity('password_change'),
  updatePassword
);

router.post(
  '/resend-verification',
  rateLimit({ max: 3, windowMs: 60 * 60 * 1000, identifier: 'user' }),
  resendVerification
);

router.delete(
  '/delete-account',
  rateLimit({ max: 1, windowMs: 24 * 60 * 60 * 1000, identifier: 'user' }),
  logActivity('account_deletion'),
  deleteAccount
);

module.exports = router;