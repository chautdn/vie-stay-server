// models/Transaction.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "deposit_received",
        "rent_received",
        "withdrawal",
        "refund_deposit",
        "penalty",
        "bonus",
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
    description: {
      type: String,
      required: true,
    },
    transactionId: {
      type: String,
      unique: true,
      required: true,
    },
    relatedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    metadata: {
      type: Object,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
