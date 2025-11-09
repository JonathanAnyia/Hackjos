const mongoose = require('mongoose');
const { Schema } = mongoose;

const ServiceSchema = new Schema({
  serviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'beauty_wellness',
      'home_services',
      'professional_services',
      'automotive',
      'education_training',
      'events_entertainment',
      'health_fitness',
      'pet_care',
      'repair_maintenance',
      'other'
    ]
  },
  subcategory: String,
  
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  pricingType: {
    type: String,
    enum: ['fixed', 'hourly', 'per_session', 'custom'],
    default: 'fixed'
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  
  duration: {
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      default: 'minutes'
    }
  },
  
  locationType: {
    type: String,
    enum: ['on_site', 'customer_location', 'online', 'both'],
    default: 'on_site'
  },
  locationDetails: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  availability: {
    days: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    timeSlots: [{
      startTime: String,
      endTime: String
    }],
    advanceBookingDays: {
      type: Number,
      default: 30
    },
    minimumNotice: {
      type: Number,
      default: 2
    }
  },
  
  maxBookingsPerSlot: {
    type: Number,
    default: 1
  },
  simultaneousBookings: {
    type: Boolean,
    default: false
  },
  
  cancellationPolicy: {
    hours: Number,
    refundPercentage: Number,
    description: String
  },
  
  images: [{
    url: String,
    isPrimary: { type: Boolean, default: false }
  }],
  videos: [String],
  
  addOns: [{
    name: String,
    description: String,
    price: Number,
    required: { type: Boolean, default: false }
  }],
  
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  
  statistics: {
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0 }
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  
  tags: [String],
  featured: {
    type: Boolean,
    default: false
  },
  
  notes: String,
  termsAndConditions: String,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

ServiceSchema.index({ provider: 1, isActive: 1 });
ServiceSchema.index({ category: 1, isPublished: 1 });
ServiceSchema.index({ 'rating.average': -1 });
ServiceSchema.index({ name: 'text', description: 'text' });

ServiceSchema.virtual('hourlyRate').get(function() {
  if (this.pricingType === 'hourly') {
    return this.basePrice;
  }
  return (this.basePrice / (this.duration.value / 60)).toFixed(2);
});

ServiceSchema.virtual('isPopular').get(function() {
  return this.statistics.popularityScore > 50 || this.rating.average >= 4.5;
});

ServiceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

ServiceSchema.methods.updateRating = async function(newRating) {
  const totalRating = (this.rating.average * this.rating.count) + newRating;
  this.rating.count += 1;
  this.rating.average = (totalRating / this.rating.count).toFixed(2);
  
  return await this.save();
};

ServiceSchema.methods.recordBooking = async function(bookingAmount) {
  this.statistics.totalBookings += 1;
  this.statistics.popularityScore += 1;
  
  return await this.save();
};

ServiceSchema.methods.recordCompletion = async function(bookingAmount) {
  this.statistics.completedBookings += 1;
  this.statistics.totalRevenue += bookingAmount;
  this.statistics.popularityScore += 2;
  
  return await this.save();
};

ServiceSchema.methods.recordCancellation = async function() {
  this.statistics.cancelledBookings += 1;
  this.statistics.popularityScore = Math.max(0, this.statistics.popularityScore - 1);
  
  return await this.save();
};

ServiceSchema.statics.getActiveServices = function(providerId) {
  return this.find({
    provider: providerId,
    isActive: true
  }).sort({ 'statistics.popularityScore': -1 });
};

ServiceSchema.statics.getPublishedServices = function(filters = {}) {
  const query = {
    isActive: true,
    isPublished: true,
    ...filters
  };
  
  return this.find(query).sort({ 'rating.average': -1, 'statistics.popularityScore': -1 });
};

ServiceSchema.statics.searchServices = function(searchTerm, category = null) {
  const query = {
    isActive: true,
    isPublished: true,
    $text: { $search: searchTerm }
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } });
};

ServiceSchema.statics.getTopRatedServices = function(limit = 10, category = null) {
  const query = {
    isActive: true,
    isPublished: true,
    'rating.count': { $gte: 5 }
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query)
    .sort({ 'rating.average': -1, 'rating.count': -1 })
    .limit(limit);
};

ServiceSchema.statics.getFeaturedServices = function(limit = 10) {
  return this.find({
    isActive: true,
    isPublished: true,
    featured: true
  })
  .sort({ 'statistics.popularityScore': -1 })
  .limit(limit);
};

module.exports = mongoose.model('Service', ServiceSchema);