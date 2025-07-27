// models/RoomOccupancy.js
const mongoose = require("mongoose");

const roomOccupancySchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Room ID is required"],
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
    },
    // REMOVED: tenancyAgreementId (no longer needed)
    isRepresentative: {
      type: Boolean,
      default: false,
    },
    moveInDate: {
      type: Date,
      required: [true, "Move in date is required"],
      default: Date.now,
    },
    moveOutDate: {
      type: Date,
    },
    // Store rent amount at time of move-in (can be different from room base rent)
    monthlyRent: {
      type: Number,
      required: [true, "Monthly rent is required"],
      min: [0, "Monthly rent cannot be negative"],
    },
    // Deposit paid by tenant
    depositPaid: {
      type: Number,
      min: [0, "Deposit cannot be negative"],
      default: 0,
    },
    status: {
      type: String,
      required: [true, "Occupancy status is required"],
      enum: {
        values: ["active", "moved_out", "terminated"],
        message: "Status must be active, moved_out, or terminated",
      },
      default: "active",
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
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    // Additional tenant-specific settings
    settings: {
      // Custom utility rates for this tenant (if different from room defaults)
      waterRate: {
        type: Number,
        min: [0, "Water rate cannot be negative"],
      },
      electricityRate: {
        type: Number,
        min: [0, "Electricity rate cannot be negative"],
      },
      // Any additional monthly charges specific to this tenant
      additionalCharges: [
        {
          name: {
            type: String,
            required: true,
            trim: true,
          },
          amount: {
            type: Number,
            required: true,
            min: [0, "Additional charge cannot be negative"],
          },
          description: {
            type: String,
            trim: true,
          },
        },
      ],
      contractSigned: { type: Boolean, default: false },
      contractSignedAt: Date,
      contractDeclined: { type: Boolean, default: false },
      contractDeclinedAt: Date,
      tenancyAgreementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TenancyAgreement",
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
roomOccupancySchema.index({ roomId: 1, status: 1 });
roomOccupancySchema.index({ tenantId: 1, status: 1 });
roomOccupancySchema.index({ moveInDate: 1 });
roomOccupancySchema.index({ moveOutDate: 1 });

// Ensure only one representative per active room
roomOccupancySchema.index(
  { roomId: 1, isRepresentative: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isRepresentative: true,
      status: "active",
    },
  }
);

// Virtual for duration in room
roomOccupancySchema.virtual("durationInDays").get(function () {
  const endDate = this.moveOutDate || new Date();
  const startDate = this.moveInDate;
  return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for current status display
roomOccupancySchema.virtual("statusDisplay").get(function () {
  switch (this.status) {
    case "active":
      return "Đang ở";
    case "moved_out":
      return "Đã chuyển đi";
    case "terminated":
      return "Chấm dứt hợp đồng";
    default:
      return this.status;
  }
});

// Instance method to calculate total rent paid
roomOccupancySchema.methods.calculateTotalRent = function () {
  return this.monthlyRent * (this.durationInDays / 30);
};

// Static method to get room occupancy history
roomOccupancySchema.statics.getRoomHistory = function (roomId) {
  return this.find({ roomId })
    .populate("tenantId", "name email phoneNumber")
    .sort({ moveInDate: -1 });
};

// Static method to get tenant's rental history
roomOccupancySchema.statics.getTenantHistory = function (tenantId) {
  return this.find({ tenantId })
    .populate("roomId", "roomNumber name")
    .populate({
      path: "roomId",
      populate: {
        path: "accommodationId",
        select: "name address",
      },
    })
    .sort({ moveInDate: -1 });
};

module.exports = mongoose.model("RoomOccupancy", roomOccupancySchema);
