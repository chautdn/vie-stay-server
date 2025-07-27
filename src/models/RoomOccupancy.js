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
    tenancyAgreementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TenancyAgreement",
      required: [true, "Tenancy Agreement ID is required"],
    },
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
roomOccupancySchema.index({ tenancyAgreementId: 1 });

// Ensure only one representative per active room
roomOccupancySchema.index(
  { roomId: 1, isRepresentative: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      isRepresentative: true, 
      status: "active" 
    } 
  }
);

module.exports = mongoose.model("RoomOccupancy", roomOccupancySchema);