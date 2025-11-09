const express = require('express');
const router = express.Router();
const {
  createBooking,
  getProviderBookings,
  getCalendarView,
  getCustomerBookings,
  getBooking,
  confirmBooking,
  cancelBooking,
  completeBooking,
  addReview,
  getUpcomingBookings
} = require('../controllers/bookings');

const { protect, checkEmailVerified, logActivity } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Customer routes
router.post('/', checkEmailVerified, logActivity('booking_created'), createBooking);
router.get('/customer', getCustomerBookings);
router.put('/:id/review', logActivity('booking_reviewed'), addReview);

// Provider routes
router.get('/provider', getProviderBookings);
router.get('/calendar', getCalendarView);
router.get('/upcoming', getUpcomingBookings);
router.put('/:id/confirm', logActivity('booking_confirmed'), confirmBooking);
router.put('/:id/complete', logActivity('booking_completed'), completeBooking);

// Shared routes
router.get('/:id', getBooking);
router.put('/:id/cancel', logActivity('booking_cancelled'), cancelBooking);

module.exports = router;
