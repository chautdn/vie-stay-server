const mongoose = require("mongoose");

const coTenantRequestSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Room ID is required"],
    },
    primaryTenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Primary tenant ID is required"],
    },
    coTenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [
        /^(\+84|0)[0-9]{9,10}$/,
        "Please provide a valid Vietnamese phone number",
      ],
    },
    imageCCCD: {
      type: String,
      required: [true, "CCCD image is required"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CoTenantRequest", coTenantRequestSchema);
