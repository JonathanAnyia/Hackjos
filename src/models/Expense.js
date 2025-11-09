const mongoose = require('mongoose');
const { Schema } = mongoose;

const ExpenseSchema = new Schema({
  // Expense ID
  expenseId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  // Relationships
  owner: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // Expense Details
  description: { 
    type: String, 
    required: true, 
    trim: true 
  },
  category: { 
    type: String, 
    required: true,
    enum: [
      'utilities', 
      'rent', 
      'supplies', 
      'salaries', 
      'transport',
      'marketing',
      'maintenance',
      'inventory',
      'insurance',
      'taxes',
      'other'
    ]
  },
  
  // Financial Details
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  currency: { 
    type: String, 
    default: 'NGN' 
  },
  
  // Payment Information
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'card', 'transfer', 'cheque', 'mobile_money', 'other'], 
    default: 'cash' 
  },
  paymentStatus: { 
    type: String, 
    enum: ['paid', 'pending', 'overdue'], 
    default: 'paid' 
  },
  paymentReference: { 
    type: String, 
    trim: true 
  },
  
  // Vendor/Supplier Details
  vendor: {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    address: { type: String, trim: true }
  },
  
  // Receipt/Invoice
  receipt: {
    number: String,
    imageUrl: String,
    uploadDate: Date
  },
  
  // Recurring Expense
  isRecurring: { 
    type: Boolean, 
    default: false 
  },
  recurrence: {
    frequency: { 
      type: String, 
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] 
    },
    nextDueDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: true }
  },
  
  // Tax Deductible
  isTaxDeductible: { 
    type: Boolean, 
    default: false 
  },
  taxCategory: String,
  
  // Additional Information
  notes: String,
  tags: [String],
  attachments: [{
    name: String,
    url: String,
    uploadDate: { type: Date, default: Date.now }
  }],
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'cancelled', 'refunded'], 
    default: 'active' 
  },
  
  // Approval workflow (if needed)
  approval: {
    required: { type: Boolean, default: false },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'] 
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedDate: Date,
    rejectionReason: String
  },
  
  // Metadata
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  
  // Timestamps
  expenseDate: { 
    type: Date, 
    required: true,
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

// Indexes
ExpenseSchema.index({ owner: 1, expenseDate: -1 });
ExpenseSchema.index({ owner: 1, category: 1 });
ExpenseSchema.index({ owner: 1, paymentStatus: 1 });
ExpenseSchema.index({ 'recurrence.nextDueDate': 1 });

// Update timestamp on save
ExpenseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to mark as paid
ExpenseSchema.methods.markAsPaid = async function(paymentMethod, reference) {
  this.paymentStatus = 'paid';
  this.paymentMethod = paymentMethod;
  if (reference) this.paymentReference = reference;
  
  return await this.save();
};

// Method to cancel expense
ExpenseSchema.methods.cancelExpense = async function(reason) {
  this.status = 'cancelled';
  this.notes = (this.notes || '') + `\nCancelled: ${reason}`;
  this.isDeleted = true;
  this.deletedAt = Date.now();
  
  return await this.save();
};

// Static method to get expenses by date range
ExpenseSchema.statics.getExpensesByDateRange = function(ownerId, startDate, endDate) {
  return this.find({
    owner: ownerId,
    expenseDate: { $gte: startDate, $lte: endDate },
    isDeleted: false
  }).sort({ expenseDate: -1 });
};

// Static method to get expenses by category
ExpenseSchema.statics.getExpensesByCategory = function(ownerId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        owner: mongoose.Types.ObjectId(ownerId),
        expenseDate: { $gte: startDate, $lte: endDate },
        isDeleted: false,
        status: 'active'
      }
    },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        percentage: { $sum: '$amount' }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ]);
};

// Static method to get total expenses
ExpenseSchema.statics.getTotalExpenses = async function(ownerId, startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        owner: mongoose.Types.ObjectId(ownerId),
        expenseDate: { $gte: startDate, $lte: endDate },
        isDeleted: false,
        status: 'active'
      }
    },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: '$amount' },
        count: { $sum: 1 },
        averageExpense: { $avg: '$amount' }
      }
    }
  ]);
  
  return result[0] || {
    totalExpenses: 0,
    count: 0,
    averageExpense: 0
  };
};

// Static method to get recurring expenses due
ExpenseSchema.statics.getRecurringExpensesDue = function(ownerId, dueDate) {
  return this.find({
    owner: ownerId,
    isRecurring: true,
    'recurrence.isActive': true,
    'recurrence.nextDueDate': { $lte: dueDate },
    isDeleted: false
  });
};

// Static method to get monthly expense trend
ExpenseSchema.statics.getMonthlyExpenseTrend = function(ownerId, year) {
  return this.aggregate([
    {
      $match: {
        owner: mongoose.Types.ObjectId(ownerId),
        expenseDate: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1)
        },
        isDeleted: false,
        status: 'active'
      }
    },
    {
      $group: {
        _id: { $month: '$expenseDate' },
        totalExpenses: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

module.exports = mongoose.model('Expense', ExpenseSchema);