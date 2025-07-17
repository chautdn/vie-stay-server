const mongoose = require("mongoose");

const rentalRequestSchema = new mongoose.Schema(
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
    message: {
      type: String,
      trim: true,
      maxlength: [500, "Message cannot exceed 500 characters"],
    },
    proposedStartDate: {
      type: Date,
      required: [true, "Proposed start date is required"],
      validate: {
        validator: function (value) {
          return value >= new Date().setHours(0, 0, 0, 0);
        },
        message: "Proposed start date cannot be in the past",
      },
    },
    guestCount: {
      type: Number,
      min: [1, "Guest count must be at least 1"],
      default: 1,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "withdrawn"],
      default: "pending",
    },
    responseMessage: {
      type: String,
      trim: true,
      maxlength: [500, "Response message cannot exceed 500 characters"],
    },
    respondedAt: {
      type: Date,
    },
    viewedByLandlord: {
      type: Boolean,
      default: false,
    },
    viewedAt: {
      type: Date,
    },
    // ✅ THÊM fields để track confirmation process
    acceptedAt: {
      type: Date,
      default: null, // Khi landlord accept
    },
    agreementConfirmationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgreementConfirmation",
      default: null,
    },
    paymentCompletedAt: {
      type: Date,
      default: null, // Khi tenant hoàn thành payment
    },
    finalConfirmedAt: {
      type: Date,
      default: null, // Khi toàn bộ process hoàn thành
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Essential indexes only
rentalRequestSchema.index({ tenantId: 1 });
rentalRequestSchema.index({ roomId: 1 });
rentalRequestSchema.index({ landlordId: 1 });
rentalRequestSchema.index({ status: 1 });
rentalRequestSchema.index({ createdAt: 1 });

// Compound indexes for common queries
rentalRequestSchema.index({ landlordId: 1, status: 1 });
rentalRequestSchema.index({ roomId: 1, status: 1 });
rentalRequestSchema.index({ status: 1, createdAt: 1 });

// Essential virtuals only
rentalRequestSchema.virtual("tenant", {
  ref: "User",
  localField: "tenantId",
  foreignField: "_id",
  justOne: true,
});

rentalRequestSchema.virtual("room", {
  ref: "Room",
  localField: "roomId",
  foreignField: "_id",
  justOne: true,
});

rentalRequestSchema.virtual("accommodation", {
  ref: "Accommodation",
  localField: "accommodationId",
  foreignField: "_id",
  justOne: true,
});

rentalRequestSchema.virtual("landlord", {
  ref: "User",
  localField: "landlordId",
  foreignField: "_id",
  justOne: true,
});

// Pre-save middleware for basic validation
rentalRequestSchema.pre("save", async function (next) {
  if (this.isNew) {
    const Room = mongoose.model("Room");
    const room = await Room.findById(this.roomId);

    if (!room || !room.isAvailable) {
      const error = new Error("Room is not available for rental");
      error.name = "ValidationError";
      return next(error);
    }

    // Check if room capacity meets guest count
    if (this.guestCount > room.capacity) {
      const error = new Error("Guest count exceeds room capacity");
      error.name = "ValidationError";
      return next(error);
    }
  }
  next();
});

// Essential instance methods
rentalRequestSchema.methods.accept = function (responseMessage) {
  this.status = "accepted";
  this.responseMessage = responseMessage;
  this.respondedAt = new Date();
  return this.save();
};

rentalRequestSchema.methods.reject = function (responseMessage) {
  this.status = "rejected";
  this.responseMessage = responseMessage;
  this.respondedAt = new Date();
  return this.save();
};

rentalRequestSchema.methods.withdraw = function () {
  this.status = "withdrawn";
  return this.save();
};

rentalRequestSchema.methods.markAsViewed = function () {
  if (!this.viewedByLandlord) {
    this.viewedByLandlord = true;
    this.viewedAt = new Date();
    return this.save({ validateBeforeSave: false });
  }
  return Promise.resolve(this);
};

// Essential static methods
rentalRequestSchema.statics.findPending = function () {
  return this.find({ status: "pending" }).sort({ createdAt: 1 });
};

rentalRequestSchema.statics.findByLandlord = function (
  landlordId,
  status = null
) {
  const query = { landlordId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

rentalRequestSchema.statics.findByTenant = function (tenantId, status = null) {
  const query = { tenantId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

rentalRequestSchema.statics.findByRoom = function (roomId, status = null) {
  const query = { roomId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

module.exports = mongoose.model("RentalRequest", rentalRequestSchema);
