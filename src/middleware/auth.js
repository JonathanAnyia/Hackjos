const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies.token) {
      token = req.cookies.token;
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Please login again.'
        });
      }

      // Check if user account is active
      if (!req.user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
      }

      // Check if user account is locked
      if (req.user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account is locked. Please reset your password.'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please login again.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Check if email is verified
exports.checkEmailVerified = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email to access this resource',
      requiresEmailVerification: true
    });
  }
  next();
};

// Check subscription status
exports.checkSubscription = (requiredPlan = 'free') => {
  return (req, res, next) => {
    const planHierarchy = ['free', 'basic', 'pro', 'enterprise'];
    const userPlanIndex = planHierarchy.indexOf(req.user.subscription.plan);
    const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);

    if (userPlanIndex < requiredPlanIndex) {
      return res.status(403).json({
        success: false,
        message: `This feature requires ${requiredPlan} plan or higher`,
        currentPlan: req.user.subscription.plan,
        requiredPlan,
        upgradeRequired: true
      });
    }

    // Check if subscription is active
    if (!req.user.hasActiveSubscription()) {
      return res.status(403).json({
        success: false,
        message: 'Your subscription has expired. Please renew to continue.',
        subscriptionExpired: true
      });
    }

    next();
  };
};

// Rate limiting for sensitive operations
const rateLimitStore = new Map();

exports.rateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 20, // limit each identifier to 5 requests per windowMs
    message = 'Too many requests, please try again later',
    identifier = 'ip' // can be 'ip' or 'user'
  } = options;

  return (req, res, next) => {
    const key = identifier === 'user' && req.user 
      ? `user_${req.user.id}` 
      : `ip_${req.ip}`;

    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or initialize request log for this identifier
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }

    const requestLog = rateLimitStore.get(key);

    // Remove old requests outside the window
    const recentRequests = requestLog.filter(timestamp => timestamp > windowStart);
    rateLimitStore.set(key, recentRequests);

    // Check if limit exceeded
    if (recentRequests.length >= max) {
      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
      });
    }

    // Add current request
    recentRequests.push(now);
    rateLimitStore.set(key, recentRequests);

    next();
  };
};

// Clean up rate limit store periodically (run this with a cron job)
exports.cleanupRateLimitStore = () => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  for (const [key, timestamps] of rateLimitStore.entries()) {
    const recentRequests = timestamps.filter(timestamp => timestamp > now - maxAge);
    
    if (recentRequests.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, recentRequests);
    }
  }
};

// Optional: Check if user owns the resource
exports.checkOwnership = (Model) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const resource = await Model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      // Check ownership (assuming the model has an 'owner' or 'seller' field)
      const ownerField = resource.owner || resource.seller || resource.userId;
      
      if (ownerField.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this resource'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership'
      });
    }
  };
};

// Optional: Log user activity
exports.logActivity = (action) => {
  return async (req, res, next) => {
    try {
      // You can create an Activity model to log this
      console.log({
        user: req.user.id,
        action,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: new Date()
      });

      // If you have an Activity model:
      // await Activity.create({
      //   user: req.user.id,
      //   action,
      //   ip: req.ip,
      //   userAgent: req.get('user-agent')
      // });

      next();
    } catch (error) {
      console.error('Activity logging error:', error);
      // Don't block the request if logging fails
      next();
    }
  };
};

// Optional: Validate request body
exports.validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    next();
  };
};

module.exports = exports;