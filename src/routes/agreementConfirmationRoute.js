const express = require("express");
const router = express.Router();
const agreementConfirmationController = require("../controllers/agreementConfirmationController");
const paymentService = require("../services/paymentService");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

// ================================
// PUBLIC ROUTES (không cần login) - PHẢI ĐẶT TRƯỚC protect middleware
// ================================

// ✅ VNPay payment return (webhook) - PUBLIC ROUTE
router.get(
  "/payment/vnpay/return",
  agreementConfirmationController.handlePaymentReturn
);

// ✅ Xem chi tiết confirmation qua token (tenant click từ email)
router.get(
  "/confirm/:token",
  agreementConfirmationController.getConfirmationByToken
);

// ✅ Thêm route xử lý callback từ BoldSign (webhook)
router.post("/signature/callback", async (req, res) => {
  try {
    const result = await paymentService.handleSignatureCallback(req.body);
    res.status(200).json({
      success: true,
      message: "Signature callback processed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error processing signature callback:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to process signature callback",
    });
  }
});

// ✅ Apply protection từ đây trở xuống
router.use(protect);

// ================================
// TENANT CONFIRMATION ACTIONS
// ================================
router.post(
  "/:confirmationId/test-completed-email",
  agreementConfirmationController.testContractCompletedEmail
);
// ✅ Xác nhận đồng ý hợp đồng (tenant)
router.post(
  "/confirm/:token",
  restrictTo("tenant"),
  agreementConfirmationController.confirmAgreement
);

// ✅ Từ chối hợp đồng (tenant)
router.post(
  "/reject/:token",
  restrictTo("tenant"),
  agreementConfirmationController.rejectAgreement
);

// ================================
// TENANT PAYMENT ROUTES
// ================================

// ✅ SỬA: Tạo thanh toán tiền cọc (tenant) - đổi URL
router.post(
  "/payment/:confirmationId",
  restrictTo("tenant"),
  agreementConfirmationController.createDepositPayment
);

// ✅ Kiểm tra trạng thái thanh toán
router.get(
  "/payment/:transactionId/status",
  restrictTo("tenant"),
  agreementConfirmationController.checkPaymentStatus
);

// ================================
// TENANT VIEW ROUTES
// ================================

// ✅ Xem tất cả confirmations của tenant
router.get(
  "/my-confirmations",
  restrictTo("tenant"),
  agreementConfirmationController.getTenantConfirmations
);

// ✅ Xem lịch sử thanh toán của tenant
router.get(
  "/my-payments",
  restrictTo("tenant"),
  agreementConfirmationController.getTenantPayments
);

// ✅ Chi tiết 1 confirmation cụ thể
router.get(
  "/:confirmationId",
  restrictTo("tenant", "landlord"),
  agreementConfirmationController.getConfirmationById
);

// ================================
// TENANT UTILITIES
// ================================

// ✅ Gửi lại email xác nhận
router.post(
  "/resend/:confirmationId",
  restrictTo("tenant"),
  agreementConfirmationController.resendConfirmationEmail
);

// ================================
// ADMIN ROUTES
// ================================

// ✅ Thống kê confirmations (admin)
router.get(
  "/admin/stats",
  restrictTo("admin"),
  agreementConfirmationController.getConfirmationStats
);

// ✅ Làm hết hạn confirmations cũ (admin/cron job)

module.exports = router;
