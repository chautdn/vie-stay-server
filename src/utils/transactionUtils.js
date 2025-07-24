// utils/transactionUtils.js
const Transaction = require("../models/Transaction");

/**
 * Create a new transaction record
 * @param {Object} params - Transaction parameters
 * @param {string} params.userId - User ID
 * @param {string} params.type - Transaction type (deposit, withdraw, payment)
 * @param {number} params.amount - Transaction amount
 * @param {string} params.status - Transaction status (pending, success, failed)
 * @param {string} params.provider - Payment provider (optional)
 * @param {string} params.externalId - External transaction ID (optional)
 * @param {string} params.message - Transaction message/description
 * @returns {Promise<Transaction>} Created transaction
 */
const createTransaction = async ({
  userId,
  type,
  amount,
  status = "pending",
  provider = null,
  externalId = null,
  message
}) => {
  try {
    const transaction = new Transaction({
      user: userId,
      type,
      amount,
      status,
      provider,
      externalId,
      message
    });

    await transaction.save();
    console.log(`✅ Transaction created: ${type} - ${amount} - ${status}`);
    return transaction;
  } catch (error) {
    console.error("❌ Error creating transaction:", error);
    throw error;
  }
};

/**
 * Update transaction status
 * @param {string} transactionId - Transaction ID
 * @param {string} status - New status
 * @param {string} externalId - External ID (optional)
 * @returns {Promise<Transaction>} Updated transaction
 */
const updateTransactionStatus = async (transactionId, status, externalId = null) => {
  try {
    const updateData = { status };
    if (externalId) {
      updateData.externalId = externalId;
    }

    const transaction = await Transaction.findByIdAndUpdate(
      transactionId,
      updateData,
      { new: true }
    );

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    console.log(`✅ Transaction updated: ${transactionId} - ${status}`);
    return transaction;
  } catch (error) {
    console.error("❌ Error updating transaction:", error);
    throw error;
  }
};

/**
 * Generate transaction messages based on type
 * @param {string} type - Transaction type
 * @param {Object} details - Additional details for the message
 * @returns {string} Formatted message
 */
const generateTransactionMessage = (type, details = {}) => {
  switch (type) {
    case "deposit":
      return `Nạp tiền vào ví qua ${details.provider || "hệ thống"}`;
    case "withdraw":
      return `Rút tiền từ ví qua ${details.provider || "hệ thống"}`;
    case "payment":
      if (details.roomTitle) {
        return `Thanh toán đặt phòng: ${details.roomTitle}`;
      }
      if (details.serviceType) {
        return `Thanh toán dịch vụ: ${details.serviceType}`;
      }
      return "Thanh toán dịch vụ";
    default:
      return "Giao dịch";
  }
};

/**
 * Get user transaction statistics
 * @param {string} userId - User ID
 * @param {string} timeframe - Time period (today, week, month, year, all)
 * @returns {Promise<Object>} Transaction statistics
 */
const getUserTransactionStats = async (userId, timeframe = "all") => {
  try {
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

    const stats = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalDeposits: {
            $sum: {
              $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0]
            }
          },
          totalWithdrawals: {
            $sum: {
              $cond: [{ $eq: ["$type", "withdraw"] }, "$amount", 0]
            }
          },
          totalPayments: {
            $sum: {
              $cond: [{ $eq: ["$type", "payment"] }, "$amount", 0]
            }
          },
          depositCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "deposit"] }, 1, 0]
            }
          },
          withdrawalCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "withdraw"] }, 1, 0]
            }
          },
          paymentCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "payment"] }, 1, 0]
            }
          },
          totalTransactions: { $sum: 1 },
          avgTransactionAmount: { $avg: "$amount" }
        }
      }
    ]);

    return stats[0] || {
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalPayments: 0,
      depositCount: 0,
      withdrawalCount: 0,
      paymentCount: 0,
      totalTransactions: 0,
      avgTransactionAmount: 0
    };
  } catch (error) {
    console.error("❌ Error getting transaction stats:", error);
    throw error;
  }
};

/**
 * Validate transaction data
 * @param {Object} transactionData - Transaction data to validate
 * @returns {Object} Validation result
 */
const validateTransaction = (transactionData) => {
  const errors = [];
  
  if (!transactionData.userId) {
    errors.push("User ID is required");
  }
  
  if (!transactionData.type || !["deposit", "withdraw", "payment"].includes(transactionData.type)) {
    errors.push("Valid transaction type is required");
  }
  
  if (!transactionData.amount || transactionData.amount <= 0) {
    errors.push("Amount must be greater than 0");
  }
  
  if (transactionData.amount > 100000000) { // 100M VND limit
    errors.push("Amount exceeds maximum limit");
  }
  
  if (!transactionData.message || transactionData.message.trim().length === 0) {
    errors.push("Transaction message is required");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format transaction for display
 * @param {Object} transaction - Transaction object
 * @returns {Object} Formatted transaction
 */
const formatTransactionForDisplay = (transaction) => {
  return {
    id: transaction._id,
    type: transaction.type,
    typeName: getTransactionTypeName(transaction.type),
    amount: transaction.amount,
    formattedAmount: formatCurrency(transaction.amount),
    status: transaction.status,
    statusName: getTransactionStatusName(transaction.status),
    message: transaction.message,
    provider: transaction.provider,
    externalId: transaction.externalId,
    createdAt: transaction.createdAt,
    formattedDate: formatDate(transaction.createdAt),
    user: transaction.user
  };
};

/**
 * Get transaction type name in Vietnamese
 * @param {string} type - Transaction type
 * @returns {string} Vietnamese name
 */
const getTransactionTypeName = (type) => {
  switch (type) {
    case "deposit":
      return "Nạp tiền";
    case "withdraw":
      return "Rút tiền";
    case "payment":
      return "Thanh toán";
    default:
      return "Giao dịch";
  }
};

/**
 * Get transaction status name in Vietnamese
 * @param {string} status - Transaction status
 * @returns {string} Vietnamese name
 */
const getTransactionStatusName = (status) => {
  switch (status) {
    case "pending":
      return "Đang xử lý";
    case "success":
      return "Thành công";
    case "failed":
      return "Thất bại";
    default:
      return "Không xác định";
  }
};

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
const formatCurrency = (amount) => {
  return amount.toLocaleString("vi-VN") + "₫";
};

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  return new Date(date).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

module.exports = {
  createTransaction,
  updateTransactionStatus,
  generateTransactionMessage,
  getUserTransactionStats,
  validateTransaction,
  formatTransactionForDisplay,
  getTransactionTypeName,
  getTransactionStatusName,
  formatCurrency,
  formatDate
};