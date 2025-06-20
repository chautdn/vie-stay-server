const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
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
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    // Thông tin thanh toán
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentType: {
      type: String,
      enum: ["deposit", "monthly_rent", "utility", "penalty", "refund"],
      default: "deposit",
    },
    paymentMethod: {
      type: String,
      enum: ["vnpay", "momo", "zalopay", "bank_transfer", "cash"],
      required: true,
    },

    // Trạng thái thanh toán
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
    },

    // Thông tin giao dịch
    transactionId: {
      type: String,
      required: true,
    },
    externalTransactionId: String, // ID từ VNPay, MoMo, etc.

    // Chi tiết thanh toán
    description: String,
    notes: String,

    // Thông tin gateway
    gatewayResponse: mongoose.Schema.Types.Mixed,
    gatewayData: mongoose.Schema.Types.Mixed,

    // Thời gian
    paidAt: Date,
    failedAt: Date,
    cancelledAt: Date,
    refundedAt: Date,

    // Lý do
    failureReason: String,
    cancellationReason: String,
    refundReason: String,

    // Thông tin hoàn tiền
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundTransactionId: String,

    // Metadata
    metadata: mongoose.Schema.Types.Mixed,

    // Tháng năm (cho monthly rent)
    forMonth: Number, // 1-12
    forYear: Number, // 2024, 2025, etc.
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentSchema.index({ tenantId: 1, status: 1 });
paymentSchema.index({ landlordId: 1, status: 1 });
paymentSchema.index({ transactionId: 1 }, { unique: true });
paymentSchema.index({ agreementConfirmationId: 1 });
paymentSchema.index({ roomId: 1, paymentType: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ forMonth: 1, forYear: 1, roomId: 1 }); // For monthly rent

// Pre-save middleware để tạo transactionId
paymentSchema.pre("save", function (next) {
  if (this.isNew && !this.transactionId) {
    // Tạo transaction ID unique
    this.transactionId = `VIE${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  next();
});

// Instance methods
paymentSchema.methods.markAsPaid = function () {
  this.status = "completed";
  this.paidAt = new Date();
  return this.save();
};

paymentSchema.methods.markAsFailed = function (reason) {
  this.status = "failed";
  this.failedAt = new Date();
  this.failureReason = reason;
  return this.save();
};

paymentSchema.methods.markAsCancelled = function (reason) {
  this.status = "cancelled";
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

// Static methods
paymentSchema.statics.findByTransactionId = function (transactionId) {
  return this.findOne({ transactionId });
};

paymentSchema.statics.getTotalPaidByTenant = function (
  tenantId,
  startDate,
  endDate
) {
  const query = {
    tenantId,
    status: "completed",
  };

  if (startDate && endDate) {
    query.paidAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);
};

paymentSchema.statics.getMonthlyRevenueByLandlord = function (
  landlordId,
  year
) {
  return this.aggregate([
    {
      $match: {
        landlordId: mongoose.Types.ObjectId(landlordId),
        status: "completed",
        paidAt: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1),
        },
      },
    },
    {
      $group: {
        _id: { $month: "$paidAt" },
        totalRevenue: { $sum: "$amount" },
        transactionCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

// Virtual fields
paymentSchema.virtual("isCompleted").get(function () {
  return this.status === "completed";
});

paymentSchema.virtual("isPending").get(function () {
  return this.status === "pending";
});

paymentSchema.virtual("isFailed").get(function () {
  return this.status === "failed";
});

// Transform toJSON
paymentSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.gatewayData; // Ẩn sensitive data
    return ret;
  },
});

module.exports = mongoose.model("Payment", paymentSchema);
