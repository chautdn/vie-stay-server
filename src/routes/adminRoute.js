const express = require("express");
const {
  // Dashboard
  getDashboardOverview,
  
  // Accommodation Management
  getAccommodations,
  getAccommodationDetails,
  approveAccommodation,
  rejectAccommodation,
  
  // User Management
  getUsers,
  getUserDetails,
  banUser,
  unbanUser,
  
  // Post Management - Enhanced with auto-approval support
  getPosts,
  getPostDetails,
  approvePost,
  rejectPost,
  deactivatePost,
  activatePost,
  getAutoApprovalStats, // NEW: Auto-approval statistics
  
  // Revenue Reports
  getRevenueReport
} = require("../controllers/adminController");

const { protect, restrictTo } = require("../controllers/authenticateController");

const router = express.Router();

// Protect all admin routes - only admins can access
router.use(protect);
router.use(restrictTo("admin"));

// ========================== DASHBOARD ROUTES ==========================
router.get("/dashboard/overview", getDashboardOverview);

// ========================== POST MANAGEMENT ROUTES ==========================
// Enhanced post management with auto-approval support
router.get("/posts", getPosts);
router.get("/posts/stats/auto-approval", getAutoApprovalStats); // NEW: Auto-approval statistics
router.get("/posts/:id", getPostDetails);
router.patch("/posts/:id/approve", approvePost);
router.patch("/posts/:id/reject", rejectPost);
router.patch("/posts/:id/deactivate", deactivatePost);
router.patch("/posts/:id/activate", activatePost);

// ========================== ACCOMMODATION MANAGEMENT ROUTES ==========================
router.get("/accommodations", getAccommodations);
router.get("/accommodations/:id", getAccommodationDetails);
router.patch("/accommodations/:id/approve", approveAccommodation);
router.patch("/accommodations/:id/reject", rejectAccommodation);

// ========================== USER MANAGEMENT ROUTES ==========================
router.get("/users", getUsers);
router.get("/users/:id", getUserDetails);
router.patch("/users/:id/ban", banUser);
router.patch("/users/:id/unban", unbanUser);

// ========================== REVENUE REPORTS ROUTES ==========================
router.get("/reports/revenue", getRevenueReport);

// ========================== SYSTEM MONITORING ROUTES ==========================
// NEW: Enhanced system monitoring with auto-approval awareness
router.get("/system/health", async (req, res) => {
  try {
    const Post = require("../models/Post");
    
    // Check for posts that might need attention
    const pendingCount = await Post.countDocuments({ 
      status: "pending",
      featuredType: "THUONG" // Only free posts need manual approval
    });
    
    const expiredVipCount = await Post.countDocuments({
      featuredType: { $ne: "THUONG" },
      featuredEndDate: { $lt: new Date() },
      status: "approved"
    });
    
    // Check auto-renewal failures
    const failedAutoRenewals = await Post.countDocuments({
      autoRenew: false,
      featuredType: "THUONG",
      featuredCost: { $gt: 0 } // Had previous VIP cost
    });

    // Auto-approval system efficiency
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAutoApprovals = await Post.countDocuments({
      isAutoApproved: true,
      approvalDate: { $gte: last24Hours }
    });

    const recentVipPosts = await Post.countDocuments({
      featuredType: { $ne: "THUONG" },
      isPaid: true,
      createdAt: { $gte: last24Hours }
    });

    // Calculate auto-approval efficiency
    const autoApprovalEfficiency = recentVipPosts > 0 ? 
      Math.round((recentAutoApprovals / recentVipPosts) * 100) : 100;

    res.status(200).json({
      status: "success",
      data: {
        systemHealth: {
          pendingManualApprovals: pendingCount,
          expiredVipPosts: expiredVipCount,
          failedAutoRenewals: failedAutoRenewals,
          autoApprovalSystemActive: true,
          autoApprovalEfficiency: autoApprovalEfficiency,
          recentAutoApprovals: recentAutoApprovals,
          recentVipPosts: recentVipPosts,
          lastChecked: new Date()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error checking system health",
      error: error.message
    });
  }
});

// NEW: Bulk operations for posts
router.post("/posts/bulk-approve", async (req, res) => {
  try {
    const { postIds } = req.body;
    const adminId = req.user._id;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Post IDs array is required"
      });
    }

    const Post = require("../models/Post");
    
    // Find pending posts
    const posts = await Post.find({
      _id: { $in: postIds },
      status: 'pending'
    });

    if (posts.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No pending posts found to approve"
      });
    }

    // Approve each post manually
    const results = [];
    for (const post of posts) {
      try {
        if (typeof post.manuallyApprove === 'function') {
          await post.manuallyApprove();
        } else {
          // Fallback for existing model
          post.status = "approved";
          post.approvedBy = adminId;
          post.approvedAt = new Date();
          post.isAutoApproved = false;
          post.approvalType = 'manual';
          post.approvalDate = new Date();
          await post.save();
        }
        results.push({ postId: post._id, success: true });
      } catch (error) {
        results.push({ postId: post._id, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    console.log(`Admin ${req.user.name} bulk approved ${successCount} posts`);

    res.status(200).json({
      status: "success",
      message: `Successfully approved ${successCount} out of ${postIds.length} posts`,
      data: { results, successCount }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error in bulk approval",
      error: error.message
    });
  }
});

module.exports = router;