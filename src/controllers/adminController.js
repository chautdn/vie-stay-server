const User = require("../models/User");
const Accommodation = require("../models/Accommodation");
const Room = require("../models/Room");
const Post = require("../models/Post");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// Utility function to normalize Vietnamese text for search
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

// ========================== POST MANAGEMENT ==========================

// Get all posts with filtering and pagination - Enhanced with auto-approval stats
exports.getPosts = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    status,
    featuredType,
    search,
    sortBy = "createdAt",
    order = "desc",
    approvalType, // NEW: Filter by approval type (manual/automatic)
  } = req.query;

  const query = {};

  // Filter by status
  if (status && status !== "all") {
    query.status = status;
  }

  // NEW: Filter by approval type
  if (approvalType && approvalType !== "all") {
    if (approvalType === "auto_approved") {
      query.isAutoApproved = true;
      query.status = "approved";
    } else if (approvalType === "manual_approved") {
      query.isAutoApproved = { $ne: true };
      query.status = "approved";
    }
  }

  // Filter by featured type
  if (featuredType && featuredType !== "all") {
    if (featuredType === "featured") {
      query.featuredType = { $ne: "THUONG" };
      query.isPaid = true;
    } else if (featuredType === "regular") {
      query.featuredType = "THUONG";
    }
  }

  // Search functionality
  if (search) {
    const normalizedSearch = normalizeVietnamese(search);
    query.$or = [
      { title: { $regex: normalizedSearch, $options: "i" } },
      { description: { $regex: normalizedSearch, $options: "i" } },
      { contactName: { $regex: normalizedSearch, $options: "i" } },
      { contactPhone: { $regex: search, $options: "i" } },
      { "address.district": { $regex: normalizedSearch, $options: "i" } },
      { "address.ward": { $regex: normalizedSearch, $options: "i" } },
      { "address.street": { $regex: normalizedSearch, $options: "i" } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOrder = order === "desc" ? -1 : 1;

  // Get posts with populated data
  const posts = await Post.find(query)
    .populate("userId", "name email profileImage")
    .populate("roomId", "name roomNumber")
    .populate("accommodationId", "name")
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await Post.countDocuments(query);

  // Enhanced statistics with auto-approval tracking
  const stats = await Post.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
        },
        approved: {
          $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
        },
        autoApproved: {
          $sum: { 
            $cond: [
              { 
                $and: [
                  { $eq: ["$status", "approved"] },
                  { $eq: ["$isAutoApproved", true] }
                ]
              }, 
              1, 
              0
            ] 
          }
        },
        manualApproved: {
          $sum: { 
            $cond: [
              { 
                $and: [
                  { $eq: ["$status", "approved"] },
                  { $ne: ["$isAutoApproved", true] }
                ]
              }, 
              1, 
              0
            ] 
          }
        },
        active: {
          $sum: { 
            $cond: [
              { 
                $and: [
                  { $eq: ["$status", "approved"] },
                  { $eq: ["$isAvailable", true] },
                  { $ne: ["$adminDeactivated", true] }
                ]
              }, 
              1, 
              0
            ] 
          }
        },
        featured: {
          $sum: { 
            $cond: [
              { 
                $and: [
                  { $ne: ["$featuredType", "THUONG"] },
                  { $eq: ["$isPaid", true] }
                ]
              }, 
              1, 
              0
            ] 
          }
        },
        totalRevenue: {
          $sum: { 
            $cond: [
              { $eq: ["$isPaid", true] }, 
              "$featuredCost", 
              0
            ] 
          }
        },
        autoApprovedRevenue: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ["$isAutoApproved", true] },
                  { $eq: ["$isPaid", true] }
                ]
              },
              "$featuredCost",
              0
            ]
          }
        }
      }
    }
  ]);

  const statistics = stats[0] || {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    autoApproved: 0,
    manualApproved: 0,
    active: 0,
    featured: 0,
    totalRevenue: 0,
    autoApprovedRevenue: 0
  };

  res.status(200).json({
    status: "success",
    data: {
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + posts.length < total,
        hasPrev: parseInt(page) > 1,
      },
      statistics,
    },
  });
});

// Get detailed information about a specific post - Enhanced with auto-approval info
exports.getPostDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const post = await Post.findById(id)
    .populate("userId", "name email phoneNumber profileImage role")
    .populate("roomId", "name roomNumber capacity baseRent")
    .populate("accommodationId", "name type address contactInfo");

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  // Get related posts from the same user with auto-approval info
  const relatedPosts = await Post.find({
    userId: post.userId._id,
    _id: { $ne: post._id }
  })
  .select("title status createdAt rent featuredType isAutoApproved approvalType")
  .limit(5);

  // Enhanced approval information
  const approvalInfo = {
    isAutoApproved: post.isAutoApproved || false,
    approvalType: post.approvalType || null,
    approvalDate: post.approvalDate || null,
    featuredType: post.featuredType,
    isPaid: post.isPaid,
    featuredCost: post.featuredCost || 0,
    autoRenew: post.autoRenew || false,
    featuredEndDate: post.featuredEndDate || null
  };

  res.status(200).json({
    status: "success",
    data: {
      post: {
        ...post.toObject(),
        approvalInfo,
        relatedPosts
      }
    },
  });
});

// Approve a post - Updated to handle manual approval with auto-approval awareness
exports.approvePost = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const adminId = req.user._id;

  const post = await Post.findById(id);
  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  if (post.status === "approved") {
    return next(new AppError("Post is already approved", 400));
  }

  // Check if this post has manuallyApprove method (new model)
  if (typeof post.manuallyApprove === 'function') {
    // Use new model method
    await post.manuallyApprove();
  } else {
    // Fallback to direct field updates for existing model
    post.status = "approved";
    post.approvedBy = adminId;
    post.approvedAt = new Date();
    post.rejectionReason = undefined;
    // Mark as manually approved
    post.isAutoApproved = false;
    post.approvalType = 'manual';
    post.approvalDate = new Date();
    await post.save();
  }

  // Log the action
  console.log(
    `Admin ${req.user.name} manually approved post ${post.title} (${post._id})`
  );

  res.status(200).json({
    status: "success",
    message: "Post approved successfully",
    data: { 
      post,
      approvalInfo: {
        isAutoApproved: false,
        approvalType: 'manual',
        approvedBy: adminId,
        approvedAt: new Date()
      }
    },
  });
});

// Reject a post - Enhanced with auto-approval awareness
exports.rejectPost = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  if (!reason || reason.trim().length === 0) {
    return next(new AppError("Rejection reason is required", 400));
  }

  const post = await Post.findById(id);
  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  // Check if this post has reject method (new model)
  if (typeof post.reject === 'function') {
    // Use new model method
    await post.reject(reason.trim());
  } else {
    // Fallback to direct field updates for existing model
    post.status = "rejected";
    post.rejectionReason = reason.trim();
    post.approvedBy = adminId;
    post.approvedAt = new Date();
    await post.save();
  }

  // Log the action with auto-approval context
  const approvalContext = post.isAutoApproved ? " (was auto-approved)" : " (manual approval)";
  console.log(
    `Admin ${req.user.name} rejected post ${post.title} (${post._id})${approvalContext}: ${reason}`
  );

  res.status(200).json({
    status: "success",
    message: "Post rejected successfully",
    data: { 
      post,
      rejectionInfo: {
        rejectedBy: adminId,
        rejectedAt: new Date(),
        reason: reason.trim(),
        wasAutoApproved: post.isAutoApproved || false
      }
    },
  });
});

// Deactivate a post (admin action) - Enhanced
exports.deactivatePost = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  const post = await Post.findById(id);
  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  // Update post
  post.isAvailable = false;
  post.adminDeactivated = true;
  post.adminDeactivatedBy = adminId;
  post.adminDeactivatedAt = new Date();
  post.adminDeactivationReason = reason || "Admin deactivation";

  await post.save();

  // Log the action with approval context
  const approvalContext = post.isAutoApproved ? " (auto-approved)" : " (manually approved)";
  console.log(
    `Admin ${req.user.name} deactivated post ${post.title} (${post._id})${approvalContext}: ${reason || "Admin deactivation"}`
  );

  res.status(200).json({
    status: "success",
    message: "Post deactivated successfully",
    data: { post },
  });
});

// Activate a post (remove admin deactivation) - Enhanced
exports.activatePost = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const adminId = req.user._id;

  const post = await Post.findById(id);
  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  // Update post
  post.isAvailable = true;
  post.adminDeactivated = false;
  post.adminDeactivatedBy = undefined;
  post.adminDeactivatedAt = undefined;
  post.adminDeactivationReason = undefined;
  post.adminReactivatedBy = adminId;
  post.adminReactivatedAt = new Date();

  await post.save();

  // Log the action
  console.log(
    `Admin ${req.user.name} reactivated post ${post.title} (${post._id})`
  );

  res.status(200).json({
    status: "success",
    message: "Post activated successfully",
    data: { post },
  });
});

// NEW: Get auto-approval statistics
exports.getAutoApprovalStats = catchAsync(async (req, res, next) => {
  const { dateFrom, dateTo } = req.query;

  // Build date filter
  let dateFilter = {};
  if (dateFrom || dateTo) {
    dateFilter.createdAt = {};
    if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
  }

  // Get approval statistics
  const approvalStats = await Post.aggregate([
    {
      $match: {
        ...dateFilter,
        status: 'approved'
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

  // Featured type breakdown for auto-approved posts
  const featuredTypeStats = await Post.aggregate([
    {
      $match: {
        ...dateFilter,
        isAutoApproved: true,
        featuredType: { $ne: 'THUONG' }
      }
    },
    {
      $group: {
        _id: '$featuredType',
        count: { $sum: 1 },
        revenue: { $sum: '$featuredCost' }
      }
    },
    {
      $sort: { revenue: -1 }
    }
  ]);

  res.status(200).json({
    status: "success",
    data: {
      approvalStats,
      featuredTypeStats,
      dateRange: {
        startDate: dateFrom,
        endDate: dateTo
      }
    }
  });
});

// ========================== ACCOMMODATION MANAGEMENT ==========================
// Keep all your existing accommodation management code exactly as is

exports.getAccommodations = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    status,
    type,
    district,
    search,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  const query = {};

  // Filter by approval status
  if (status && status !== "all") {
    query.approvalStatus = status;
  }

  // Filter by accommodation type
  if (type && type !== "all") {
    query.type = type;
  }

  // Filter by district
  if (district && district !== "all") {
    query["address.district"] = district;
  }

  // Search functionality
  if (search) {
    const normalizedSearch = normalizeVietnamese(search);
    query.$or = [
      { name: { $regex: normalizedSearch, $options: "i" } },
      { description: { $regex: normalizedSearch, $options: "i" } },
      { "address.fullAddress": { $regex: normalizedSearch, $options: "i" } },
      {
        "address.fullAddressNormalized": {
          $regex: normalizedSearch,
          $options: "i",
        },
      },
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOrder = order === "desc" ? -1 : 1;

  // Get accommodations with owner info
  const accommodations = await Accommodation.find(query)
    .populate("ownerId", "name email phoneNumber isActive")
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await Accommodation.countDocuments(query);

  // Get statistics
  const stats = await Accommodation.aggregate([
    {
      $group: {
        _id: "$approvalStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  const statistics = {
    total,
    pending: stats.find((s) => s._id === "pending")?.count || 0,
    approved: stats.find((s) => s._id === "approved")?.count || 0,
    rejected: stats.find((s) => s._id === "rejected")?.count || 0,
  };

  res.status(200).json({
    status: "success",
    data: {
      accommodations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + accommodations.length < total,
        hasPrev: parseInt(page) > 1,
      },
      statistics,
    },
  });
});

// Get single accommodation details
exports.getAccommodationDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const accommodation = await Accommodation.findById(id)
    .populate(
      "ownerId",
      "name email phoneNumber dateOfBirth address nationalId isActive"
    )
    .populate("rooms");

  if (!accommodation) {
    return next(new AppError("Accommodation not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: { accommodation },
  });
});

// Approve accommodation
exports.approveAccommodation = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { notes } = req.body;

  const accommodation = await Accommodation.findById(id);
  if (!accommodation) {
    return next(new AppError("Accommodation not found", 404));
  }

  if (accommodation.approvalStatus === "approved") {
    return next(new AppError("Accommodation is already approved", 400));
  }

  await accommodation.approve(req.user._id);

  // Log the action
  console.log(
    `Admin ${req.user.name} approved accommodation ${accommodation.name}`
  );

  res.status(200).json({
    status: "success",
    message: "Accommodation approved successfully",
    data: { accommodation },
  });
});

// Reject accommodation
exports.rejectAccommodation = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim() === "") {
    return next(new AppError("Rejection reason is required", 400));
  }

  const accommodation = await Accommodation.findById(id);
  if (!accommodation) {
    return next(new AppError("Accommodation not found", 404));
  }

  if (accommodation.approvalStatus === "rejected") {
    return next(new AppError("Accommodation is already rejected", 400));
  }

  await accommodation.reject(req.user._id, reason);

  // Log the action
  console.log(
    `Admin ${req.user.name} rejected accommodation ${accommodation.name}: ${reason}`
  );

  res.status(200).json({
    status: "success",
    message: "Accommodation rejected successfully",
    data: { accommodation },
  });
});

// ========================== USER MANAGEMENT ==========================
// Keep all your existing user management code exactly as is

exports.getUsers = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    role,
    status,
    search,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  const query = {};

  // Filter by role
  if (role && role !== "all") {
    query.role = { $in: [role] };
  }

  // Filter by status
  if (status === "active") {
    query.isActive = true;
  } else if (status === "banned") {
    query.isActive = false;
  }

  // Search functionality
  if (search) {
    const normalizedSearch = normalizeVietnamese(search);
    query.$or = [
      { name: { $regex: normalizedSearch, $options: "i" } },
      { email: { $regex: normalizedSearch, $options: "i" } },
      { phoneNumber: { $regex: search, $options: "i" } },
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOrder = order === "desc" ? -1 : 1;

  // Get users
  const users = await User.find(query)
    .select("-password -verificationToken -resetPasswordToken")
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await User.countDocuments(query);

  // Get user statistics
  const stats = await User.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
        },
        bannedUsers: {
          $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] },
        },
        verifiedUsers: {
          $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] },
        },
        tenants: {
          $sum: { $cond: [{ $in: ["tenant", "$role"] }, 1, 0] },
        },
        landlords: {
          $sum: { $cond: [{ $in: ["landlord", "$role"] }, 1, 0] },
        },
      },
    },
  ]);

  const statistics = stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    bannedUsers: 0,
    verifiedUsers: 0,
    tenants: 0,
    landlords: 0,
  };

  res.status(200).json({
    status: "success",
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + users.length < total,
        hasPrev: parseInt(page) > 1,
      },
      statistics,
    },
  });
});

// Get single user details
exports.getUserDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id).select(
    "-password -verificationToken -resetPasswordToken"
  );

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Get user's accommodations if they are a landlord
  let accommodations = [];
  if (user.role.includes("landlord")) {
    accommodations = await Accommodation.find({ ownerId: user._id })
      .select("name type approvalStatus totalRooms averageRating")
      .limit(5);
  }

  // Get user's posts with approval info
  const posts = await Post.find({ userId: user._id })
    .select("title status featuredType isAutoApproved approvalType createdAt rent")
    .sort({ createdAt: -1 })
    .limit(5);

  res.status(200).json({
    status: "success",
    data: {
      user,
      accommodations,
      posts,
    },
  });
});

// Ban user
exports.banUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim() === "") {
    return next(new AppError("Ban reason is required", 400));
  }

  const user = await User.findById(id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (!user.isActive) {
    return next(new AppError("User is already banned", 400));
  }

  // Prevent banning other admins
  if (user.role.includes("admin")) {
    return next(new AppError("Cannot ban admin users", 403));
  }

  user.isActive = false;
  await user.save();

  // Log the action
  console.log(
    `Admin ${req.user.name} banned user ${user.name} (${user.email}): ${reason}`
  );

  res.status(200).json({
    status: "success",
    message: "User banned successfully",
    data: { user },
  });
});

// Unban user
exports.unbanUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (user.isActive) {
    return next(new AppError("User is not banned", 400));
  }

  user.isActive = true;
  await user.save();

  // Log the action
  console.log(
    `Admin ${req.user.name} unbanned user ${user.name} (${user.email})`
  );

  res.status(200).json({
    status: "success",
    message: "User unbanned successfully",
    data: { user },
  });
});

// ========================== REVENUE REPORTS ==========================
// Enhanced with auto-approval revenue tracking

exports.getRevenueReport = catchAsync(async (req, res, next) => {
  const {
    startDate,
    endDate,
    period = "month", // month, quarter, year
  } = req.query;

  // Set default date range if not provided
  const now = new Date();
  const defaultEndDate = endDate ? new Date(endDate) : now;
  const defaultStartDate = startDate
    ? new Date(startDate)
    : new Date(now.getFullYear(), now.getMonth() - 11, 1); // Last 12 months

  // Enhanced post revenue statistics with auto-approval tracking
  const postRevenueStats = await Post.aggregate([
    {
      $match: {
        createdAt: { $gte: defaultStartDate, $lte: defaultEndDate },
        featuredType: { $ne: "THUONG" },
        isPaid: true
      },
    },
    {
      $group: {
        _id: null,
        totalVipPosts: { $sum: 1 },
        totalRevenue: { $sum: "$featuredCost" },
        avgPostCost: { $avg: "$featuredCost" },
        autoApprovedPosts: {
          $sum: {
            $cond: [
              { $eq: ["$isAutoApproved", true] },
              1,
              0
            ]
          }
        },
        autoApprovedRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$isAutoApproved", true] },
              "$featuredCost",
              0
            ]
          }
        },
        manualApprovedRevenue: {
          $sum: {
            $cond: [
              { $ne: ["$isAutoApproved", true] },
              "$featuredCost",
              0
            ]
          }
        }
      },
    },
  ]);

  // Monthly post revenue trend with auto-approval breakdown
  const monthlyPostRevenue = await Post.aggregate([
    {
      $match: {
        createdAt: { $gte: defaultStartDate, $lte: defaultEndDate },
        featuredType: { $ne: "THUONG" },
        isPaid: true
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        vipPostsCount: { $sum: 1 },
        monthlyRevenue: { $sum: "$featuredCost" },
        autoApprovedCount: {
          $sum: {
            $cond: [
              { $eq: ["$isAutoApproved", true] },
              1,
              0
            ]
          }
        },
        autoApprovedRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$isAutoApproved", true] },
              "$featuredCost",
              0
            ]
          }
        }
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
  ]);

  // Rest of your existing accommodation and district stats code...
  const accommodationStats = await Accommodation.aggregate([
    {
      $match: {
        createdAt: { $gte: defaultStartDate, $lte: defaultEndDate },
      },
    },
    {
      $group: {
        _id: null,
        totalAccommodations: { $sum: 1 },
        approvedAccommodations: {
          $sum: { $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0] },
        },
        avgRating: { $avg: "$averageRating" },
        totalRooms: { $sum: "$totalRooms" },
      },
    },
  ]);

  // Top performing accommodations
  const topAccommodations = await Accommodation.find({
    approvalStatus: "approved",
    averageRating: { $gte: 4.0 },
  })
    .sort({ averageRating: -1, totalReviews: -1 })
    .limit(10)
    .populate("ownerId", "name email")
    .select("name type averageRating totalReviews totalRooms address.district");

  // District performance
  const districtStats = await Accommodation.aggregate([
    {
      $match: { approvalStatus: "approved" },
    },
    {
      $group: {
        _id: "$address.district",
        accommodationCount: { $sum: 1 },
        totalRooms: { $sum: "$totalRooms" },
        avgRating: { $avg: "$averageRating" },
      },
    },
    {
      $sort: { accommodationCount: -1 },
    },
  ]);

  // Enhanced featured post statistics by type with auto-approval
  const featuredPostStats = await Post.aggregate([
    {
      $match: {
        featuredType: { $ne: "THUONG" },
        isPaid: true
      },
    },
    {
      $group: {
        _id: "$featuredType",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$featuredCost" },
        avgCost: { $avg: "$featuredCost" },
        autoApprovedCount: {
          $sum: {
            $cond: [
              { $eq: ["$isAutoApproved", true] },
              1,
              0
            ]
          }
        },
        autoApprovedRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$isAutoApproved", true] },
              "$featuredCost",
              0
            ]
          }
        }
      },
    },
    {
      $sort: { totalRevenue: -1 },
    },
  ]);

  const postStatistics = postRevenueStats[0] || {
    totalVipPosts: 0,
    totalRevenue: 0,
    avgPostCost: 0,
    autoApprovedPosts: 0,
    autoApprovedRevenue: 0,
    manualApprovedRevenue: 0
  };

  const accommodationStatistics = accommodationStats[0] || {
    totalAccommodations: 0,
    approvedAccommodations: 0,
    avgRating: 0,
    totalRooms: 0,
  };

  res.status(200).json({
    status: "success",
    data: {
      postStatistics,
      accommodationStatistics,
      monthlyPostRevenue,
      topAccommodations,
      districtStats,
      featuredPostStats,
      dateRange: {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      },
    },
  });
});

// ========================== DASHBOARD OVERVIEW ==========================
// Enhanced with auto-approval metrics

exports.getDashboardOverview = catchAsync(async (req, res, next) => {
  // Get counts for different entities
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const totalAccommodations = await Accommodation.countDocuments();
  const pendingAccommodations = await Accommodation.countDocuments({
    approvalStatus: "pending",
  });
  const approvedAccommodations = await Accommodation.countDocuments({
    approvalStatus: "approved",
  });
  const totalRooms = await Room.countDocuments();
  
  // Enhanced post statistics with auto-approval
  const totalPosts = await Post.countDocuments();
  const pendingPosts = await Post.countDocuments({ status: "pending" });
  const approvedPosts = await Post.countDocuments({ status: "approved" });
  
  // NEW: Auto-approval statistics
  const autoApprovedPosts = await Post.countDocuments({ 
    status: "approved",
    isAutoApproved: true 
  });
  const manualApprovedPosts = approvedPosts - autoApprovedPosts;
  
  const vipPosts = await Post.countDocuments({ 
    featuredType: { $ne: "THUONG" }, 
    isPaid: true 
  });

  // Get recent activities (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentUsers = await User.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });

  const recentAccommodations = await Accommodation.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });

  const recentPosts = await Post.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });

  // NEW: Recent auto-approvals
  const recentAutoApprovals = await Post.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
    isAutoApproved: true
  });

  // Get latest pending accommodations
  const latestPendingAccommodations = await Accommodation.find({
    approvalStatus: "pending",
  })
    .populate("ownerId", "name email")
    .sort({ createdAt: -1 })
    .limit(5)
    .select("name type createdAt ownerId address.district");

  // Get latest pending posts (only manual approval needed - free posts)
  const latestPendingPosts = await Post.find({
    status: "pending",
    $or: [
      { featuredType: "THUONG" }, // Free posts
      { isAutoApproved: { $ne: true } } // Or posts that weren't auto-approved
    ]
  })
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .limit(5)
    .select("title featuredType createdAt userId address.district rent isAutoApproved");

  // NEW: Get latest auto-approved posts for monitoring
  const latestAutoApprovedPosts = await Post.find({
    isAutoApproved: true
  })
    .populate("userId", "name email")
    .sort({ approvalDate: -1 })
    .limit(5)
    .select("title featuredType approvalDate userId address.district rent featuredCost");

  // Get latest users
  const latestUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select("name email role createdAt isActive isVerified");

  // Calculate auto-approval efficiency
  const autoApprovalRate = approvedPosts > 0 ? Math.round((autoApprovedPosts / approvedPosts) * 100) : 0;

  res.status(200).json({
    status: "success",
    data: {
      overview: {
        totalUsers,
        activeUsers,
        bannedUsers: totalUsers - activeUsers,
        totalAccommodations,
        pendingAccommodations,
        approvedAccommodations,
        totalRooms,
        totalPosts,
        pendingPosts,
        approvedPosts,
        autoApprovedPosts, // NEW
        manualApprovedPosts, // NEW
        vipPosts,
        recentUsers,
        recentAccommodations,
        recentPosts,
        recentAutoApprovals, // NEW
        autoApprovalRate // NEW
      },
      latestPendingAccommodations,
      latestPendingPosts,
      latestAutoApprovedPosts, // NEW
      latestUsers,
    },
  });
});



