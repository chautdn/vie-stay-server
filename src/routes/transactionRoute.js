// routes/transactionRoute.js
const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const { protect } = require("../controllers/authenticateController");

// GET / - Get user's transaction history (note: no /transactions prefix)
router.get("/", protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type, // deposit, withdraw, payment
      status = "success", // only show successful transactions by default
      search,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const userId = req.user._id;

    // Build query
    const query = { user: userId };
    
    // Add status filter (default to success)
    if (status) {
      query.status = status;
    }

    // Add type filter
    if (type && type !== "all") {
      query.type = type;
    }

    // Add search functionality
    if (search) {
      query.message = { $regex: search, $options: "i" };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get transactions with pagination
    const transactions = await Transaction.find(query)
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "name email")
      .lean();

    // Get total count for pagination
    const totalTransactions = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / parseInt(limit));

    // Calculate summary statistics
    const summaryQuery = { user: userId, status: "success" };
    const summary = await Transaction.aggregate([
      { $match: summaryQuery },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    const summaryStats = {
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalPayments: 0,
      depositCount: 0,
      withdrawalCount: 0,
      paymentCount: 0
    };

    summary.forEach(item => {
      if (item._id === "deposit") {
        summaryStats.totalDeposits = item.totalAmount;
        summaryStats.depositCount = item.count;
      } else if (item._id === "withdraw") {
        summaryStats.totalWithdrawals = item.totalAmount;
        summaryStats.withdrawalCount = item.count;
      } else if (item._id === "payment") {
        summaryStats.totalPayments = item.totalAmount;
        summaryStats.paymentCount = item.count;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTransactions,
          limit: parseInt(limit),
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        },
        summary: summaryStats
      },
      // For backward compatibility
      transactions,
      totalPages,
      currentPage: parseInt(page),
      totalTransactions
    });

  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Không thể tải lịch sử giao dịch",
      error: error.message
    });
  }
});

// GET /summary - Get transaction summary
router.get("/summary", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeframe = "all" } = req.query; // all, today, week, month, year

    let dateFilter = {};
    const now = new Date();

    switch (timeframe) {
      case "today":
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          }
        };
        break;
      case "week":
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = {
          createdAt: {
            $gte: weekStart,
            $lt: new Date()
          }
        };
        break;
      case "month":
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          }
        };
        break;
      case "year":
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), 0, 1),
            $lt: new Date(now.getFullYear() + 1, 0, 1)
          }
        };
        break;
    }

    const query = { 
      user: userId, 
      status: "success",
      ...dateFilter 
    };

    const summary = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" }
        }
      }
    ]);

    // Get recent transactions
    const recentTransactions = await Transaction.find({
      user: userId,
      status: "success"
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        summary,
        recentTransactions,
        timeframe
      }
    });

  } catch (error) {
    console.error("Error fetching transaction summary:", error);
    res.status(500).json({
      success: false,
      message: "Không thể tải tóm tắt giao dịch",
      error: error.message
    });
  }
});

// GET /:id - Get specific transaction details
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const transaction = await Transaction.findOne({
      _id: id,
      user: userId
    }).populate("user", "name email").lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch"
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({
      success: false,
      message: "Không thể tải thông tin giao dịch",
      error: error.message
    });
  }
});

module.exports = router;