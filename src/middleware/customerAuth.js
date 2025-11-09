const jwt = require('jsonwebtoken');
const Customer = require('../models/Client');

// Protect customer routes
exports.protectCustomer = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is for customer
    if (decoded.type !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Customer authentication required.'
      });
    }

    req.customer = await Customer.findById(decoded.id);

    if (!req.customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (!req.customer.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};