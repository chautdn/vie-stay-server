const mongoose = require("mongoose");

const agreementConfirmationSchema = new mongoose.Schema(
  {
    rentalRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RentalRequest",
      required: true,
    },
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
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    confirmationToken: {
      type: String,
      required: true,
    },
    agreementTerms: {
      startDate: { type: Date, required: true },
      monthlyRent: { type: Number, required: true },
      deposit: { type: Number, required: true },
      notes: String,
      utilityRates: mongoose.Schema.Types.Mixed,
      additionalFees: [mongoose.Schema.Types.Mixed],
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "rejected", "expired"],
      default: "pending",
    },
    confirmedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    signatureStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    documentId: { type: String },
    signedContractPath: { type: String },
    signedAt: { type: Date },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    },
    // ✅ THÊM: Payment status tracking
    paymentStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    paidAt: Date,
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    tenancyAgreementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TenancyAgreement",
    },
  },
  {
    timestamps: true,
  }
);

agreementConfirmationSchema.index({ confirmationToken: 1 }, { unique: true });
agreementConfirmationSchema.index({ status: 1 });
agreementConfirmationSchema.index({ tenantId: 1 });
agreementConfirmationSchema.index({ expiresAt: 1 });
agreementConfirmationSchema.index({ paymentStatus: 1 }); // ✅ THÊM: Index cho payment status

module.exports = mongoose.model(
  "AgreementConfirmation",
  agreementConfirmationSchema
);
