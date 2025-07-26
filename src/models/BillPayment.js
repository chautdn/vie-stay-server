// models/BillPayment.js - Track payments for bills
const mongoose = require("mongoose");

const billPaymentSchema = new mongoose.Schema(
  {
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      required: [true, "Bill ID is required"],
    },
    payerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Payer ID is required"],
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Payment amount cannot be negative"],
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
      enum: {
        values: ["cash", "bank_transfer", "wallet", "online", "other"],
        message: "Please select a valid payment method",
      },
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    status: {
      type: String,
      required: [true, "Payment status is required"],
      enum: {
        values: ["pending", "completed", "failed", "refunded"],
        message: "Please select a valid payment status",
      },
      default: "pending",
    },
    paidAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    receiptUrl: {
      type: String,
    },
    // For partial payments
    isPartialPayment: {
      type: Boolean,
      default: false,
    },
    // Reference number from payment gateway or bank
    referenceNumber: {
      type: String,
      trim: true,
    },
    // For cash payments - who received it
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // For bank transfers
    bankTransferDetails: {
      fromAccount: String,
      toAccount: String,
      transferDate: Date,
      confirmationCode: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
billPaymentSchema.index({ billId: 1 });
billPaymentSchema.index({ payerId: 1 });
billPaymentSchema.index({ status: 1 });
billPaymentSchema.index({ paidAt: 1 });
billPaymentSchema.index({ paymentMethod: 1 });
billPaymentSchema.index({ referenceNumber: 1 });

// Compound indexes
billPaymentSchema.index({ billId: 1, status: 1 });
billPaymentSchema.index({ payerId: 1, status: 1 });

// Post-save middleware to update bill payment status
billPaymentSchema.post("save", async function() {
  if (this.status === "completed") {
    const Bill = mongoose.model("Bill");
    const bill = await Bill.findById(this.billId);
    
    if (bill) {
      // Calculate total paid amount for this bill
      const BillPayment = mongoose.model("BillPayment");
      const totalPaid = await BillPayment.aggregate([
        {
          $match: {
            billId: this.billId,
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
    }
  }
});

// Instance method to process payment
billPaymentSchema.methods.processPayment = async function() {
  this.status = "completed";
  this.paidAt = new Date();
  return await this.save();
};

// Instance method to refund payment
billPaymentSchema.methods.refundPayment = async function(reason) {
  this.status = "refunded";
  this.notes = this.notes ? `${this.notes}. Refunded: ${reason}` : `Refunded: ${reason}`;
  return await this.save();
};

// Static method to find payments by bill
billPaymentSchema.statics.findByBill = function(billId) {
  return this.find({ billId }).populate("payerId", "name email").sort({ createdAt: -1 });
};

// Static method to find payments by payer
billPaymentSchema.statics.findByPayer = function(payerId, status = null) {
  const query = { payerId };
  if (status) query.status = status;
  return this.find(query).populate("billId").sort({ createdAt: -1 });
};

module.exports = mongoose.model("BillPayment", billPaymentSchema);