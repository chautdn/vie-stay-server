const mongoose = require("mongoose");

// Simple featured listing pricing
const FEATURED_TYPES = {
  VIP_NOI_BAT: {
    dailyPrice: 50000,
    weeklyPrice: 315000,
    monthlyPrice: 1500000,
    priority: 1,
  },
  VIP_1: {
    dailyPrice: 30000,
    weeklyPrice: 190000,
    monthlyPrice: 1200000,
    priority: 2,
  },
  VIP_2: {
    dailyPrice: 20000,
    weeklyPrice: 133000,
    monthlyPrice: 900000,
    priority: 3,
  },
  VIP_3: {
    dailyPrice: 10000,
    weeklyPrice: 63000,
    monthlyPrice: 800000,
    priority: 4,
  },
  THUONG: { dailyPrice: 0, weeklyPrice: 0, monthlyPrice: 0, priority: 5 }, // Free posts - never expire
};

const postSchema = new mongoose.Schema(
  {
    // User who created the post
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Optional references to existing models
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
    accommodationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accommodation",
    },

    // Basic post information
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Property details
    propertyType: {
      type: String,
      required: true,
      enum: [
        "single_room",
        "double_room",
        "shared_room",
        "apartment",
        "house",
        "studio",
        "dormitory",
      ],
    },
    area: {
      type: Number,
      min: 1,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    hasPrivateBathroom: {
      type: Boolean,
      default: false,
    },
    furnishingLevel: {
      type: String,
      enum: ["unfurnished", "semi_furnished", "fully_furnished"],
      default: "unfurnished",
    },

    // Pricing
    rent: {
      type: Number,
      required: true,
      min: 0,
    },
    deposit: {
      type: Number,
      min: 0,
      default: 0,
    },
    electricityCost: {
      type: Number,
      min: 0,
    },
    waterCost: {
      type: Number,
      min: 0,
    },
    internetCost: {
      type: Number,
      min: 0,
    },

    // Location
    address: {
      street: {
        type: String,
        required: true,
        trim: true,
      },
      ward: {
        type: String,
        required: true,
        trim: true,
      },
      district: {
        type: String,
        required: true,
        enum: [
          "Quận Hải Châu",
          "Quận Thanh Khê",
          "Quận Sơn Trà",
          "Quận Ngũ Hành Sơn",
          "Quận Liên Chiểu",
          "Quận Cẩm Lệ",
          "Huyện Hòa Vang",
        ],
      },
    },

    // Amenities
    amenities: [
      {
        type: String,
        enum: [
          "wifi",
          "air_conditioning",
          "parking",
          "elevator",
          "security",
          "laundry",
          "kitchen_access",
          "balcony",
          "gym",
          "pool",
          "garden",
          "pets_allowed",
        ],
      },
    ],

    // Contact
    contactName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      required: true,
      match: /^(\+84|0)[0-9]{9,10}$/,
    },
    contactEmail: {
      type: String,
      match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    },

    // Images
    images: [String],

    // Featured listing
    featuredType: {
      type: String,
      enum: Object.keys(FEATURED_TYPES),
      default: "THUONG",
    },
    featuredEndDate: {
      type: Date,
      // Only set for paid VIP posts, null for regular THUONG posts
    },
    featuredCost: {
      type: Number,
      default: 0,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    autoRenewDuration: {
      type: Number,
      default: 7, // Default 7 days when auto-renewing
    },

    // Status
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "approved",
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },

    // Metrics
    viewCount: {
      type: Number,
      default: 0,
    },
    contactCount: {
      type: Number,
      default: 0,
    },
    favoriteCount: {
      type: Number,
      default: 0,
    },

    // Additional settings
    allowNegotiation: {
      type: Boolean,
      default: true,
    },
    preferredTenantGender: {
      type: String,
      enum: ["male", "female", "any"],
      default: "any",
    },
    availableFrom: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
postSchema.index({ userId: 1 });
postSchema.index({ roomId: 1 });
postSchema.index({ accommodationId: 1 });
postSchema.index({ status: 1 });
postSchema.index({ "address.district": 1 });
postSchema.index({ featuredType: 1 });
postSchema.index({ featuredEndDate: 1 });

// Check if featured listing is active (only VIP types can be featured)
postSchema.virtual("isFeatured").get(function () {
  return (
    this.featuredType !== "THUONG" &&
    this.isPaid &&
    this.featuredEndDate &&
    this.featuredEndDate > new Date()
  );
});

// Check if post is regular (free) type
postSchema.virtual("isRegular").get(function () {
  return this.featuredType === "THUONG";
});

// Calculate featured cost
postSchema.methods.calculateCost = function (type, days) {
  const pricing = FEATURED_TYPES[type];
  if (!pricing) throw new Error("Invalid featured type");

  // THUONG posts are always free
  if (type === "THUONG") return 0;

  if (days >= 30) {
    return Math.ceil(days / 30) * pricing.monthlyPrice;
  } else if (days >= 7) {
    return Math.ceil(days / 7) * pricing.weeklyPrice;
  } else {
    return days * pricing.dailyPrice;
  }
};

// Upgrade to featured
postSchema.methods.upgradeFeatured = async function (type, days) {
  const cost = this.calculateCost(type, days);

  this.featuredType = type;
  this.featuredCost = cost;

  if (type === "THUONG") {
    // Regular posts never expire
    this.featuredEndDate = null;
    this.isPaid = false;
  } else {
    // VIP posts expire after specified days
    this.featuredEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    this.isPaid = true;
  }

  return this.save();
};

// Extend featured listing
postSchema.methods.extendFeatured = async function (additionalDays) {
  if (this.featuredType === "THUONG") {
    throw new Error("Cannot extend regular posts");
  }

  const cost = this.calculateCost(this.featuredType, additionalDays);

  // Extend from current end date or now (whichever is later)
  const extendFrom =
    this.featuredEndDate > new Date() ? this.featuredEndDate : new Date();
  this.featuredEndDate = new Date(
    extendFrom.getTime() + additionalDays * 24 * 60 * 60 * 1000
  );
  this.featuredCost += cost;

  return this.save();
};

// Auto-renew featured listing (called by cron job)
postSchema.methods.autoRenewFeatured = async function (userWalletBalance) {
  if (!this.autoRenew || this.featuredType === "THUONG") {
    return { success: false, reason: "Auto-renew not enabled or regular post" };
  }

  const cost = this.calculateCost(this.featuredType, this.autoRenewDuration);

  if (userWalletBalance < cost) {
    return {
      success: false,
      reason: "Insufficient wallet balance",
      requiredAmount: cost,
    };
  }

  // Extend the post
  await this.extendFeatured(this.autoRenewDuration);

  return { success: true, cost: cost, extendedDays: this.autoRenewDuration };
};

// Get featured posts
postSchema.statics.getFeatured = function () {
  return this.find({
    status: "approved",
    isAvailable: true,
    isPaid: true,
    featuredEndDate: { $gt: new Date() },
    featuredType: { $ne: "THUONG" },
  }).sort({ featuredType: 1, createdAt: -1 });
};

// Get all active posts (both regular and featured)
postSchema.statics.getAllActive = function () {
  return this.find({
    status: "approved",
    isAvailable: true,
  }).sort({
    featuredType: 1, // Featured posts first
    createdAt: -1, // Newest first
  });
};

// Get only regular (free) posts
postSchema.statics.getRegular = function () {
  return this.find({
    status: "approved",
    isAvailable: true,
    featuredType: "THUONG",
  }).sort({ createdAt: -1 });
};

// Update expired featured posts (reverts them back to regular posts)
postSchema.statics.updateExpired = async function () {
  return this.updateMany(
    {
      featuredType: { $ne: "THUONG" },
      isPaid: true,
      featuredEndDate: { $lte: new Date() },
    },
    {
      featuredType: "THUONG",
      isPaid: false,
      featuredEndDate: null,
      featuredCost: 0,
    }
  );
};

// Process auto-renewals for expiring posts
postSchema.statics.processAutoRenewals = async function () {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const expiringPosts = await this.find({
    featuredType: { $ne: "THUONG" },
    isPaid: true,
    autoRenew: true,
    featuredEndDate: { $lte: tomorrow, $gt: new Date() },
  }).populate("userId", "wallet.balance");

  const results = [];

  for (const post of expiringPosts) {
    const result = await post.autoRenewFeatured(post.userId.wallet.balance);
    results.push({
      postId: post._id,
      userId: post.userId._id,
      ...result,
    });
  }

  return results;
};

module.exports = mongoose.model("Post", postSchema);
