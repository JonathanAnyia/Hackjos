const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  
  businessName: { type: String, trim: true },
  businessType: { 
    type: String, 
    enum: ['product_seller', 'service_provider'], 
    default: 'product_seller' 
  },
  businessDescription: { type: String, trim: true },
  
  role: { 
    type: String, 
    enum: ['user', 'admin', 'provider'], 
    default: 'user' 
  },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: true },
  isPhoneVerified: { type: Boolean, default: false },
  
  settings: {
    workingHours: {
      start: { type: String, default: '09:00 AM' },
      end: { type: String, default: '06:00 PM' }
    },
    timezone: { type: String, default: 'Africa/Lagos (WAT)' },
    currency: { type: String, default: 'NGN (Nigerian Naira)' },
    language: { type: String, default: 'English' },
    notifications: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true }
    }
  },
  
  subscription: {
    plan: { 
      type: String, 
      enum: ['free', 'basic', 'pro', 'enterprise'], 
      default: 'free' 
    },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    features: {
      unlimitedInvoices: { type: Boolean, default: false },
      maxCustomerRecords: { type: Number, default: 50 },
      prioritySupport: { type: Boolean, default: false },
      advancedReporting: { type: Boolean, default: false }
    }
  },
  
  profile: {
    logo: { type: String },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    profileUrl: { type: String },
    qrCode: { type: String }
  },
  
  walletBalance: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  totalExpenses: { type: Number, default: 0 },
  
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ businessType: 1 });
UserSchema.index({ 'subscription.plan': 1 });

UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000;
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

UserSchema.methods.generateProfileUrl = function() {
  const baseUrl = process.env.BASE_URL || 'https://bizit.vercel.app';
  return `${baseUrl}/provider-profile?id=${this._id}`;
};

UserSchema.methods.hasActiveSubscription = function() {
  if (!this.subscription.isActive) return false;
  if (!this.subscription.endDate) return this.subscription.plan === 'free';
  return this.subscription.endDate > Date.now();
};

UserSchema.methods.getAllowedFeatures = function() {
  const plans = {
    free: {
      unlimitedInvoices: false,
      maxCustomerRecords: 50,
      prioritySupport: false,
      advancedReporting: false
    },
    basic: {
      unlimitedInvoices: false,
      maxCustomerRecords: 200,
      prioritySupport: false,
      advancedReporting: false
    },
    pro: {
      unlimitedInvoices: true,
      maxCustomerRecords: 1000,
      prioritySupport: true,
      advancedReporting: true
    },
    enterprise: {
      unlimitedInvoices: true,
      maxCustomerRecords: Infinity,
      prioritySupport: true,
      advancedReporting: true
    }
  };
  
  return plans[this.subscription.plan] || plans.free;
};

UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpire;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);