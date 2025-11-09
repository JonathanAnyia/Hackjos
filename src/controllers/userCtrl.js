const Customer = require('../models/Client');

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email already exists'
      });
    }

    const customer = await Customer.create({
      firstName,
      lastName,
      email,
      phone,
      password
    });

    const token = customer.getSignedJwtToken();

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      token,
      data: {
        id: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone
      }
    });
  } catch (error) {
    console.error('Customer registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const customer = await Customer.findOne({ email }).select('+password');

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!customer.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    const isMatch = await customer.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    customer.lastLogin = Date.now();
    await customer.save();

    const token = customer.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        id: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        isEmailVerified: customer.isEmailVerified
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);

    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
      address: req.body.address,
      preferences: req.body.preferences
    };

    Object.keys(fieldsToUpdate).forEach(
      key => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const customer = await Customer.findByIdAndUpdate(
      req.customer.id,
      fieldsToUpdate,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: customer
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    const customer = await Customer.findById(req.customer.id).select('+password');

    const isMatch = await customer.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    customer.password = newPassword;
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    const Booking = require('../models/Booking');

    const recentBookings = await Booking.find({ customer: req.customer.id })
      .populate('service', 'name category')
      .populate('provider', 'businessName')
      .sort({ bookingDate: -1 })
      .limit(5);

    const upcomingBookings = await Booking.find({
      customer: req.customer.id,
      bookingDate: { $gte: new Date() },
      status: { $in: ['pending', 'confirmed'] }
    })
      .populate('service', 'name category')
      .populate('provider', 'businessName')
      .sort({ bookingDate: 1 })
      .limit(5);

    const favoriteServices = await customer.populate({
      path: 'favoriteServices',
      select: 'name category basePrice rating'
    });

    res.status(200).json({
      success: true,
      data: {
        statistics: customer.statistics,
        recentBookings,
        upcomingBookings,
        favoriteServices: favoriteServices.favoriteServices
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data'
    });
  }
};

exports.addFavoriteService = async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    await customer.addFavoriteService(req.params.serviceId);

    res.status(200).json({
      success: true,
      message: 'Service added to favorites',
      data: customer.favoriteServices
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding favorite'
    });
  }
};

exports.removeFavoriteService = async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    await customer.removeFavoriteService(req.params.serviceId);

    res.status(200).json({
      success: true,
      message: 'Service removed from favorites',
      data: customer.favoriteServices
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing favorite'
    });
  }
};

module.exports = exports;