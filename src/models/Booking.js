const mongoose = require('mongoose');
const { Schema } = mongoose;

const BookingSchema = new Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
    index: true
  },
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerEmail: String,
  customerPhone: String,
  
  bookingDate: {
    type: Date,
    required: true,
    index: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'pending',
    index: true
  },
  
  basePrice: {
    type: Number,
    required: true
  },
  addOnsTotal: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  
  selectedAddOns: [{
    name: String,
    price: Number
  }],
  
  locationType: {
    type: String,
    enum: ['on_site', 'customer_location', 'online'],
    required: true
  },
  location: {
    address: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  customerNotes: String,
  providerNotes: String,
  specialRequirements: [String],
  
  cancellationReason: String,
  cancelledBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date,
  refundAmount: Number,
  refundStatus: {
    type: String,
    enum: ['pending', 'processed', 'rejected', 'n/a'],
    default: 'n/a'
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending',
    index: true
  },
  paymentMethod: String,
  paymentReference: String,
  paidAt: Date,
  
  completedAt: Date,
  
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: String,
  reviewedAt: Date,
  
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: Date,
  
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

BookingSchema.index({ provider: 1, bookingDate: 1 });
BookingSchema.index({ customer: 1, bookingDate: 1 });
BookingSchema.index({ service: 1, status: 1 });
BookingSchema.index({ bookingDate: 1, status: 1 });
BookingSchema.index({ status: 1, paymentStatus: 1 });

BookingSchema.virtual('formattedDate').get(function() {
  return this.bookingDate.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

BookingSchema.virtual('timeSlot').get(function() {
  return `${this.startTime} - ${this.endTime}`;
});

BookingSchema.virtual('isUpcoming').get(function() {
  return this.bookingDate > new Date() && this.status !== 'cancelled';
});

BookingSchema.virtual('isPast').get(function() {
  return this.bookingDate < new Date();
});

BookingSchema.virtual('canCancel').get(function() {
  return ['pending', 'confirmed'].includes(this.status) && this.isUpcoming;
});

BookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

BookingSchema.methods.confirm = async function() {
  this.status = 'confirmed';
  return await this.save();
};

BookingSchema.methods.cancel = async function(userId, reason) {
  this.status = 'cancelled';
  this.cancelledBy = userId;
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return await this.save();
};

BookingSchema.methods.complete = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return await this.save();
};

BookingSchema.methods.markNoShow = async function() {
  this.status = 'no_show';
  return await this.save();
};

BookingSchema.methods.addRating = async function(rating, review) {
  this.rating = rating;
  this.review = review;
  this.reviewedAt = new Date();
  return await this.save();
};

BookingSchema.statics.getProviderBookings = function(providerId, filters = {}) {
  const query = {
    provider: providerId,
    ...filters
  };
  
  return this.find(query)
    .populate('service', 'name category basePrice')
    .populate('customer', 'firstName lastName email phone')
    .sort({ bookingDate: 1, startTime: 1 });
};

BookingSchema.statics.getCustomerBookings = function(customerId, filters = {}) {
  const query = {
    customer: customerId,
    ...filters
  };
  
  return this.find(query)
    .populate('service', 'name category basePrice')
    .populate('provider', 'businessName profile')
    .sort({ bookingDate: -1 });
};

BookingSchema.statics.getBookingsByDate = function(providerId, startDate, endDate) {
  return this.find({
    provider: providerId,
    bookingDate: {
      $gte: startDate,
      $lte: endDate
    }
  })
    .populate('service', 'name')
    .populate('customer', 'firstName lastName')
    .sort({ bookingDate: 1, startTime: 1 });
};

BookingSchema.statics.checkAvailability = async function(serviceId, providerId, date, startTime, endTime) {
  const existingBookings = await this.find({
    service: serviceId,
    provider: providerId,
    bookingDate: date,
    status: { $in: ['pending', 'confirmed'] },
    $or: [
      {
        $and: [
          { startTime: { $lte: startTime } },
          { endTime: { $gt: startTime } }
        ]
      },
      {
        $and: [
          { startTime: { $lt: endTime } },
          { endTime: { $gte: endTime } }
        ]
      },
      {
        $and: [
          { startTime: { $gte: startTime } },
          { endTime: { $lte: endTime } }
        ]
      }
    ]
  });
  
  return existingBookings.length === 0;
};

BookingSchema.statics.getUpcomingBookings = function(providerId, limit = 10) {
  return this.find({
    provider: providerId,
    bookingDate: { $gte: new Date() },
    status: { $in: ['pending', 'confirmed'] }
  })
    .populate('service', 'name')
    .populate('customer', 'firstName lastName')
    .sort({ bookingDate: 1, startTime: 1 })
    .limit(limit);
};

BookingSchema.statics.getBookingsNeedingReminder = function() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  return this.find({
    bookingDate: { $gte: tomorrow, $lt: dayAfter },
    status: 'confirmed',
    reminderSent: false
  })
    .populate('customer', 'email firstName')
    .populate('service', 'name');
};

module.exports = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);