const Product = require('../models/Product');
const User = require('../models/User');

exports.getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      search,
      sortBy = '-createdAt'
    } = req.query;

    const query = { owner: req.user.id, isActive: true };

    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product'
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const {
      productId,
      name,
      description,
      category,
      saleType,
      unitPrice,
      costPrice,
      wholesalePrice,
      quantity,
      minStockLevel,
      unit,
      sku,
      barcode
    } = req.body;

    if (!productId || !name || !unitPrice || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide productId, name, unitPrice, and quantity'
      });
    }

    const existingProduct = await Product.findOne({
      productId,
      owner: req.user.id
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product ID already exists'
      });
    }

    const productCount = await Product.countDocuments({
      owner: req.user.id,
      isActive: true
    });

    const allowedFeatures = req.user.getAllowedFeatures();
    if (productCount >= allowedFeatures.maxCustomerRecords) {
      return res.status(403).json({
        success: false,
        message: `Product limit reached for ${req.user.subscription.plan} plan. Please upgrade.`,
        upgradeRequired: true
      });
    }

    const product = await Product.create({
      ...req.body,
      owner: req.user.id,
      stockHistory: [{
        type: 'added',
        quantity,
        previousQuantity: 0,
        newQuantity: quantity,
        reason: 'Initial stock',
        performedBy: req.user.id
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (req.body.quantity !== undefined) {
      delete req.body.quantity;
    }

    product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isActive = false;
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product'
    });
  }
};

exports.addStock = async (req, res) => {
  try {
    const { quantity, reason } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid quantity'
      });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.addStock(quantity, reason, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Stock added successfully',
      data: product
    });
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding stock',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.removeStock = async (req, res) => {
  try {
    const { quantity, reason } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid quantity'
      });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.removeStock(quantity, reason, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Stock removed successfully',
      data: product
    });
  } catch (error) {
    console.error('Remove stock error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error removing stock'
    });
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      owner: req.user.id,
      isActive: true,
      $expr: { $lte: ['$quantity', '$minStockLevel'] },
      quantity: { $gt: 0 }
    }).sort({ quantity: 1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock products'
    });
  }
};

exports.getOutOfStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      owner: req.user.id,
      isActive: true,
      quantity: 0
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Get out of stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching out of stock products'
    });
  }
};

exports.getTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.find({
      owner: req.user.id,
      isActive: true
    })
    .sort({ 'analytics.totalSold': -1 })
    .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Get top selling error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top selling products'
    });
  }
};

exports.getInventoryStatistics = async (req, res) => {
  try {
    const stats = await Product.aggregate([
      {
        $match: {
          owner: req.user._id,
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: '$totalValue' },
          lowStockCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $lte: ['$quantity', '$minStockLevel'] },
                  { $gt: ['$quantity', 0] }
                ]},
                1,
                0
              ]
            }
          },
          outOfStockCount: {
            $sum: {
              $cond: [{ $eq: ['$quantity', 0] }, 1, 0]
            }
          },
          totalRevenue: { $sum: '$analytics.totalRevenue' },
          totalItemsSold: { $sum: '$analytics.totalSold' }
        }
      }
    ]);

    const categories = await Product.aggregate([
      {
        $match: {
          owner: req.user._id,
          isActive: true
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalValue' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalProducts: 0,
          totalQuantity: 0,
          totalValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          totalRevenue: 0,
          totalItemsSold: 0
        },
        categories
      }
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory statistics'
    });
  }
};

exports.exportInventory = async (req, res) => {
  try {
    const products = await Product.find({
      owner: req.user.id,
      isActive: true
    }).lean();

    const csvHeader = 'Product ID,Name,Category,Quantity,Unit Price,Cost Price,Total Value,Status\n';
    const csvData = products.map(p => 
      `${p.productId},"${p.name}",${p.category || ''},${p.quantity},${p.unitPrice},${p.costPrice || 0},${p.totalValue},${p.status}`
    ).join('\n');

    const csv = csvHeader + csvData;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=inventory-${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting inventory'
    });
  }
};

module.exports = exports;