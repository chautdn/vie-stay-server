const mongoose = require("mongoose");

const withdrawalRequestSchema = new mongoose.Schema(
  {
    // Thông tin cơ bản
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    agreementConfirmationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgreementConfirmation",
      required: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    // Thông tin rút tiền
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    requestType: {
      type: String,
      enum: ["deposit_refund", "early_termination"],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    vnpayInfo: {
      bankCode: {
        type: String,
        required: true,
      },
      accountNumber: {
        type: String,
        required: true,
      },
      accountName: {
        type: String,
        required: true,
      },
    },

    // Trạng thái
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "pending",
    },

    // Xử lý bởi landlord
    landlordResponse: {
      approvedAt: Date,
      rejectedAt: Date,
      deductionAmount: {
        type: Number,
        default: 0,
      },
      deductionReason: String,
      responseNote: String,
    },

    // Xử lý VNPay
    paymentProcessing: {
      processedAt: Date,
      completedAt: Date,
      failedAt: Date,
      vnpayTxnRef: String,
      vnpayTransactionNo: String,
      vnpayPaymentUrl: String, // ✅ THÊM field này
      vnpayResponseCode: String, // ✅ THÊM field này
      failureReason: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
withdrawalRequestSchema.index({ tenantId: 1, status: 1 });
withdrawalRequestSchema.index({ landlordId: 1, status: 1 });
withdrawalRequestSchema.index({ agreementConfirmationId: 1 });
withdrawalRequestSchema.index({ createdAt: -1 });
withdrawalRequestSchema.index({ "paymentProcessing.vnpayTxnRef": 1 });

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
