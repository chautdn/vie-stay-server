const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    accommodationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accommodation",
      required: [true, "Accommodation ID is required"],
    },
    roomNumber: {
      type: String,
      required: [true, "Room number is required"],
      trim: true,
      maxlength: [20, "Room number cannot exceed 20 characters"],
    },
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
      maxlength: [100, "Room name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    type: {
      type: String,
      required: [true, "Room type is required"],
      enum: {
        values: [
          "single",
          "double",
          "twin",
          "triple",
          "family",
          "suite",
          "deluxe",
          "standard",
          "dormitory",
          "private",
          "studio",
        ],
        message: "Please select a valid room type",
      },
    },
    size: {
      type: Number,
    },
    capacity: {
      type: Number,
      required: [true, "Room capacity is required"],
    },
    hasPrivateBathroom: {
      type: Boolean,
      default: false,
    },
    furnishingLevel: {
      type: String,
      enum: {
        values: ["unfurnished", "semi", "fully"],
        message: "Furnishing level must be unfurnished, semi, or fully",
      },
      default: "unfurnished",
    },
    images: [
      {
        type: String,
      },
    ],
    amenities: [
      {
        type: String,
        enum: {
          values: [
            "air_conditioning",
            "heating",
            "wifi",
            "tv",
            "refrigerator",
            "microwave",
            "coffee_maker",
            "desk",
            "chair",
            "wardrobe",
            "safe",
            "balcony",
            "window",
            "blackout_curtains",
            "iron",
            "hairdryer",
            "towels",
            "bed_linens",
            "pillow",
            "blanket",
            "hangers",
            "mirror",
            "power_outlets",
            "usb_ports",
            "reading_light",
          ],
          message: "Please select valid room amenities",
        },
      },
    ],
    baseRent: {
      type: Number,
      required: [true, "Base rent is required"],
      min: [0, "Base rent cannot be negative"],
    },
    deposit: {
      type: Number,
      min: [0, "Deposit cannot be negative"],
      default: 0,
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
    isAvailable: {
      type: Boolean,
      default: true,
    },
    availableFrom: {
      type: Date,
      default: Date.now,
    },
    currentTenant: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    averageRating: {
      type: Number,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
      default: 0,
    },
    totalRatings: {
      type: Number,
      min: [0, "Total ratings cannot be negative"],
      default: 0,
    },
    lastRatingUpdate: {
      type: Date,
    },
    viewCount: {
      type: Number,
      min: [0, "View count cannot be negative"],
      default: 0,
    },
    favoriteCount: {
      type: Number,
      min: [0, "Favorite count cannot be negative"],
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
roomSchema.index({ accommodationId: 1 });
roomSchema.index({ type: 1 });
roomSchema.index({ capacity: 1 });
roomSchema.index({ baseRent: 1 });
roomSchema.index({ hasPrivateBathroom: 1 });
roomSchema.index({ furnishingLevel: 1 });
roomSchema.index({ isAvailable: 1 });
roomSchema.index({ availableFrom: 1 });
roomSchema.index({ currentTenant: 1 });
roomSchema.index({ averageRating: 1 });

// Compound indexes
roomSchema.index({ accommodationId: 1, isAvailable: 1 });
roomSchema.index({ baseRent: 1, isAvailable: 1 });
roomSchema.index({ type: 1, baseRent: 1 });

// Unique constraint for room number within accommodation
roomSchema.index({ accommodationId: 1, roomNumber: 1 }, { unique: true });


module.exports = mongoose.model("Room", roomSchema);
