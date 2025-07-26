// models/RoomOccupancy.js - Track who stayed in room and when
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
      required: [true, "Tenancy agreement ID is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      // null means still occupying
    },
    isRepresentative: {
      type: Boolean,
      default: false,
    },
    // Track when someone was set as representative
    representativeSetAt: {
      type: Date,
    },
    representativeSetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // landlord who set this person as representative
    },
    // Track removal
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // landlord who removed this tenant
    },
    removedAt: {
      type: Date,
    },
    removalReason: {
      type: String,
      trim: true,
      maxlength: [500, "Removal reason cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["active", "moved_out", "removed"],
      default: "active",
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
roomOccupancySchema.index({ tenantId: 1 });
roomOccupancySchema.index({ tenancyAgreementId: 1 });
roomOccupancySchema.index({ roomId: 1, isRepresentative: 1 });

// Ensure only one active representative per room
roomOccupancySchema.index(
  { roomId: 1, isRepresentative: 1, status: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      isRepresentative: true, 
      status: "active" 
    } 
  }
);

// Static method to find current representative
roomOccupancySchema.statics.getCurrentRepresentative = function(roomId) {
  return this.findOne({
    roomId: roomId,
    status: "active",
    isRepresentative: true,
  }).populate("tenantId");
};

// Static method to find all current tenants in a room
roomOccupancySchema.statics.getCurrentTenants = function(roomId) {
  return this.find({
    roomId: roomId,
    status: "active",
  }).populate("tenantId");
};

// Static method to set representative
roomOccupancySchema.statics.setRepresentative = async function(roomId, tenantId, setBy) {
  // Remove current representative
  await this.updateMany(
    { roomId: roomId, isRepresentative: true },
    { 
      isRepresentative: false,
      $unset: { representativeSetAt: 1, representativeSetBy: 1 }
    }
  );

  // Set new representative
  return await this.findOneAndUpdate(
    { roomId: roomId, tenantId: tenantId, status: "active" },
    {
      isRepresentative: true,
      representativeSetAt: new Date(),
      representativeSetBy: setBy,
    },
    { new: true }
  );
};

module.exports = mongoose.model("RoomOccupancy", roomOccupancySchema);