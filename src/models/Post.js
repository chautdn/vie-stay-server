const mongoose = require("mongoose");

// Simple featured listing pricing
const FEATURED_TYPES = {
  VIP_NOI_BAT: { dailyPrice: 50000, weeklyPrice: 315000, monthlyPrice: 1500000, priority: 1 },
  VIP_1: { dailyPrice: 30000, weeklyPrice: 190000, monthlyPrice: 1200000, priority: 2 },
  VIP_2: { dailyPrice: 20000, weeklyPrice: 133000, monthlyPrice: 900000, priority: 3 },
  VIP_3: { dailyPrice: 10000, weeklyPrice: 63000, monthlyPrice: 800000, priority: 4 },
  THUONG: { dailyPrice: 0, weeklyPrice: 0, monthlyPrice: 0, priority: 5 } // Free posts - never expire
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
      enum: ["single_room", "shared_room", "apartment", "house", "studio", "dormitory"],
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
          "pets_allowed"
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

    // Status - Updated with auto-approval logic
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending", // Default to pending, will be auto-approved for VIP posts
    },
    
    // Auto-approval tracking
    isAutoApproved: {
      type: Boolean,
      default: false, // Track if post was auto-approved
    },
    approvalDate: {
      type: Date,
      // Set when post is approved (manual or automatic)
    },
    approvalType: {
      type: String,
      enum: ["manual", "automatic"],
      // Track how the post was approved
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
postSchema.index({ isAutoApproved: 1 });
postSchema.index({ approvalDate: 1 });

// Check if featured listing is active (only VIP types can be featured)
postSchema.virtual("isFeatured").get(function() {
  return this.featuredType !== "THUONG" && 
         this.isPaid && 
         this.featuredEndDate && 
         this.featuredEndDate > new Date();
});

// Check if post is regular (free) type
postSchema.virtual("isRegular").get(function() {
  return this.featuredType === "THUONG";
});

// Check if post is VIP and should be auto-approved
postSchema.virtual("shouldAutoApprove").get(function() {
  return this.featuredType !== "THUONG" && this.isPaid;
});

// Pre-save middleware to handle auto-approval
postSchema.pre('save', function(next) {
  // If this is a new document or status is being modified
  if (this.isNew || this.isModified('status') || this.isModified('isPaid') || this.isModified('featuredType')) {
    
    // Auto-approve VIP posts that are paid
    if (this.featuredType !== "THUONG" && this.isPaid && this.status === 'pending') {
      this.status = 'approved';
      this.isAutoApproved = true;
      this.approvalDate = new Date();
      this.approvalType = 'automatic';
      
      console.log(`Auto-approving VIP post ${this._id} (${this.featuredType})`);
    }
    
    // Set approval date and type for manual approvals
    if (this.isModified('status') && this.status === 'approved' && !this.isAutoApproved) {
      this.approvalDate = new Date();
      this.approvalType = 'manual';
    }
  }
  
  next();
});

// Calculate featured cost
postSchema.methods.calculateCost = function(type, days) {
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

// Upgrade to featured - Updated with auto-approval
postSchema.methods.upgradeFeatured = async function(type, days) {
  const cost = this.calculateCost(type, days);
  
  this.featuredType = type;
  this.featuredCost = cost;
  
  if (type === "THUONG") {
    // Regular posts never expire
    this.featuredEndDate = null;
    this.isPaid = false;
    
    // If upgrading to regular from VIP, post needs manual approval again
    if (this.status === 'approved' && this.isAutoApproved) {
      this.status = 'pending';
      this.isAutoApproved = false;
      this.approvalDate = null;
      this.approvalType = null;
    }
  } else {
    // VIP posts expire after specified days and are auto-approved
    this.featuredEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    this.isPaid = true;
    
    // Auto-approve VIP posts
    if (this.status !== 'approved') {
      this.status = 'approved';
      this.isAutoApproved = true;
      this.approvalDate = new Date();
      this.approvalType = 'automatic';
    }
  }
  
  return this.save();
};

// Extend featured listing
postSchema.methods.extendFeatured = async function(additionalDays) {
  if (this.featuredType === "THUONG") {
    throw new Error("Cannot extend regular posts");
  }
  
  const cost = this.calculateCost(this.featuredType, additionalDays);
  
  // Extend from current end date or now (whichever is later)
  const extendFrom = this.featuredEndDate > new Date() ? this.featuredEndDate : new Date();
  this.featuredEndDate = new Date(extendFrom.getTime() + additionalDays * 24 * 60 * 60 * 1000);
  this.featuredCost += cost;
  
  return this.save();
};

// Auto-renew featured listing (called by cron job)
postSchema.methods.autoRenewFeatured = async function(userWalletBalance) {
  if (!this.autoRenew || this.featuredType === "THUONG") {
    return { success: false, reason: "Auto-renew not enabled or regular post" };
  }
  
  const cost = this.calculateCost(this.featuredType, this.autoRenewDuration);
  
  if (userWalletBalance < cost) {
    return { success: false, reason: "Insufficient wallet balance", requiredAmount: cost };
  }
  
  // Extend the post
  await this.extendFeatured(this.autoRenewDuration);
  
  return { success: true, cost: cost, extendedDays: this.autoRenewDuration };
};

// Manual approval method for admin use
postSchema.methods.manuallyApprove = async function() {
  this.status = 'approved';
  this.isAutoApproved = false;
  this.approvalDate = new Date();
  this.approvalType = 'manual';
  return this.save();
};

// Manual rejection method
postSchema.methods.reject = async function(reason) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.rejectionDate = new Date();
  return this.save();
};

// Get featured posts (only approved ones)
postSchema.statics.getFeatured = function() {
  return this.find({
    status: "approved",
    isAvailable: true,
    isPaid: true,
    featuredEndDate: { $gt: new Date() },
    featuredType: { $ne: "THUONG" }
  }).sort({ featuredType: 1, createdAt: -1 });
};

// Get all active posts (both regular and featured, only approved)
postSchema.statics.getAllActive = function() {
  return this.find({
    status: "approved",
    isAvailable: true
  }).sort({ 
    featuredType: 1,  // Featured posts first
    createdAt: -1     // Newest first
  });
};

// Get only regular (free) posts that are approved
postSchema.statics.getRegular = function() {
  return this.find({
    status: "approved",
    isAvailable: true,
    featuredType: "THUONG"
  }).sort({ createdAt: -1 });
};

// Get posts pending manual approval (free posts only)
postSchema.statics.getPendingApproval = function() {
  return this.find({
    status: "pending",
    featuredType: "THUONG", // Only free posts need manual approval
    isPaid: false
  }).sort({ createdAt: -1 });
};

// Get auto-approved posts for reporting
postSchema.statics.getAutoApproved = function(dateFrom, dateTo) {
  const query = {
    isAutoApproved: true,
    approvalType: 'automatic'
  };
  
  if (dateFrom || dateTo) {
    query.approvalDate = {};
    if (dateFrom) query.approvalDate.$gte = new Date(dateFrom);
    if (dateTo) query.approvalDate.$lte = new Date(dateTo);
  }
  
  return this.find(query).sort({ approvalDate: -1 });
};

// Update expired featured posts (reverts them back to regular posts)
postSchema.statics.updateExpired = async function() {
  const expiredPosts = await this.updateMany(
    {
      featuredType: { $ne: "THUONG" },
      isPaid: true,
      featuredEndDate: { $lte: new Date() }
    },
    {
      featuredType: "THUONG",
      isPaid: false,
      featuredEndDate: null,
      featuredCost: 0,
      // Expired VIP posts need manual re-approval as regular posts
      status: "pending",
      isAutoApproved: false,
      approvalDate: null,
      approvalType: null
    }
  );
  
  console.log(`Updated ${expiredPosts.modifiedCount} expired featured posts to pending approval`);
  return expiredPosts;
};

// Process auto-renewals for expiring posts
postSchema.statics.processAutoRenewals = async function() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const expiringPosts = await this.find({
    featuredType: { $ne: "THUONG" },
    isPaid: true,
    autoRenew: true,
    featuredEndDate: { $lte: tomorrow, $gt: new Date() }
  }).populate('userId', 'wallet.balance');
  
  const results = [];
  
  for (const post of expiringPosts) {
    const result = await post.autoRenewFeatured(post.userId.wallet.balance);
    results.push({
      postId: post._id,
      userId: post.userId._id,
      ...result
    });
  }
  
  return results;
};

// Statistics methods
postSchema.statics.getApprovalStats = async function(dateFrom, dateTo) {
  const matchQuery = {};
  
  if (dateFrom || dateTo) {
    matchQuery.approvalDate = {};
    if (dateFrom) matchQuery.approvalDate.$gte = new Date(dateFrom);
    if (dateTo) matchQuery.approvalDate.$lte = new Date(dateTo);
  }
  
  return this.aggregate([
    {
      $match: {
        status: 'approved',
        ...matchQuery
      }
    },
    {
      $group: {
        _id: '$approvalType',
        count: { $sum: 1 },
        totalRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$approvalType', 'automatic'] },
              '$featuredCost',
              0
            ]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model("Post", postSchema);
