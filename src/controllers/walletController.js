// src/controllers/walletController.js
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const mongoose = require("mongoose");

// Get wallet balance
exports.getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("wallet");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        balance: user.wallet.balance,
        lastUpdated: user.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Deposit money to wallet
exports.depositToWallet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { amount, provider, externalId } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid deposit amount"
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Create deposit transaction
    const transaction = new Transaction({
      user: req.user.id,
      type: "deposit",
      amount,
      status: "success",
      provider,
      externalId,
      message: `Deposit ${amount.toLocaleString()}đ to wallet`,
      balanceBefore: user.wallet.balance,
      balanceAfter: user.wallet.balance + amount
    });

    await transaction.save({ session });

    // Update user wallet balance
    user.wallet.balance += amount;
    user.wallet.transactions.push(transaction._id);
    await user.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Deposit successful",
      data: {
        transaction,
        newBalance: user.wallet.balance
      }
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

// Withdraw money from wallet
exports.withdrawFromWallet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { amount, bankAccount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal amount"
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance"
      });
    }

    // Check if user has verified bank account
    if (!user.bankAccount?.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Bank account not verified. Please verify your bank account first."
      });
    }

    // Create withdrawal transaction
    const transaction = new Transaction({
      user: req.user.id,
      type: "withdraw",
      amount,
      status: "pending", // Will be updated when bank transfer is processed
      provider: "bank_transfer",
      message: `Withdraw ${amount.toLocaleString()}đ from wallet`,
      balanceBefore: user.wallet.balance,
      balanceAfter: user.wallet.balance - amount
    });

    await transaction.save({ session });

    // Update user wallet balance
    user.wallet.balance -= amount;
    user.wallet.transactions.push(transaction._id);
    await user.save({ session });

    await session.commitTransaction();

    // TODO: Process bank transfer
    // This would typically involve calling a banking API

    res.status(200).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: {
        transaction,
        newBalance: user.wallet.balance,
        note: "Your withdrawal will be processed within 1-2 business days"
      }
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get wallet transaction history
exports.getWalletTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    
    const query = { user: req.user.id };
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }

    const transactions = await Transaction.find(query)
      .populate("relatedBill", "billNumber")
      .populate("relatedBillPayment", "amount")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    // Calculate summary statistics
    const summary = await Transaction.aggregate([
      { $match: { user: mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: transactions,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get transaction details
exports.getTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: req.user.id
    })
    .populate("relatedBill", "billNumber roomId")
    .populate("relatedBillPayment");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};