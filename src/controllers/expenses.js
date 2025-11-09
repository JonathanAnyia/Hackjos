const Expense = require('../models/Expense');

const generateExpenseId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `EXP-${timestamp}-${random}`.toUpperCase();
};

exports.getExpenses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      paymentStatus,
      startDate,
      endDate,
      search,
      sortBy = '-expenseDate'
    } = req.query;

    const query = { 
      owner: req.user.id, 
      isDeleted: false 
    };

    if (category) query.category = category;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    
    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) query.expenseDate.$gte = new Date(startDate);
      if (endDate) query.expenseDate.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { expenseId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'vendor.name': { $regex: search, $options: 'i' } }
      ];
    }

    const expenses = await Expense.find(query)
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Expense.countDocuments(query);

    res.status(200).json({
      success: true,
      count: expenses.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: expenses
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expenses',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expense'
    });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const {
      description,
      category,
      amount,
      paymentMethod,
      paymentStatus,
      vendor,
      expenseDate,
      isRecurring,
      recurrence,
      isTaxDeductible,
      notes
    } = req.body;

    if (!description || !category || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Please provide description, category, and amount'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    const expense = await Expense.create({
      expenseId: generateExpenseId(),
      owner: req.user.id,
      description,
      category,
      amount,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: paymentStatus || 'paid',
      vendor: vendor || {},
      expenseDate: expenseDate || Date.now(),
      isRecurring: isRecurring || false,
      recurrence: recurrence || {},
      isTaxDeductible: isTaxDeductible || false,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: expense
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating expense',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    let expense = await Expense.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    if (expense.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update cancelled expense'
      });
    }

    expense = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating expense',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    await expense.cancelExpense('Deleted by user');

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting expense'
    });
  }
};

exports.markAsPaid = async (req, res) => {
  try {
    const { paymentMethod, reference } = req.body;

    const expense = await Expense.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    if (expense.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Expense is already marked as paid'
      });
    }

    await expense.markAsPaid(paymentMethod, reference);

    res.status(200).json({
      success: true,
      message: 'Expense marked as paid',
      data: expense
    });
  } catch (error) {
    console.error('Mark as paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking expense as paid'
    });
  }
};

exports.getExpensesByCategory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    const expensesByCategory = await Expense.getExpensesByCategory(
      req.user.id,
      start,
      end
    );

    const total = expensesByCategory.reduce((sum, cat) => sum + cat.totalAmount, 0);
    
    const categoriesWithPercentage = expensesByCategory.map(cat => ({
      ...cat,
      percentage: total > 0 ? ((cat.totalAmount / total) * 100).toFixed(2) : 0
    }));

    res.status(200).json({
      success: true,
      data: categoriesWithPercentage,
      total,
      period: { start, end }
    });
  } catch (error) {
    console.error('Get expenses by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expenses by category'
    });
  }
};

exports.getExpenseStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await Expense.getTotalExpenses(req.user.id, start, end);

    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const currentMonthEnd = new Date();
    const currentMonthStats = await Expense.getTotalExpenses(
      req.user.id,
      currentMonthStart,
      currentMonthEnd
    );

    const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
    const lastMonthStats = await Expense.getTotalExpenses(
      req.user.id,
      lastMonthStart,
      lastMonthEnd
    );

    const percentageChange = lastMonthStats.totalExpenses > 0
      ? (((currentMonthStats.totalExpenses - lastMonthStats.totalExpenses) / lastMonthStats.totalExpenses) * 100).toFixed(2)
      : 0;

    const pendingExpenses = await Expense.countDocuments({
      owner: req.user.id,
      paymentStatus: 'pending',
      isDeleted: false
    });

    const overdueExpenses = await Expense.countDocuments({
      owner: req.user.id,
      paymentStatus: 'overdue',
      isDeleted: false
    });

    res.status(200).json({
      success: true,
      data: {
        overview: stats,
        currentMonth: currentMonthStats,
        lastMonth: lastMonthStats,
        percentageChange,
        pendingExpenses,
        overdueExpenses,
        period: { start, end }
      }
    });
  } catch (error) {
    console.error('Get expense statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expense statistics'
    });
  }
};

exports.getMonthlyTrend = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const trend = await Expense.getMonthlyExpenseTrend(
      req.user.id,
      parseInt(year)
    );

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullTrend = monthNames.map((name, index) => {
      const monthData = trend.find(t => t._id === index + 1);
      return {
        month: name,
        totalExpenses: monthData ? monthData.totalExpenses : 0,
        count: monthData ? monthData.count : 0
      };
    });

    res.status(200).json({
      success: true,
      data: fullTrend,
      year: parseInt(year)
    });
  } catch (error) {
    console.error('Get monthly trend error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly trend'
    });
  }
};

exports.getRecurringExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({
      owner: req.user.id,
      isRecurring: true,
      'recurrence.isActive': true,
      isDeleted: false
    }).sort({ 'recurrence.nextDueDate': 1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (error) {
    console.error('Get recurring expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recurring expenses'
    });
  }
};

exports.getUpcomingExpenses = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const expenses = await Expense.getRecurringExpensesDue(
      req.user.id,
      futureDate
    );

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
      daysAhead: parseInt(days)
    });
  } catch (error) {
    console.error('Get upcoming expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming expenses'
    });
  }
};

exports.exportExpenses = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { 
      owner: req.user.id, 
      isDeleted: false 
    };

    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) query.expenseDate.$gte = new Date(startDate);
      if (endDate) query.expenseDate.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(query)
      .sort({ expenseDate: -1 })
      .lean();

    const csvHeader = 'Expense ID,Date,Description,Category,Amount,Payment Method,Payment Status,Vendor,Tax Deductible\n';
    const csvData = expenses.map(e => 
      `${e.expenseId},${new Date(e.expenseDate).toLocaleDateString()},"${e.description}",${e.category},${e.amount},${e.paymentMethod},${e.paymentStatus},"${e.vendor?.name || 'N/A'}",${e.isTaxDeductible ? 'Yes' : 'No'}`
    ).join('\n');

    const csv = csvHeader + csvData;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=expenses-${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting expenses'
    });
  }
};

module.exports = exports;