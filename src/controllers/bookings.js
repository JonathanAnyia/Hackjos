const Booking = require('../models/Booking');
const Service = require('../models/Service');

const generateBookingId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `BKG-${timestamp}-${random}`.toUpperCase();
};

exports.createBooking = async (req, res) => {
  try {
    const {
      serviceId,
      bookingDate,
      startTime,
      endTime,
      duration,
      customerNotes,
      selectedAddOns,
      location
    } = req.body;

    if (!serviceId || !bookingDate || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide serviceId, bookingDate, startTime, and endTime'
      });
    }

    const service = await Service.findById(serviceId).populate('provider');
    
    if (!service || !service.isActive || !service.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or not available'
      });
    }

    const isAvailable = await Booking.checkAvailability(
      serviceId,
      service.provider._id,
      new Date(bookingDate),
      startTime,
      endTime
    );

    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is not available'
      });
    }

    let addOnsTotal = 0;
    if (selectedAddOns && selectedAddOns.length > 0) {
      addOnsTotal = selectedAddOns.reduce((sum, addon) => sum + addon.price, 0);
    }

    const totalAmount = service.basePrice + addOnsTotal;

    const booking = await Booking.create({
      bookingId: generateBookingId(),
      service: serviceId,
      provider: service.provider._id,
      customer: req.user.id,
      customerName: `${req.user.firstName} ${req.user.lastName}`,
      customerEmail: req.user.email,
      customerPhone: req.user.phone,
      bookingDate: new Date(bookingDate),
      startTime,
      endTime,
      duration: duration || service.duration.value,
      basePrice: service.basePrice,
      addOnsTotal,
      totalAmount,
      selectedAddOns: selectedAddOns || [],
      locationType: service.locationType,
      location: location || {},
      customerNotes
    });

    await service.recordBooking(totalAmount);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getProviderBookings = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can view bookings.'
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      serviceId
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (serviceId) filters.service = serviceId;
    
    if (startDate && endDate) {
      filters.bookingDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const bookings = await Booking.getProviderBookings(req.user.id, filters)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Booking.countDocuments({
      provider: req.user.id,
      ...filters
    });

    res.status(200).json({
      success: true,
      count: bookings.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: bookings
    });
  } catch (error) {
    console.error('Get provider bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings'
    });
  }
};

exports.getCalendarView = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can view calendar.'
      });
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide startDate and endDate'
      });
    }

    const bookings = await Booking.getBookingsByDate(
      req.user.id,
      new Date(startDate),
      new Date(endDate)
    );

    const calendarData = {};
    bookings.forEach(booking => {
      const dateKey = booking.bookingDate.toISOString().split('T')[0];
      if (!calendarData[dateKey]) {
        calendarData[dateKey] = [];
      }
      calendarData[dateKey].push({
        id: booking._id,
        bookingId: booking.bookingId,
        customerName: booking.customerName,
        serviceName: booking.service.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        totalAmount: booking.totalAmount
      });
    });

    res.status(200).json({
      success: true,
      data: calendarData
    });
  } catch (error) {
    console.error('Get calendar view error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching calendar data'
    });
  }
};

exports.getCustomerBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status
    } = req.query;

    const filters = {};
    if (status) filters.status = status;

    const bookings = await Booking.getCustomerBookings(req.user.id, filters)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Booking.countDocuments({
      customer: req.user.id,
      ...filters
    });

    res.status(200).json({
      success: true,
      count: bookings.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: bookings
    });
  } catch (error) {
    console.error('Get customer bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings'
    });
  }
};

exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('service', 'name category basePrice duration')
      .populate('provider', 'businessName email phone')
      .populate('customer', 'firstName lastName email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (
      booking.provider._id.toString() !== req.user.id &&
      booking.customer._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking'
    });
  }
};

exports.confirmBooking = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can confirm bookings.'
      });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      provider: req.user.id
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be confirmed'
      });
    }

    await booking.confirm();

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: booking
    });
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming booking'
    });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const isProvider = booking.provider.toString() === req.user.id;
    const isCustomer = booking.customer.toString() === req.user.id;

    if (!isProvider && !isCustomer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!booking.canCancel) {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be cancelled'
      });
    }

    await booking.cancel(req.user.id, reason);

    const service = await Service.findById(booking.service);
    if (service) {
      await service.recordCancellation();
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking'
    });
  }
};

exports.completeBooking = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can complete bookings.'
      });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      provider: req.user.id
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be completed'
      });
    }

    await booking.complete();

    const service = await Service.findById(booking.service);
    if (service) {
      await service.recordCompletion(booking.totalAmount);
    }

    res.status(200).json({
      success: true,
      message: 'Booking completed successfully',
      data: booking
    });
  } catch (error) {
    console.error('Complete booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing booking'
    });
  }
};

exports.addReview = async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a rating'
      });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user.id
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed bookings can be reviewed'
      });
    }

    await booking.addRating(rating, review);

    const service = await Service.findById(booking.service);
    if (service) {
      await service.updateRating(rating);
    }

    res.status(200).json({
      success: true,
      message: 'Review added successfully',
      data: booking
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding review'
    });
  }
};

exports.getUpcomingBookings = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can view upcoming bookings.'
      });
    }

    const { limit = 10 } = req.query;

    const bookings = await Booking.getUpcomingBookings(req.user.id, parseInt(limit));

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Get upcoming bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming bookings'
    });
  }
};

module.exports = exports;