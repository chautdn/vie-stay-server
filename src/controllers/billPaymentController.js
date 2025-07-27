// src/controllers/billPaymentController.js
const BillPayment = require("../models/BillPayment");
const Bill = require("../models/Bill");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const mongoose = require("mongoose");

// Pay bill using wallet (without transactions)
exports.payBillWithWallet = async (req, res) => {
  try {
    const { billId } = req.params;
    const { amount } = req.body;
    
    // Get bill details
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    // Verify user is the representative
    if (bill.representativeId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the representative can pay this bill"
      });
    }

    if (bill.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Bill is already paid"
      });
    }

    // Get user wallet balance
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const paymentAmount = amount || bill.remainingBalance || bill.totalAmount;
    
    // Validate payment amount
    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than 0"
      });
    }

    const currentRemaining = bill.totalAmount - (bill.paidAmount || 0);
    if (paymentAmount > currentRemaining) {
      return res.status(400).json({
        success: false,
        message: "Payment amount cannot exceed remaining balance"
      });
    }
    
    if (user.wallet.balance < paymentAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance"
      });
    }

    // Create wallet transaction
    const transaction = new Transaction({
      user: req.user.id,
      type: "payment",
      amount: paymentAmount,
      status: "success",
      message: `Payment for bill ${bill.billNumber}`,
      balanceBefore: user.wallet.balance,
      balanceAfter: user.wallet.balance - paymentAmount,
      relatedBill: billId
    });

    await transaction.save();

    // Update user wallet balance
    user.wallet.balance -= paymentAmount;
    user.wallet.transactions.push(transaction._id);
    await user.save();

    // Create bill payment record
    const billPayment = new BillPayment({
      billId,
      payerId: req.user.id,
      amount: paymentAmount,
      paymentMethod: "wallet",
      transactionId: transaction._id,
      status: "completed",
      paidAt: new Date(),
      notes: `Paid via wallet - Transaction ID: ${transaction._id}`,
      isPartialPayment: paymentAmount < currentRemaining
    });

    await billPayment.save();

    // Update transaction with bill payment reference
    transaction.relatedBillPayment = billPayment._id;
    await transaction.save();

    // Update bill payment status manually since we're not using transactions
    // Calculate total paid amount for this bill
    const totalPaid = await BillPayment.aggregate([
      {
        $match: {
          billId: new mongoose.Types.ObjectId(billId),
          status: "completed"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const paidAmount = totalPaid.length > 0 ? totalPaid[0].total : 0;
    
    // Update bill
    bill.paidAmount = paidAmount;
    if (paidAmount >= bill.totalAmount) {
      bill.status = "paid";
      bill.paidAt = new Date();
    }
    
    await bill.save();

    res.status(200).json({
      success: true,
      message: "Bill payment successful",
      data: {
        billPayment,
        transaction,
        remainingBalance: user.wallet.balance,
        billStatus: bill.status,
        billRemainingBalance: bill.totalAmount - paidAmount
      }
    });

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Record cash payment (landlord action) - without transactions
exports.recordCashPayment = async (req, res) => {
  try {
    const { billId } = req.params;
    const { amount, notes, referenceNumber } = req.body;
    
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    // Verify user is the landlord
    if (bill.landlordId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the landlord can record cash payments"
      });
    }

    // Validate payment amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than 0"
      });
    }

    const currentRemaining = bill.totalAmount - (bill.paidAmount || 0);
    if (amount > currentRemaining) {
      return res.status(400).json({
        success: false,
        message: "Payment amount cannot exceed remaining balance"
      });
    }

    const billPayment = new BillPayment({
      billId,
      payerId: bill.representativeId,
      amount,
      paymentMethod: "cash",
      status: "completed",
      paidAt: new Date(),
      notes,
      referenceNumber,
      receivedBy: req.user.id,
      isPartialPayment: amount < currentRemaining
    });

    await billPayment.save();

    // Update bill payment status manually
    const totalPaid = await BillPayment.aggregate([
      {
        $match: {
          billId: new mongoose.Types.ObjectId(billId),
          status: "completed"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const paidAmount = totalPaid.length > 0 ? totalPaid[0].total : 0;
    
    // Update bill
    bill.paidAmount = paidAmount;
    if (paidAmount >= bill.totalAmount) {
      bill.status = "paid";
      bill.paidAt = new Date();
    }
    
    await bill.save();

    res.status(201).json({
      success: true,
      message: "Cash payment recorded successfully",
      data: {
        billPayment,
        billStatus: bill.status,
        billRemainingBalance: bill.totalAmount - paidAmount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Record bank transfer payment - without transactions
exports.recordBankTransferPayment = async (req, res) => {
  try {
    const { billId } = req.params;
    const { amount, notes, referenceNumber, bankTransferDetails } = req.body;
    
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    // Verify user is the landlord
    if (bill.landlordId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the landlord can record bank transfer payments"
      });
    }

    // Validate payment amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than 0"
      });
    }

    const currentRemaining = bill.totalAmount - (bill.paidAmount || 0);
    if (amount > currentRemaining) {
      return res.status(400).json({
        success: false,
        message: "Payment amount cannot exceed remaining balance"
      });
    }

    const billPayment = new BillPayment({
      billId,
      payerId: bill.representativeId,
      amount,
      paymentMethod: "bank_transfer",
      status: "completed",
      paidAt: new Date(),
      notes,
      referenceNumber,
      bankTransferDetails,
      receivedBy: req.user.id,
      isPartialPayment: amount < currentRemaining
    });

    await billPayment.save();

    // Update bill payment status manually
    const totalPaid = await BillPayment.aggregate([
      {
        $match: {
          billId: new mongoose.Types.ObjectId(billId),
          status: "completed"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const paidAmount = totalPaid.length > 0 ? totalPaid[0].total : 0;
    
    // Update bill
    bill.paidAmount = paidAmount;
    if (paidAmount >= bill.totalAmount) {
      bill.status = "paid";
      bill.paidAt = new Date();
    }
    
    await bill.save();

    res.status(201).json({
      success: true,
      message: "Bank transfer payment recorded successfully",
      data: {
        billPayment,
        billStatus: bill.status,
        billRemainingBalance: bill.totalAmount - paidAmount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get payments for a bill
exports.getBillPayments = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const payments = await BillPayment.find({ billId })
      .populate("payerId", "name email phoneNumber")
      .populate("transactionId")
      .populate("receivedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get payment history for tenant
exports.getTenantPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { payerId: req.user.id };
    if (status) {
      query.status = status;
    }

    const payments = await BillPayment.find(query)
      .populate({
        path: "billId",
        populate: {
          path: "roomId",
          select: "roomNumber name"
        }
      })
      .populate("transactionId")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BillPayment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: payments,
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

// Get payment history for landlord (all their properties)
exports.getLandlordPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, roomId } = req.query;
    
    // First get all bills for landlord
    const billQuery = { landlordId: req.user.id };
    if (roomId) {
      billQuery.roomId = roomId;
    }
    
    const bills = await Bill.find(billQuery).select("_id");
    const billIds = bills.map(bill => bill._id);

    // Then get payments for these bills
    const paymentQuery = { billId: { $in: billIds } };
    if (status) {
      paymentQuery.status = status;
    }

    const payments = await BillPayment.find(paymentQuery)
      .populate("payerId", "name email phoneNumber")
      .populate({
        path: "billId",
        populate: {
          path: "roomId",
          select: "roomNumber name"
        }
      })
      .populate("transactionId")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BillPayment.countDocuments(paymentQuery);

    res.status(200).json({
      success: true,
      data: payments,
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

// Get payment details
exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await BillPayment.findById(paymentId)
      .populate("payerId", "name email phoneNumber profileImage")
      .populate({
        path: "billId",
        populate: [
          { path: "roomId", select: "roomNumber name" },
          { path: "landlordId", select: "name email phoneNumber" }
        ]
      })
      .populate("transactionId")
      .populate("receivedBy", "name email");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Refund payment (landlord action) - without transactions
exports.refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { refundReason } = req.body;
    
    const payment = await BillPayment.findById(paymentId)
      .populate("billId");
      
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    // Verify user is the landlord
    if (payment.billId.landlordId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the landlord can refund payments"
      });
    }

    if (payment.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Payment is already refunded"
      });
    }

    // If payment was made via wallet, refund to wallet
    if (payment.paymentMethod === "wallet" && payment.transactionId) {
      const user = await User.findById(payment.payerId);
      
      // Create refund transaction
      const refundTransaction = new Transaction({
        user: payment.payerId,
        type: "deposit", // Refund is like a deposit
        amount: payment.amount,
        status: "success",
        message: `Refund for payment ${payment._id}: ${refundReason}`,
        balanceBefore: user.wallet.balance,
        balanceAfter: user.wallet.balance + payment.amount,
        relatedBillPayment: payment._id
      });

      await refundTransaction.save();

      // Update user wallet balance
      user.wallet.balance += payment.amount;
      user.wallet.transactions.push(refundTransaction._id);
      await user.save();
    }

    // Update payment status
    payment.status = "refunded";
    payment.refundedAt = new Date();
    payment.refundReason = refundReason;
    payment.notes = payment.notes ? `${payment.notes}. Refunded: ${refundReason}` : `Refunded: ${refundReason}`;
    await payment.save();

    // Update bill payment status after refund
    const bill = await Bill.findById(payment.billId._id);
    
    // Recalculate total paid amount (excluding refunded payments)
    const totalPaid = await BillPayment.aggregate([
      {
        $match: {
          billId: new mongoose.Types.ObjectId(payment.billId._id),
          status: "completed"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const paidAmount = totalPaid.length > 0 ? totalPaid[0].total : 0;
    
    // Update bill
    bill.paidAmount = paidAmount;
    if (paidAmount >= bill.totalAmount) {
      bill.status = "paid";
      bill.paidAt = new Date();
    } else if (paidAmount > 0) {
      bill.status = "partial_paid";
      bill.paidAt = null;
    } else {
      bill.status = "sent";
      bill.paidAt = null;
    }
    
    await bill.save();

    res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      data: {
        payment,
        billStatus: bill.status,
        billRemainingBalance: bill.totalAmount - paidAmount
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};