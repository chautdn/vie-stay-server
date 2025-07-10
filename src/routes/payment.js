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
  console.log("Received POST to /api/payment/create-topup-session");

  try {
    const { amount } = req.body;
    const user = req.user;

    // Debug logs
    console.log("Request body:", req.body);
    console.log("User:", user ? user._id : "No user");
    console.log("Amount:", amount, typeof amount);

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

    console.log("Transaction created:", transaction._id);

    // Generate a unique order code (PayOS requires numeric orderCode)
    const orderCode = Date.now(); // Use timestamp as orderCode

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

    console.log("PayOS payment data:", paymentData);

    // Create PayOS payment link
    const paymentLink = await payos.createPaymentLink(paymentData);
    console.log("PayOS response:", paymentLink);

    // Update transaction with external ID
    transaction.externalId = orderCode.toString();
    await transaction.save();

    res.json({
      checkoutUrl: paymentLink.checkoutUrl,
      orderCode: orderCode,
      transactionId: transaction._id,
    });
  } catch (err) {
    console.error("PayOS error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    res.status(500).json({
      error: "Không thể tạo phiên thanh toán",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// WEBHOOK endpoint for PayOS - handles raw body from app.js middleware
router.post("/payos-webhook", async (req, res) => {
  try {
    console.log("=== PAYOS WEBHOOK RECEIVED ===");
    console.log("Headers:", req.headers);
    console.log("Raw body type:", typeof req.body);
    console.log("Raw body:", req.body);

    // Parse the raw body if it's a Buffer
    let parsedBody;
    if (Buffer.isBuffer(req.body)) {
      parsedBody = JSON.parse(req.body.toString());
    } else if (typeof req.body === "string") {
      parsedBody = JSON.parse(req.body);
    } else {
      parsedBody = req.body;
    }

    console.log("Parsed body:", parsedBody);

    // Try to verify PayOS webhook signature
    let webhookData;
    try {
      webhookData = payos.verifyPaymentWebhookData(parsedBody);
      console.log("Verified webhook data:", webhookData);
    } catch (verifyError) {
      console.error("Webhook verification failed:", verifyError.message);
      // If verification fails, try to process the raw data
      webhookData = parsedBody;
    }

    // Extract data - PayOS might send different field names
    const orderCode = webhookData.orderCode || webhookData.orderId;
    const code = webhookData.code || webhookData.resultCode;
    const success = webhookData.success || code === "00" || code === 0;
    const amount = webhookData.amount;
    const status = webhookData.status;

    console.log("Extracted webhook data:", {
      orderCode,
      code,
      success,
      amount,
      status,
    });

    // Check if payment was successful
    if (!success && code !== "00" && code !== 0) {
      console.log("Payment not successful:", { code, status });
      return res.status(200).json({ message: "Payment not successful" });
    }

    if (!orderCode) {
      console.log("No orderCode found in webhook data");
      return res.status(200).json({ message: "No orderCode provided" });
    }

    // Find transaction by externalId (PayOS orderCode)
    const transaction = await Transaction.findOne({
      externalId: orderCode.toString(),
    }).populate("user");

    if (!transaction) {
      console.log("Transaction not found for orderCode:", orderCode);
      return res.status(200).json({ message: "Transaction not found" });
    }

    console.log("Found transaction:", {
      id: transaction._id,
      status: transaction.status,
      amount: transaction.amount,
      userId: transaction.user._id,
    });

    if (transaction.status === "success") {
      console.log("Transaction already processed:", transaction._id);
      return res.status(200).json({ message: "Transaction already processed" });
    }

    // Update transaction status
    transaction.status = "success";
    await transaction.save();
    console.log("Transaction status updated to success");

    // Get current user balance before update
    const userBeforeUpdate = await User.findById(transaction.user._id);
    console.log("User balance before update:", userBeforeUpdate.wallet.balance);

    // Update user wallet with proper error handling
    const updatedUser = await User.findByIdAndUpdate(
      transaction.user._id,
      {
        $inc: { "wallet.balance": transaction.amount },
        $push: { "wallet.transactions": transaction._id },
      },
      { new: true } // Return updated document
    );

    if (!updatedUser) {
      console.error("Failed to update user wallet - user not found");
      return res.status(500).json({ error: "Failed to update user wallet" });
    }

    console.log("Wallet updated successfully:", {
      userId: transaction.user._id,
      oldBalance: userBeforeUpdate.wallet.balance,
      newBalance: updatedUser.wallet.balance,
      amountAdded: transaction.amount,
      transactionId: transaction._id,
    });

    console.log("=== WEBHOOK PROCESSED SUCCESSFULLY ===");

    res.status(200).json({
      message: "Webhook processed successfully",
      transactionId: transaction._id,
      newBalance: updatedUser.wallet.balance,
    });
  } catch (err) {
    console.error("=== WEBHOOK ERROR ===");
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
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
    console.error("Payment verification error:", err);
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

    console.log("=== MANUAL PAYMENT PROCESSING ===");
    console.log("OrderCode:", orderCode);
    console.log("User:", req.user._id);

    // Find the transaction by orderCode
    const transaction = await Transaction.findOne({
      externalId: orderCode.toString()
    }).populate("user");

    if (!transaction) {
      console.log("Transaction not found for orderCode:", orderCode);
      return res.status(404).json({ error: "Transaction not found" });
    }

    console.log("Found transaction:", {
      id: transaction._id,
      amount: transaction.amount,
      status: transaction.status,
      userId: transaction.user._id
    });

    // Check if transaction belongs to the current user
    if (transaction.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized transaction access" });
    }

    // 🔥 IDEMPOTENCY CHECK: If already processed, return existing result
    if (transaction.status === "success") {
      console.log("⚠️ Transaction already processed - returning cached result");
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

    // 🔥 ATOMIC UPDATE: Use findOneAndUpdate to prevent race conditions
    console.log("Processing payment with atomic update...");

    // Step 1: Atomically update transaction status (only if still pending)
    const updatedTransaction = await Transaction.findOneAndUpdate(
      { 
        _id: transaction._id, 
        status: "pending"  // 🔥 Only update if still pending
      },
      { status: "success" },
      { new: true }
    );

    // If transaction was already updated by another request, return early
    if (!updatedTransaction) {
      console.log("⚠️ Transaction was already processed by another request");
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

    console.log("✅ Transaction status updated to success");

    // Step 2: Get user's current balance
    const currentUser = await User.findById(req.user._id);
    const oldBalance = currentUser.wallet?.balance || 0;

    console.log("Current balance:", oldBalance);
    console.log("Adding amount:", transaction.amount);

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

    console.log("✅ Wallet updated successfully:", {
      oldBalance: oldBalance,
      newBalance: updatedUser.wallet.balance,
      amountAdded: transaction.amount
    });

    console.log("=== PAYMENT PROCESSED SUCCESSFULLY ===");

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
    console.error("=== PAYMENT PROCESSING ERROR ===");
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      orderCode: req.body.orderCode
    });

    res.status(500).json({
      error: "Failed to process payment",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

module.exports = router;
