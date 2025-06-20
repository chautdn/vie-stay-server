const mongoose = require("mongoose");

// Function to normalize Vietnamese text for search
function normalizeVietnamese(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .trim();
}

const accommodationSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
    },
    name: {
      type: String,
      required: [true, "Accommodation name is required"],
      trim: true,
      maxlength: [200, "Accommodation name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    type: {
      type: String,
      required: [true, "Accommodation type is required"],
      enum: {
        values: [
          "duplex",
          "house",
          "apartment_building",
          "hotel",
          "motel",
          "hostel",
          "guesthouse",
          "resort",
          "villa",
          "homestay",
        ],
        message: "Please select a valid accommodation type",
      },
    },
    images: [
      {
        type: String,
      },
    ],
    documents: [
      {
        type: {
          type: String,
          required: [true, "Document type is required"],
          enum: {
            values: [
              "business_license",
              "property_deed",
              "tax_certificate",
              "fire_safety",
              "other",
            ],
            message: "Please select a valid document type",
          },
        },
        // enum: {
        //   values: ['pending', 'approved', 'rejected'],
        //   default: ['pending'],
        //   message: 'Approval status must be pending, approved, or rejected'
        // },
        url: {
          type: String,
          required: [true, "Document URL is required"],
          match: [/^https?:\/\/.+$/, "Please provide a valid document URL"],
        },
        fileName: {
          type: String,
          required: [true, "File name is required"],
          trim: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // updateStatus: [{
    //   enum: {
    //     values: ['pending', 'approved', 'rejected'],
    //     default: ['pending'],
    //     message: 'Approval status must be pending, approved, or rejected'
    //   }
    // }],
    amenities: [
      {
        type: String,
        enum: {
          values: [
            "wifi",
            "parking",
            "pool",
            "gym",
            "laundry",
            "elevator",
            "security",
            "air_conditioning",
            "heating",
            "kitchen",
            "restaurant",
            "bar",
            "garden",
            "terrace",
            "balcony",
            "sea_view",
            "mountain_view",
            "pets_allowed",
            "smoking_allowed",
            "wheelchair_accessible",
          ],
          message: "Please select valid amenities",
        },
      },
    ],
    policies: {
      checkInTime: {
        type: String,
        match: [
          /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
          "Please provide time in HH:MM format",
        ],
      },
      checkOutTime: {
        type: String,
        match: [
          /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
          "Please provide time in HH:MM format",
        ],
      },
      smokingAllowed: {
        type: Boolean,
        default: false,
      },
      petsAllowed: {
        type: Boolean,
        default: false,
      },
      partiesAllowed: {
        type: Boolean,
        default: false,
      },
      quietHours: {
        start: {
          type: String,
          match: [
            /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
            "Please provide time in HH:MM format",
          ],
        },
        end: {
          type: String,
          match: [
            /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
            "Please provide time in HH:MM format",
          ],
        },
      },
      additionalRules: [String],
    },
    contactInfo: {
      phone: {
        type: String,
        required: [true, "Contact phone is required"],
        match: [
          /^(\+84|0)[0-9]{9,10}$/,
          "Please provide a valid Vietnamese phone number",
        ],
      },
      email: {
        type: String,
        match: [
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
          "Please provide a valid email",
        ],
      },
      website: {
        type: String,
        trim: true,
      },
    },
    address: {
      street: {
        type: String,
        required: [true, "Street address is required"],
        trim: true,
        maxlength: [200, "Street address cannot exceed 200 characters"],
      },
      ward: {
        type: String,
        required: [true, "Ward is required"],
        trim: true,
        maxlength: [100, "Ward cannot exceed 100 characters"],
      },
      district: {
        type: String,
        required: [true, "District is required"],
        enum: {
          values: [
            "Quận Hải Châu",
            "Quận Thanh Khê",
            "Quận Sơn Trà",
            "Quận Ngũ Hành Sơn",
            "Quận Liên Chiểu",
            "Quận Cẩm Lệ",
            "Huyện Hòa Vang",
            "Huyện Hoàng Sa",
          ],
          message: "Please select a valid Da Nang district",
        },
      },
      city: {
        type: String,
        required: [true, "City is required"],
        default: "Đà Nẵng",
        enum: {
          values: ["Đà Nẵng"],
          message: "City must be Da Nang",
        },
      },
      fullAddress: {
        type: String,
        required: [true, "Full address is required"],
        trim: true,
      },
      fullAddressNormalized: {
        type: String,
        trim: true,
      },
      // coordinates: {
      //   lat: {
      //     type: Number,
      //     required: [true, 'Latitude is required'],
      //     min: [15.8, 'Latitude must be within Da Nang bounds'],
      //     max: [16.2, 'Latitude must be within Da Nang bounds']
      //   },
      //   lng: {
      //     type: Number,
      //     required: [true, 'Longitude is required'],
      //     min: [107.9, 'Longitude must be within Da Nang bounds'],
      //     max: [108.4, 'Longitude must be within Da Nang bounds']
      //   }
      // },
      searchKeywords: [String],
    },
    approvalStatus: {
      type: String,
      required: [true, "Approval status is required"],
      enum: {
        values: ["pending", "approved", "rejected"],
        message: "Approval status must be pending, approved, or rejected",
      },
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
    },
    totalRooms: {
      type: Number,
      min: [0, "Total rooms cannot be negative"],
      default: 0,
    },
    availableRooms: {
      type: Number,
      min: [0, "Available rooms cannot be negative"],
      default: 0,
    },
    averageRating: {
      type: Number,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
      default: 0,
    },
    totalReviews: {
      type: Number,
      min: [0, "Total reviews cannot be negative"],
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    featuredUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
accommodationSchema.index({ ownerId: 1 });
accommodationSchema.index({ type: 1 });
accommodationSchema.index({ approvalStatus: 1 });
accommodationSchema.index({ "address.district": 1 });
accommodationSchema.index({ "address.ward": 1 });
accommodationSchema.index({ "address.coordinates": "2dsphere" });
accommodationSchema.index({ isActive: 1 });
accommodationSchema.index({ isFeatured: 1 });
accommodationSchema.index({ featuredUntil: 1 });
accommodationSchema.index({ averageRating: 1 });

// Text search index
accommodationSchema.index({
  name: "text",
  description: "text",
  "address.fullAddress": "text",
  "address.fullAddressNormalized": "text",
  "address.searchKeywords": "text",
});

// Virtual for rooms
accommodationSchema.virtual("rooms", {
  ref: "Room",
  localField: "_id",
  foreignField: "accommodationId",
});

// Virtual for ratings
accommodationSchema.virtual("ratings", {
  ref: "Rating",
  localField: "_id",
  foreignField: "accommodationId",
});

// Pre-save middleware to normalize address for search
accommodationSchema.pre("save", function (next) {
  if (this.isModified("address.fullAddress")) {
    this.address.fullAddressNormalized = normalizeVietnamese(
      this.address.fullAddress
    );
  }

  // Generate search keywords
  if (this.isModified("address") || this.isModified("name")) {
    this.address.searchKeywords = [
      normalizeVietnamese(this.name),
      normalizeVietnamese(this.address.street),
      normalizeVietnamese(this.address.ward),
      normalizeVietnamese(this.address.district),
    ].filter(Boolean);
  }

  next();
});

// Instance method to check if featured listing is still valid
accommodationSchema.methods.isFeaturedActive = function () {
  return (
    this.isFeatured && this.featuredUntil && this.featuredUntil > new Date()
  );
};

// Instance method to approve accommodation
accommodationSchema.methods.approve = function (adminId) {
  this.approvalStatus = "approved";
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.rejectionReason = undefined;
  return this.save();
};

// Instance method to reject accommodation
accommodationSchema.methods.reject = function (adminId, reason) {
  this.approvalStatus = "rejected";
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Static method to find accommodations by location
accommodationSchema.statics.findNearby = function (
  lat,
  lng,
  maxDistance = 2000
) {
  return this.find({
    "address.coordinates": {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: maxDistance,
      },
    },
    approvalStatus: "approved",
    isActive: true,
  });
};

// Static method to search accommodations
accommodationSchema.statics.search = function (query) {
  const searchQuery = {
    approvalStatus: "approved",
    isActive: true,
  };

  if (query.text) {
    searchQuery.$text = { $search: normalizeVietnamese(query.text) };
  }

  if (query.district) {
    searchQuery["address.district"] = query.district;
  }

  if (query.type) {
    searchQuery.type = query.type;
  }

  if (query.amenities && query.amenities.length > 0) {
    searchQuery.amenities = { $in: query.amenities };
  }

  return this.find(searchQuery);
};

module.exports = mongoose.model("Accommodation", accommodationSchema);
