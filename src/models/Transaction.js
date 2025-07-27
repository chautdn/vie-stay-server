// models/Transaction.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["deposit", "withdraw", "payment"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    provider: {
      type: String,
    },
    externalId: {
      type: String,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true, 
    },
    relatedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    message: String,
    // Additional fields for wallet functionality (non-breaking additions)
    balanceBefore: {
      type: Number,
      min: [0, "Balance before cannot be negative"],
    },
    balanceAfter: {
      type: Number,
      min: [0, "Balance after cannot be negative"],
    },
    relatedBill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
    },
    relatedBillPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BillPayment",
    },
  },
  { timestamps: true }
);

// Indexes
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ relatedBill: 1 });
transactionSchema.index({ relatedBillPayment: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);