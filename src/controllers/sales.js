// ========== SALES CONTROLLER ==========
const Product = require('../models/Product');
const mongoose = require('mongoose');

const generateSaleId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `SALE-${timestamp}-${random}`.toUpperCase();
};

exports.getSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      startDate,
      endDate,
      search,
      sortBy = '-saleDate'
    } = req.query;

    const query = { 
      seller: req.user.id, 
      isDeleted: false 
    };

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { saleId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const sales = await Sale.find(query)
      .populate('items.product', 'name productId')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Sale.countDocuments(query);

    res.status(200).json({
      success: true,
      count: sales.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: sales
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sales',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getSale = async (req, res) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      seller: req.user.id
    }).populate('items.product', 'name productId category');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sale'
    });
  }
};

exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      items,
      customer,
      paymentMethod,
      amountPaid,
      discount,
      discountType,
      tax,
      shippingFee,
      notes,
      channel
    } = req.body;

    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one item'
      });
    }

    const processedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findOne({
        _id: item.product,
        owner: req.user.id,
        isActive: true
      }).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`
        });
      }

      if (product.quantity < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.quantity}`
        });
      }

      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = item.discount || 0;
      const itemTax = item.tax || 0;

      processedItems.push({
        product: product._id,
        productName: product.name,
        productId: product.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: itemDiscount,
        tax: itemTax,
        subtotal: itemSubtotal - itemDiscount + itemTax
      });

      subtotal += itemSubtotal;

      await product.recordSale(item.quantity, item.unitPrice, req.user.id);
    }

    let discountAmount = discount || 0;
    if (discountType === 'percentage') {
      discountAmount = (subtotal * discount) / 100;
    }

    const totalAmount = subtotal - discountAmount + (tax || 0) + (shippingFee || 0);

    const sale = await Sale.create([{
      saleId: generateSaleId(),
      seller: req.user.id,
      items: processedItems,
      customer: customer || {},
      subtotal,
      discount: discount || 0,
      discountType: discountType || 'fixed',
      tax: tax || 0,
      shippingFee: shippingFee || 0,
      totalAmount,
      amountPaid: amountPaid || totalAmount,
      paymentMethod: paymentMethod || 'cash',
      notes,
      channel: channel || 'in_store',
      invoice: {
        number: `INV-${generateSaleId()}`,
        issueDate: Date.now()
      }
    }], { session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Sale recorded successfully',
      data: sale[0]
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating sale',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
};

exports.updateSale = async (req, res) => {
  try {
    let sale = await Sale.findOne({
      _id: req.params.id,
      seller: req.user.id
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    if (sale.status === 'cancelled' || sale.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: `Cannot update ${sale.status} sale`
      });
    }

    const allowedUpdates = [
      'customer',
      'notes',
      'delivery',
      'invoice'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    sale = await Sale.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Sale updated successfully',
      data: sale
    });
  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sale'
    });
  }
};

exports.addPayment = async (req, res) => {
  try {
    const { amount, method, reference, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid payment amount'
      });
    }

    const sale = await Sale.findOne({
      _id: req.params.id,
      seller: req.user.id
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    if (sale.balance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Sale is already fully paid'
      });
    }

    if (amount > sale.balance) {
      return res.status(400).json({
        success: false,
        message: `Payment amount exceeds balance. Balance: ${sale.balance}`
      });
    }

    await sale.addPayment(amount, method, reference, notes);

    res.status(200).json({
      success: true,
      message: 'Payment added successfully',
      data: sale
    });
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding payment'
    });
  }
};

exports.cancelSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;

    const sale = await Sale.findOne({
      _id: req.params.id,
      seller: req.user.id
    }).session(session);

    if (!sale) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    if (sale.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Sale is already cancelled'
      });
    }

    for (const item of sale.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { 
          $inc: { quantity: item.quantity },
          $push: {
            stockHistory: {
              type: 'returned',
              quantity: item.quantity,
              reason: `Sale cancelled: ${reason}`,
              performedBy: req.user.id,
              date: Date.now()
            }
          }
        },
        { session }
      );
    }

    await sale.cancelSale(reason, req.user.id);

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Sale cancelled successfully',
      data: sale
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Cancel sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling sale'
    });
  } finally {
    session.endSession();
  }
};

exports.getSalesAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, period = 'month' } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    const analytics = await Sale.getSalesAnalytics(req.user.id, start, end);

    const paymentMethods = await Sale.aggregate([
      {
        $match: {
          seller: req.user._id,
          saleDate: { $gte: start, $lte: end },
          isDeleted: false,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const channels = await Sale.aggregate([
      {
        $match: {
          seller: req.user._id,
          saleDate: { $gte: start, $lte: end },
          isDeleted: false,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$channel',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: analytics,
        paymentMethods,
        channels,
        period: { start, end }
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sales analytics'
    });
  }
};

exports.getMonthlyPerformance = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const performance = await Sale.getMonthlySalesPerformance(
      req.user.id,
      parseInt(year)
    );

    res.status(200).json({
      success: true,
      data: performance,
      year: parseInt(year)
    });
  } catch (error) {
    console.error('Get monthly performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly performance'
    });
  }
};

exports.exportSales = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { 
      seller: req.user.id, 
      isDeleted: false 
    };

    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }

    const sales = await Sale.find(query)
      .sort({ saleDate: -1 })
      .lean();

    const csvHeader = 'Sale ID,Date,Customer,Items,Subtotal,Discount,Tax,Total,Amount Paid,Balance,Payment Method,Status\n';
    const csvData = sales.map(s => {
      const itemCount = s.items.reduce((sum, item) => sum + item.quantity, 0);
      return `${s.saleId},${new Date(s.saleDate).toLocaleDateString()},"${s.customer?.name || 'N/A'}",${itemCount},${s.subtotal},${s.discount},${s.tax},${s.totalAmount},${s.amountPaid},${s.balance},${s.paymentMethod},${s.status}`;
    }).join('\n');

    const csv = csvHeader + csvData;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sales-${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting sales'
    });
  }
};

module.exports = exports;