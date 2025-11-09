const mongoose = require('mongoose');
const { Schema } = mongoose;

const ProductSchema = new Schema({
  productId: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
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
    trim: true 
  },
  saleType: { 
    type: String, 
    enum: ['unit', 'bulk', 'wholesale', 'retail'], 
    default: 'unit' 
  },
  
  unitPrice: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  costPrice: { 
    type: Number, 
    min: 0 
  },
  wholesalePrice: { 
    type: Number, 
    min: 0 
  },
  currency: { 
    type: String, 
    default: 'NGN' 
  },
  
  quantity: { 
    type: Number, 
    required: true, 
    default: 0,
    min: 0 
  },
  minStockLevel: { 
    type: Number, 
    default: 10 
  },
  totalValue: { 
    type: Number, 
    default: 0 
  },
  
  status: { 
    type: String, 
    enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'], 
    default: 'in_stock' 
  },
  
  sku: { 
    type: String, 
    trim: true 
  },
  barcode: { 
    type: String, 
    trim: true 
  },
  unit: { 
    type: String, 
    default: 'piece' 
  },
  weight: { 
    type: Number 
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: { type: String, default: 'cm' }
  },
  
  images: [{ 
    url: String,
    isPrimary: { type: Boolean, default: false }
  }],
  
  supplier: {
    name: String,
    phone: String,
    email: String,
    address: String
  },
  
  analytics: {
    totalSold: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageSalePrice: { type: Number, default: 0 },
    lastSoldDate: Date,
    popularityScore: { type: Number, default: 0 }
  },
  
  owner: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  stockHistory: [{
    type: { 
      type: String, 
      enum: ['added', 'removed', 'sold', 'returned', 'adjusted'] 
    },
    quantity: Number,
    previousQuantity: Number,
    newQuantity: Number,
    reason: String,
    performedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    },
    date: { type: Date, default: Date.now }
  }],
  
  isActive: { 
    type: Boolean, 
    default: true 
  },
  tags: [String],
  notes: String,
  
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

ProductSchema.index({ owner: 1, productId: 1 });
ProductSchema.index({ owner: 1, status: 1 });
ProductSchema.index({ owner: 1, name: 'text', description: 'text' });
ProductSchema.index({ 'analytics.totalSold': -1 });

ProductSchema.virtual('profitMargin').get(function() {
  if (!this.costPrice || this.costPrice === 0) return 0;
  return ((this.unitPrice - this.costPrice) / this.costPrice * 100).toFixed(2);
});

ProductSchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.minStockLevel && this.quantity > 0;
});

ProductSchema.virtual('isOutOfStock').get(function() {
  return this.quantity === 0;
});

ProductSchema.pre('save', function(next) {
  this.totalValue = this.quantity * (this.costPrice || this.unitPrice);
  
  if (this.quantity === 0) {
    this.status = 'out_of_stock';
  } else if (this.quantity <= this.minStockLevel) {
    this.status = 'low_stock';
  } else {
    this.status = 'in_stock';
  }
  
  this.updatedAt = Date.now();
  next();
});

ProductSchema.methods.addStock = async function(quantity, reason, performedBy) {
  const previousQuantity = this.quantity;
  this.quantity += quantity;
  
  this.stockHistory.push({
    type: 'added',
    quantity: quantity,
    previousQuantity: previousQuantity,
    newQuantity: this.quantity,
    reason: reason || 'Stock added',
    performedBy: performedBy
  });
  
  return await this.save();
};

ProductSchema.methods.removeStock = async function(quantity, reason, performedBy) {
  if (this.quantity < quantity) {
    throw new Error('Insufficient stock');
  }
  
  const previousQuantity = this.quantity;
  this.quantity -= quantity;
  
  this.stockHistory.push({
    type: 'removed',
    quantity: quantity,
    previousQuantity: previousQuantity,
    newQuantity: this.quantity,
    reason: reason || 'Stock removed',
    performedBy: performedBy
  });
  
  return await this.save();
};

ProductSchema.methods.recordSale = async function(quantity, salePrice, performedBy) {
  if (this.quantity < quantity) {
    throw new Error('Insufficient stock for sale');
  }
  
  const previousQuantity = this.quantity;
  this.quantity -= quantity;
  
  this.analytics.totalSold += quantity;
  this.analytics.totalRevenue += (salePrice * quantity);
  this.analytics.averageSalePrice = this.analytics.totalRevenue / this.analytics.totalSold;
  this.analytics.lastSoldDate = Date.now();
  this.analytics.popularityScore += 1;
  
  this.stockHistory.push({
    type: 'sold',
    quantity: quantity,
    previousQuantity: previousQuantity,
    newQuantity: this.quantity,
    reason: `Sold ${quantity} unit(s) at ${salePrice} each`,
    performedBy: performedBy
  });
  
  return await this.save();
};

ProductSchema.statics.getLowStockProducts = function(ownerId) {
  return this.find({
    owner: ownerId,
    quantity: { $lte: this.minStockLevel, $gt: 0 },
    isActive: true
  }).sort({ quantity: 1 });
};

ProductSchema.statics.getTopSellingProducts = function(ownerId, limit = 10) {
  return this.find({
    owner: ownerId,
    isActive: true
  })
  .sort({ 'analytics.totalSold': -1 })
  .limit(limit);
};

module.exports = mongoose.model('Product', ProductSchema);