const mongoose = require('mongoose');
const { Schema } = mongoose;

const SaleSchema = new Schema({
  saleId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  seller: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  customer: {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    address: { type: String, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' }
  },
  
  items: [{
    product: { 
      type: Schema.Types.ObjectId, 
      ref: 'Product', 
      required: true 
    },
    productName: { type: String, required: true },
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true }
  }],
  
  subtotal: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  discount: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    default: 'fixed' 
  },
  tax: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  shippingFee: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  totalAmount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  amountPaid: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  balance: { 
    type: Number, 
    default: 0 
  },
  currency: { 
    type: String, 
    default: 'NGN' 
  },
  
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'card', 'transfer', 'mobile_money', 'credit', 'other'], 
    default: 'cash' 
  },
  paymentStatus: { 
    type: String, 
    enum: ['paid', 'partial', 'unpaid', 'refunded'], 
    default: 'paid' 
  },
  paymentReference: { 
    type: String, 
    trim: true 
  },
  
  payments: [{
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    reference: String,
    date: { type: Date, default: Date.now },
    notes: String
  }],
  
  status: { 
    type: String, 
    enum: ['completed', 'pending', 'cancelled', 'refunded'], 
    default: 'completed' 
  },
  
  delivery: {
    required: { type: Boolean, default: false },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] 
    },
    address: String,
    trackingNumber: String,
    deliveryDate: Date,
    deliveryFee: { type: Number, default: 0 }
  },
  
  invoice: {
    number: String,
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    notes: String,
    termsAndConditions: String
  },
  
  notes: String,
  tags: [String],
  channel: { 
    type: String, 
    enum: ['in_store', 'online', 'phone', 'whatsapp', 'other'], 
    default: 'in_store' 
  },
  
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  
  saleDate: { 
    type: Date, 
    default: Date.now,
    index: true
  },
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

SaleSchema.index({ seller: 1, saleDate: -1 });
SaleSchema.index({ seller: 1, status: 1 });
SaleSchema.index({ seller: 1, paymentStatus: 1 });
SaleSchema.index({ 'customer.customerId': 1 });
SaleSchema.index({ saleId: 1 });

SaleSchema.virtual('profit').get(function() {
  return 0;
});

SaleSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  
  let discountAmount = this.discount;
  if (this.discountType === 'percentage') {
    discountAmount = (this.subtotal * this.discount) / 100;
  }
  
  this.totalAmount = this.subtotal - discountAmount + this.tax + this.shippingFee;
  
  this.balance = this.totalAmount - this.amountPaid;
  
  if (this.balance <= 0) {
    this.paymentStatus = 'paid';
  } else if (this.amountPaid > 0 && this.balance > 0) {
    this.paymentStatus = 'partial';
  } else {
    this.paymentStatus = 'unpaid';
  }
  
  this.updatedAt = Date.now();
  next();
});

SaleSchema.methods.addPayment = async function(amount, method, reference, notes) {
  this.payments.push({
    amount,
    method,
    reference,
    notes,
    date: Date.now()
  });
  
  this.amountPaid += amount;
  return await this.save();
};

SaleSchema.methods.cancelSale = async function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.notes = (this.notes || '') + `\nCancelled: ${reason}`;
  this.isDeleted = true;
  this.deletedAt = Date.now();
  this.deletedBy = cancelledBy;
  
  return await this.save();
};

SaleSchema.methods.refundSale = async function(reason) {
  this.status = 'refunded';
  this.paymentStatus = 'refunded';
  this.notes = (this.notes || '') + `\nRefunded: ${reason}`;
  
  return await this.save();
};

SaleSchema.statics.getSalesByDateRange = function(sellerId, startDate, endDate) {
  return this.find({
    seller: sellerId,
    saleDate: { $gte: startDate, $lte: endDate },
    isDeleted: false
  }).sort({ saleDate: -1 });
};

SaleSchema.statics.getSalesAnalytics = async function(sellerId, startDate, endDate) {
  const sales = await this.aggregate([
    {
      $match: {
        seller: mongoose.Types.ObjectId(sellerId),
        saleDate: { $gte: startDate, $lte: endDate },
        isDeleted: false,
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: '$totalAmount' },
        totalItemsSold: { $sum: { $sum: '$items.quantity' } }
      }
    }
  ]);
  
  return sales[0] || {
    totalSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalItemsSold: 0
  };
};

SaleSchema.statics.getMonthlySalesPerformance = function(sellerId, year) {
  return this.aggregate([
    {
      $match: {
        seller: mongoose.Types.ObjectId(sellerId),
        saleDate: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1)
        },
        isDeleted: false,
        status: 'completed'
      }
    },
    {
      $group: {
        _id: { $month: '$saleDate' },
        totalSales: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

module.exports = mongoose.model('Sale', SaleSchema);