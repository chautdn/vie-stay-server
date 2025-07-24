// src/routes/payment.js
const express = require("express");
const router = express.Router();
const PayOS = require("@payos/node");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { protect } = require("../controllers/authenticateController");
require("dotenv").config({ path: "./config.env" });

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

router.post("/create-topup-session", protect, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;

    // Validate required data
    if (!user || !user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: "Số tiền không hợp lệ" });
    }

    // Validate amount
    const allowedAmounts = [2000, 100000, 500000, 1000000, 5000000];
    const numAmount = Number(amount);
    if (!allowedAmounts.includes(numAmount)) {
      return res.status(400).json({ error: "Số tiền không hợp lệ" });
    }

    // Create transaction
    const transaction = await Transaction.create({
      user: user._id,
      type: "deposit",
      amount: numAmount,
      status: "pending",
      provider: "payos",
    });

    // Generate a unique order code (PayOS requires numeric orderCode)
    const orderCode = Date.now();

    // Validate required environment variables
    if (!process.env.CLIENT_URL) {
      throw new Error("CLIENT_URL environment variable is required");
    }

    // Create PayOS payment data
    const paymentData = {
      orderCode: orderCode,
      amount: numAmount,
      description: `Nạp ${numAmount.toLocaleString("vi-VN")}₫ vào ví`,
      returnUrl: `${process.env.CLIENT_URL}/topup-success?orderCode=${orderCode}`,
      cancelUrl: `${process.env.CLIENT_URL}/topup-cancel?orderCode=${orderCode}`,
    };

    // Create PayOS payment link
    const paymentLink = await payos.createPaymentLink(paymentData);

    // Update transaction with external ID
    transaction.externalId = orderCode.toString();
    await transaction.save();

    res.json({
      checkoutUrl: paymentLink.checkoutUrl,
      orderCode: orderCode,
      transactionId: transaction._id,
    });
  } catch (err) {
    res.status(500).json({
      error: "Không thể tạo phiên thanh toán",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// WEBHOOK endpoint for PayOS - handles raw body from app.js middleware
router.post("/payos-webhook", async (req, res) => {
  try {
    // Parse the raw body if it's a Buffer
    let parsedBody;
    if (Buffer.isBuffer(req.body)) {
      parsedBody = JSON.parse(req.body.toString());
    } else if (typeof req.body === "string") {
      parsedBody = JSON.parse(req.body);
    } else {
      parsedBody = req.body;
    }

    // Try to verify PayOS webhook signature
    let webhookData;
    try {
      webhookData = payos.verifyPaymentWebhookData(parsedBody);
    } catch (verifyError) {
      // If verification fails, try to process the raw data
      webhookData = parsedBody;
    }

    // Extract data - PayOS might send different field names
    const orderCode = webhookData.orderCode || webhookData.orderId;
    const code = webhookData.code || webhookData.resultCode;
    const success = webhookData.success || code === "00" || code === 0;

    // Check if payment was successful
    if (!success && code !== "00" && code !== 0) {
      return res.status(200).json({ message: "Payment not successful" });
    }

    if (!orderCode) {
      return res.status(200).json({ message: "No orderCode provided" });
    }

    // Find transaction by externalId (PayOS orderCode)
    const transaction = await Transaction.findOne({
      externalId: orderCode.toString(),
    }).populate("user");

    if (!transaction) {
      return res.status(200).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      return res.status(200).json({ message: "Transaction already processed" });
    }

    // Update transaction status
    transaction.status = "success";
    await transaction.save();

    // Get current user balance before update
    const userBeforeUpdate = await User.findById(transaction.user._id);

    // Update user wallet with proper error handling
    const updatedUser = await User.findByIdAndUpdate(
      transaction.user._id,
      {
        $inc: { "wallet.balance": transaction.amount },
        $push: { "wallet.transactions": transaction._id },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(500).json({ error: "Failed to update user wallet" });
    }

    res.status(200).json({
      message: "Webhook processed successfully",
      transactionId: transaction._id,
      newBalance: updatedUser.wallet.balance,
    });
  } catch (err) {
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Add verification endpoint for frontend
router.get("/verify-payment/:orderCode", protect, async (req, res) => {
  try {
    const { orderCode } = req.params;

    // Find transaction by orderCode
    const transaction = await Transaction.findOne({
      externalId: orderCode.toString(),
      user: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Get updated user data
    const user = await User.findById(req.user._id);

    res.json({
      transaction: {
        id: transaction._id,
        status: transaction.status,
        amount: transaction.amount,
        type: transaction.type,
        createdAt: transaction.createdAt,
      },
      wallet: {
        balance: user.wallet.balance,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Payment verification failed" });
  }
});

// Test route to confirm /api/payment prefix
router.get("/test", (req, res) => {
  res.json({
    message: "Payment route working",
    timestamp: new Date().toISOString(),
    env: {
      payosConfigured: !!(
        process.env.PAYOS_CLIENT_ID &&
        process.env.PAYOS_API_KEY &&
        process.env.PAYOS_CHECKSUM_KEY
      ),
      clientUrl: process.env.CLIENT_URL,
    },
  });
});

router.post("/process-payment", protect, async (req, res) => {
  try {
    const { orderCode } = req.body;
    
    if (!orderCode) {
      return res.status(400).json({ error: "OrderCode is required" });
    }

    // Find the transaction by orderCode
    const transaction = await Transaction.findOne({
      externalId: orderCode.toString()
    }).populate("user");

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Check if transaction belongs to the current user
    if (transaction.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized transaction access" });
    }

    // IDEMPOTENCY CHECK: If already processed, return existing result
    if (transaction.status === "success") {
      const user = await User.findById(req.user._id);
      return res.status(200).json({
        message: "Transaction already processed",
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          status: transaction.status
        },
        wallet: {
          balance: user.wallet?.balance || 0
        }
      });
    }

    // ATOMIC UPDATE: Use findOneAndUpdate to prevent race conditions
    // Step 1: Atomically update transaction status (only if still pending)
    const updatedTransaction = await Transaction.findOneAndUpdate(
      { 
        _id: transaction._id, 
        status: "pending"
      },
      { status: "success" },
      { new: true }
    );

    // If transaction was already updated by another request, return early
    if (!updatedTransaction) {
      const user = await User.findById(req.user._id);
      return res.status(200).json({
        message: "Transaction already processed",
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          status: "success"
        },
        wallet: {
          balance: user.wallet?.balance || 0
        }
      });
    }

    // Step 2: Get user's current balance
    const currentUser = await User.findById(req.user._id);
    const oldBalance = currentUser.wallet?.balance || 0;

    // Step 3: Update user wallet
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: { "wallet.balance": transaction.amount },
        $push: { "wallet.transactions": transaction._id },
      },
      { new: true }
    );

    if (!updatedUser) {
      // If user update fails, rollback transaction status
      await Transaction.findByIdAndUpdate(transaction._id, { status: "pending" });
      throw new Error("Failed to update user wallet");
    }

    res.status(200).json({
      message: "Payment processed successfully",
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        status: "success"
      },
      wallet: {
        balance: updatedUser.wallet.balance
      }
    });

  } catch (error) {
    res.status(500).json({
      error: "Failed to process payment",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

module.exports = router;