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

module.exports = router;