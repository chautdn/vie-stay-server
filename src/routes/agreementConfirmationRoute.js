const express = require("express");
const router = express.Router();
const agreementConfirmationController = require("../controllers/agreementConfirmationController");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

// Public routes
router.get(
  "/confirm/:token",
  agreementConfirmationController.getConfirmationByToken
);
router.get(
  "/payment/return",
  agreementConfirmationController.handlePaymentReturn
);

// Protected routes
router.use(protect);

// Tenant routes
router.post(
  "/confirm/:token",
  restrictTo("tenant"),
  agreementConfirmationController.confirmAgreement
);
router.post(
  "/reject/:token",
  restrictTo("tenant"),
  agreementConfirmationController.rejectAgreement
);
router.get(
  "/my-confirmations",
  restrictTo("tenant"),
  agreementConfirmationController.getTenantConfirmations
);
router.post(
  "/resend/:confirmationId",
  restrictTo("tenant"),
  agreementConfirmationController.resendConfirmationEmail
);

// Payment routes - tenant only
router.post(
  "/payment/:confirmationId",
  protect,
  restrictTo("tenant"),
  agreementConfirmationController.createDepositPayment
);
router.get(
  "/payments/my-payments",
  restrictTo("tenant"),
  agreementConfirmationController.getTenantPayments
);
router.get(
  "/payment/:paymentId",
  agreementConfirmationController.getPaymentDetails
);
router.get(
  "/payment/status/:transactionId",
  restrictTo("tenant"),
  agreementConfirmationController.checkPaymentStatus
);
router.post(
  "/payment/cancel/:paymentId",
  restrictTo("tenant"),
  agreementConfirmationController.cancelPayment
);

// Admin routes
router.get(
  "/stats",
  restrictTo("admin"),
  agreementConfirmationController.getConfirmationStats
);
router.post(
  "/expire-old",
  restrictTo("admin"),
  agreementConfirmationController.expireOldConfirmations
);

// Thêm route:
router.get(
  "/:confirmationId",
  protect,
  agreementConfirmationController.getConfirmationById
);

module.exports = router;
