// models/Bill.js
const mongoose = require("mongoose");

const billItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Bill item name is required"],
    trim: true,
  },
  type: {
    type: String,
    required: [true, "Bill item type is required"],
    enum: {
      values: ["rent", "water", "electricity", "internet", "sanitation", "parking", "security", "maintenance", "cleaning", "other"],
      message: "Please select a valid bill item type",
    },
  },
  amount: {
    type: Number,
    required: [true, "Bill item amount is required"],
    min: [0, "Bill item amount cannot be negative"],
  },
  quantity: {
    type: Number,
    default: 1,
    min: [0, "Quantity cannot be negative"],
  },
  unitPrice: {
    type: Number,
    min: [0, "Unit price cannot be negative"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, "Description cannot exceed 200 characters"],
  },
  // For utility items - meter readings
  previousReading: {
    type: Number,
    min: [0, "Previous reading cannot be negative"],
  },
  currentReading: {
    type: Number,
    min: [0, "Current reading cannot be negative"],
  },
  consumption: {
    type: Number,
    min: [0, "Consumption cannot be negative"],
  },
});

const billSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Room ID is required"],
    },
    accommodationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accommodation",
      required: [true, "Accommodation ID is required"],
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Landlord ID is required"],
    },
    // Bill is sent to room representative
    representativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Representative ID is required"],
    },
    // All tenants during this billing period (snapshot)
    tenantsAtTimeOfBilling: [{
      tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      occupancyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RoomOccupancy",
        required: true,
      },
      daysInPeriod: {
        type: Number,
        required: true,
        min: [0, "Days in period cannot be negative"],
      }
    }],
    billNumber: {
      type: String,
      required: [true, "Bill number is required"],
      unique: true,
    },
    billingPeriod: {
      from: {
        type: Date,
        required: [true, "Billing period start date is required"],
      },
      to: {
        type: Date,
        required: [true, "Billing period end date is required"],
      },
    },
    items: [billItemSchema],
    subtotal: {
      type: Number,
      required: [true, "Subtotal is required"],
      min: [0, "Subtotal cannot be negative"],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"],
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    status: {
      type: String,
      required: [true, "Bill status is required"],
      enum: {
        values: ["draft", "sent", "viewed", "paid", "overdue", "cancelled"],
        message: "Please select a valid bill status",
      },
      default: "draft",
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, "Paid amount cannot be negative"],
    },
    paidAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    // Track when bill was viewed by tenant
    viewedAt: {
      type: Date,
    },
    viewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Late fees
    lateFee: {
      amount: {
        type: Number,
        default: 0,
        min: [0, "Late fee cannot be negative"],
      },
      appliedAt: {
        type: Date,
      },
    },
    // Bill type for easier filtering
    billType: {
      type: String,
      enum: {
        values: ["monthly", "custom", "deposit", "maintenance", "utility"],
        message: "Please select a valid bill type",
      },
      default: "custom",
    },
    // For recurring bills
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringSettings: {
      frequency: {
        type: String,
        enum: ["monthly", "quarterly", "annually"],
      },
      nextDueDate: Date,
      autoGenerate: {
        type: Boolean,
        default: false,
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
billSchema.index({ roomId: 1, status: 1 });
billSchema.index({ representativeId: 1 });
billSchema.index({ landlordId: 1 });
billSchema.index({ billNumber: 1 });
billSchema.index({ dueDate: 1, status: 1 });
billSchema.index({ "billingPeriod.from": 1, "billingPeriod.to": 1 });
billSchema.index({ accommodationId: 1 });
billSchema.index({ billType: 1 });
billSchema.index({ isRecurring: 1 });

// Virtual for remaining balance
billSchema.virtual("remainingBalance").get(function () {
  return this.totalAmount - this.paidAmount;
});

// Virtual for payment status
billSchema.virtual("paymentStatus").get(function () {
  if (this.paidAmount === 0) return "unpaid";
  if (this.paidAmount >= this.totalAmount) return "fully_paid";
  return "partially_paid";
});

// Virtual for overdue status
billSchema.virtual("isOverdue").get(function () {
  return new Date() > this.dueDate && this.status !== "paid";
});

// Virtual for days overdue
billSchema.virtual("daysOverdue").get(function () {
  if (!this.isOverdue) return 0;
  return Math.ceil((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
});

// Auto-generate bill number
billSchema.pre("save", async function (next) {
  if (!this.billNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, new Date().getMonth(), 1),
        $lt: new Date(year, new Date().getMonth() + 1, 1),
      },
    });
    this.billNumber = `BILL${year}${month}${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Calculate totals before saving
billSchema.pre("save", function (next) {
  if (this.isModified("items")) {
    this.subtotal = this.items.reduce((total, item) => total + item.amount, 0);
    this.totalAmount = this.subtotal + this.tax + this.lateFee.amount;
  }
  next();
});

// Static method to create quick rent bill
billSchema.statics.createRentBill = async function(roomId, representativeId, landlordId, accommodationId, period, amount) {
  const bill = new this({
    roomId,
    representativeId,
    landlordId,
    accommodationId,
    billType: "monthly",
    billingPeriod: period,
    items: [{
      name: "Monthly Rent",
      type: "rent",
      amount: amount,
      quantity: 1,
      unitPrice: amount,
      description: `Monthly rent for ${new Date(period.from).toLocaleDateString()} - ${new Date(period.to).toLocaleDateString()}`
    }],
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
  });
  
  return bill.save();
};

// Instance method to apply late fee
billSchema.methods.applyLateFee = function(feeAmount) {
  if (this.isOverdue && this.lateFee.amount === 0) {
    this.lateFee.amount = feeAmount;
    this.lateFee.appliedAt = new Date();
    this.totalAmount += feeAmount;
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get overdue bills
billSchema.statics.getOverdueBills = function() {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $nin: ["paid", "cancelled"] }
  }).populate("representativeId roomId");
};

module.exports = mongoose.model("Bill", billSchema);