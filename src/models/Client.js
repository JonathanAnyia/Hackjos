const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Schema } = mongoose;

const CustomerSchema = new Schema({
  firstName: {
    type: String,
    required: [true, 'Please provide first name'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Please provide last name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Please provide phone number'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please provide password'],
    minlength: 6,
    select: false
  },
  
  profileImage: String,
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  
  address: {
    street: String,
    city: String,
    state: String,
    country: { type: String, default: 'Nigeria' },
    postalCode: String
  },
  
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    favoriteCategories: [String],
    currency: { type: String, default: 'NGN' }
  },
  
  statistics: {
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 }
  },
  
  favoriteServices: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  favoriteProviders: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  lastLogin: Date,
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

CustomerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

CustomerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

CustomerSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

CustomerSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      type: 'customer',
      email: this.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

CustomerSchema.methods.recordBooking = async function(amount) {
  this.statistics.totalBookings += 1;
  this.statistics.totalSpent += amount;
  return await this.save();
};

CustomerSchema.methods.recordCompletion = async function() {
  this.statistics.completedBookings += 1;
  return await this.save();
};

CustomerSchema.methods.recordCancellation = async function() {
  this.statistics.cancelledBookings += 1;
  return await this.save();
};

CustomerSchema.methods.addFavoriteService = async function(serviceId) {
  if (!this.favoriteServices.includes(serviceId)) {
    this.favoriteServices.push(serviceId);
    return await this.save();
  }
  return this;
};

CustomerSchema.methods.removeFavoriteService = async function(serviceId) {
  this.favoriteServices = this.favoriteServices.filter(
    id => id.toString() !== serviceId.toString()
  );
  return await this.save();
};

module.exports = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);