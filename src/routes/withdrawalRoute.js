const express = require("express");
const router = express.Router();
const withdrawalController = require("../controllers/withdrawalController");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

// ================================
// PUBLIC ROUTES
// ================================

// ✅ VNPay withdrawal return (webhook)
router.get("/vnpay/return", withdrawalController.handleVNPayReturn);

// ✅ Apply protection middleware
router.use(protect);

// ================================
// TENANT ROUTES
// ================================

// ✅ Tạo yêu cầu rút tiền
router.post(
  "/request/:confirmationId",
  restrictTo("tenant"),
  withdrawalController.createWithdrawalRequest
);

// ✅ Xem lịch sử withdrawal
router.get(
  "/my-requests",
  restrictTo("tenant"),
  withdrawalController.getTenantWithdrawals
);

// ✅ Hủy withdrawal request
router.patch(
  "/cancel/:requestId",
  restrictTo("tenant"),
  withdrawalController.cancelWithdrawal
);

// ================================
// LANDLORD ROUTES
// ================================

// ✅ Xem pending withdrawals
router.get(
  "/pending",
  restrictTo("landlord"),
  withdrawalController.getPendingWithdrawals
);

// ✅ Approve withdrawal
router.patch(
  "/approve/:requestId",
  restrictTo("landlord"),
  withdrawalController.approveWithdrawal
);

// ✅ Reject withdrawal
router.patch(
  "/reject/:requestId",
  restrictTo("landlord"),
  withdrawalController.rejectWithdrawal
);

// ================================
// COMMON ROUTES
// ================================

// ✅ Check withdrawal status
router.get(
  "/status/:requestId",
  restrictTo("tenant", "landlord"),
  withdrawalController.checkWithdrawalStatus
);

// ================================
// ADMIN ROUTES
// ================================

// ✅ Get all withdrawals
router.get(
  "/admin/all",
  restrictTo("admin"),
  withdrawalController.getAllWithdrawals
);

// ✅ Withdrawal statistics
router.get(
  "/admin/stats",
  restrictTo("admin"),
  withdrawalController.getWithdrawalStats
);

module.exports = router;
