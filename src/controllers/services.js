const Service = require('../models/Service');

const generateServiceId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `SVC-${timestamp}-${random}`.toUpperCase();
};

const checkServiceProvider = (req, res, next) => {
  if (req.user.businessType !== 'service_provider') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only service providers can manage services.'
    });
  }
  next();
};

exports.getServices = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can view services.'
      });
    }

    const {
      page = 1,
      limit = 20,
      category,
      isActive,
      isPublished,
      search,
      sortBy = '-createdAt'
    } = req.query;

    const query = { provider: req.user.id };

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isPublished !== undefined) query.isPublished = isPublished === 'true';

    if (search) {
      query.$or = [
        { serviceId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const services = await Service.find(query)
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Service.countDocuments(query);

    res.status(200).json({
      success: true,
      count: services.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: services
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getService = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can view service details.'
      });
    }

    const service = await Service.findOne({
      _id: req.params.id,
      provider: req.user.id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service'
    });
  }
};

exports.createService = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can create services.'
      });
    }

    const {
      name,
      description,
      category,
      subcategory,
      basePrice,
      pricingType,
      duration,
      locationType,
      locationDetails,
      availability,
      cancellationPolicy,
      addOns
    } = req.body;

    if (!name || !category || !basePrice || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, category, basePrice, and duration'
      });
    }

    const service = await Service.create({
      serviceId: generateServiceId(),
      provider: req.user.id,
      name,
      description,
      category,
      subcategory,
      basePrice,
      pricingType: pricingType || 'fixed',
      duration,
      locationType: locationType || 'on_site',
      locationDetails: locationDetails || {},
      availability: availability || {},
      cancellationPolicy: cancellationPolicy || {},
      addOns: addOns || []
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating service',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateService = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can update services.'
      });
    }

    let service = await Service.findOne({
      _id: req.params.id,
      provider: req.user.id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating service'
    });
  }
};

exports.deleteService = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can delete services.'
      });
    }

    const service = await Service.findOne({
      _id: req.params.id,
      provider: req.user.id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    service.isActive = false;
    service.isPublished = false;
    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting service'
    });
  }
};

exports.togglePublish = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can publish services.'
      });
    }

    const service = await Service.findOne({
      _id: req.params.id,
      provider: req.user.id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    service.isPublished = !service.isPublished;
    await service.save();

    res.status(200).json({
      success: true,
      message: service.isPublished ? 'Service published successfully' : 'Service unpublished successfully',
      data: service
    });
  } catch (error) {
    console.error('Toggle publish error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating service publish status'
    });
  }
};

exports.getActiveServices = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can view active services.'
      });
    }

    const services = await Service.getActiveServices(req.user.id);

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    console.error('Get active services error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active services'
    });
  }
};

exports.getPublishedServices = async (req, res) => {
  try {
    const { category, providerId } = req.query;
    const filters = {};

    if (category) filters.category = category;
    if (providerId) filters.provider = providerId;

    const services = await Service.getPublishedServices(filters)
      .populate('provider', 'businessName profile.rating');

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    console.error('Get published services error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching published services'
    });
  }
};

exports.searchServices = async (req, res) => {
  try {
    const { q, category } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Please provide search query (q)'
      });
    }

    const services = await Service.searchServices(q, category)
      .populate('provider', 'businessName profile.rating');

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    console.error('Search services error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching services'
    });
  }
};

exports.getTopRatedServices = async (req, res) => {
  try {
    const { limit = 10, category } = req.query;

    const services = await Service.getTopRatedServices(parseInt(limit), category)
      .populate('provider', 'businessName profile');

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    console.error('Get top rated services error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top rated services'
    });
  }
};

exports.getFeaturedServices = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const services = await Service.getFeaturedServices(parseInt(limit))
      .populate('provider', 'businessName profile');

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    console.error('Get featured services error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured services'
    });
  }
};

exports.getServiceStatistics = async (req, res) => {
  try {
    if (req.user.businessType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only service providers can view service statistics.'
      });
    }

    const service = await Service.findOne({
      _id: req.params.id,
      provider: req.user.id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    const completionRate = service.statistics.totalBookings > 0
      ? ((service.statistics.completedBookings / service.statistics.totalBookings) * 100).toFixed(2)
      : 0;

    const averageRevenue = service.statistics.completedBookings > 0
      ? (service.statistics.totalRevenue / service.statistics.completedBookings).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        ...service.statistics,
        completionRate: parseFloat(completionRate),
        averageRevenue: parseFloat(averageRevenue),
        rating: service.rating
      }
    });
  } catch (error) {
    console.error('Get service statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service statistics'
    });
  }
};

exports.checkServiceProvider = checkServiceProvider;

module.exports = exports;