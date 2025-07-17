const User = require("../models/User");
const Accommodation = require("../models/Accommodation");
const Room = require("../models/Room");
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

// ========================== ACCOMMODATION MANAGEMENT ==========================

// Get all accommodations with filters
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

// Get all users with filters
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

  res.status(200).json({
    status: "success",
    data: {
      user,
      accommodations,
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

// Get revenue statistics
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

  // Accommodation statistics
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

  // Monthly revenue trend (mock data - replace with actual payment data when available)
  const monthlyTrend = await Accommodation.aggregate([
    {
      $match: {
        createdAt: { $gte: defaultStartDate, $lte: defaultEndDate },
        approvalStatus: "approved",
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        accommodationsAdded: { $sum: 1 },
        totalRooms: { $sum: "$totalRooms" },
        // Mock revenue calculation - replace with actual payment data
        estimatedRevenue: { $sum: { $multiply: ["$totalRooms", 50000] } },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
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

  const statistics = accommodationStats[0] || {
    totalAccommodations: 0,
    approvedAccommodations: 0,
    avgRating: 0,
    totalRooms: 0,
  };

  res.status(200).json({
    status: "success",
    data: {
      statistics,
      monthlyTrend,
      topAccommodations,
      districtStats,
      dateRange: {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      },
    },
  });
});

// ========================== DASHBOARD OVERVIEW ==========================

// Get admin dashboard overview
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

  // Get recent activities (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentUsers = await User.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });

  const recentAccommodations = await Accommodation.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });

  // Get latest pending accommodations
  const latestPendingAccommodations = await Accommodation.find({
    approvalStatus: "pending",
  })
    .populate("ownerId", "name email")
    .sort({ createdAt: -1 })
    .limit(5)
    .select("name type createdAt ownerId address.district");

  // Get latest users
  const latestUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select("name email role createdAt isActive isVerified");

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
        recentUsers,
        recentAccommodations,
      },
      latestPendingAccommodations,
      latestUsers,
    },
  });
});
