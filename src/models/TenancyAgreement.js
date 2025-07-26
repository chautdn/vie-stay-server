const mongoose = require("mongoose");

const tenancyAgreementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
    },
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
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      validate: {
        validator: function (value) {
          return value >= new Date().setHours(0, 0, 0, 0);
        },
        message: "Start date cannot be in the past",
      },
    },
    endDate: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value) return true; // Optional field
          return value > this.startDate;
        },
        message: "End date must be after start date",
      },
    },
    monthlyRent: {
      type: Number,
      required: [true, "Monthly rent is required"],
      min: [0, "Monthly rent cannot be negative"],
    },
    deposit: {
      type: Number,
      required: [true, "Deposit amount is required"],
      min: [0, "Deposit cannot be negative"],
    },
    utilityRates: {
      water: {
        type: {
          type: String,
          enum: {
            values: ["per_cubic_meter", "fixed"],
            message: "Water billing type must be per_cubic_meter or fixed",
          },
        },
        rate: {
          type: Number,
          min: [0, "Water rate cannot be negative"],
        },
      },
      electricity: {
        type: {
          type: String,
          enum: {
            values: ["per_kwh", "fixed"],
            message: "Electricity billing type must be per_kwh or fixed",
          },
        },
        rate: {
          type: Number,
          min: [0, "Electricity rate cannot be negative"],
        },
      },
      internet: {
        type: {
          type: String,
          enum: {
            values: ["fixed"],
            message: "Internet billing type must be fixed",
          },
          default: "fixed",
        },
        rate: {
          type: Number,
          min: [0, "Internet rate cannot be negative"],
        },
      },
      sanitation: {
        type: {
          type: String,
          enum: {
            values: ["fixed"],
            message: "Sanitation billing type must be fixed",
          },
          default: "fixed",
        },
        rate: {
          type: Number,
          min: [0, "Sanitation rate cannot be negative"],
        },
      },
    },
    additionalFees: [
      {
        name: {
          type: String,
          required: [true, "Fee name is required"],
          trim: true,
          enum: {
            values: ["parking", "security", "maintenance", "cleaning", "other"],
            message: "Please select a valid fee type",
          },
        },
        amount: {
          type: Number,
          required: [true, "Fee amount is required"],
          min: [0, "Fee amount cannot be negative"],
        },
        type: {
          type: String,
          required: [true, "Fee type is required"],
          enum: {
            values: ["monthly", "one_time"],
            message: "Fee type must be monthly or one_time",
          },
        },
        description: {
          type: String,
          trim: true,
          maxlength: [200, "Fee description cannot exceed 200 characters"],
        },
      },
    ],
    status: {
      type: String,
      required: [true, "Agreement status is required"],
      enum: {
        values: ["active", "ended", "terminated"],
        message: "Status must be active, ended, or terminated",
      },
      default: "active",
    },
    contractDocument: {
      type: String,
      match: [
        /^https?:\/\/.+\.(pdf|doc|docx)$/i,
        "Please provide a valid document URL",
      ],
    },
    terminationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Termination reason cannot exceed 500 characters"],
    },
    terminatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    terminatedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    renewalOptions: {
      autoRenew: {
        type: Boolean,
        default: false,
      },
      renewalPeriod: {
        type: Number, // in months
        min: [1, "Renewal period must be at least 1 month"],
      },
      renewalNotice: {
        type: Number, // days before end date
        min: [7, "Renewal notice must be at least 7 days"],
        default: 30,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
tenancyAgreementSchema.index({ tenantId: 1 });
tenancyAgreementSchema.index({ roomId: 1 });
tenancyAgreementSchema.index({ accommodationId: 1 });
tenancyAgreementSchema.index({ landlordId: 1 });
tenancyAgreementSchema.index({ startDate: 1 });
tenancyAgreementSchema.index({ endDate: 1 });
tenancyAgreementSchema.index({ status: 1 });

// Compound indexes
tenancyAgreementSchema.index({ roomId: 1, status: 1 });
tenancyAgreementSchema.index({ tenantId: 1, status: 1 });


module.exports = mongoose.model("TenancyAgreement", tenancyAgreementSchema);
