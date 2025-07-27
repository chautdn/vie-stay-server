// src/routes/withdrawalRoute.js
const express = require("express");
const {
  checkEligibility,
  addBankAccount,
  createWithdrawalRequest,
  getWithdrawalHistory,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  verifyBankAccount,
  getUnverifiedBankAccounts
} = require("../controllers/withdrawalController");
const { protect, restrictTo } = require("../controllers/authenticateController");

const router = express.Router();

// Protect all routes
router.use(protect);

// User routes
router.get("/check-eligibility", checkEligibility);
router.post("/bank-account", addBankAccount);
router.put("/bank-account", addBankAccount); // Allow updates
router.post("/request", createWithdrawalRequest);
router.get("/history", getWithdrawalHistory);

// Admin routes
router.use(restrictTo("admin"));
router.get("/pending", getPendingWithdrawals);
router.put("/:transactionId/approve", approveWithdrawal);
router.put("/:transactionId/reject", rejectWithdrawal);
router.put("/verify-bank/:userId", verifyBankAccount);
router.get("/unverified-bank-accounts", getUnverifiedBankAccounts);

module.exports = router;