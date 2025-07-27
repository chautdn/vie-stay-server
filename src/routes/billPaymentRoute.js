const express = require("express");
const router = express.Router();
const billPaymentController = require("../controllers/billPaymentController");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

// Protect all routes
router.use(protect);

// Payment routes
router
  .route("/bill/:billId/wallet")
  .post(
    restrictTo("tenant", "co-tenant"),
    billPaymentController.payBillWithWallet
  );

router
  .route("/bill/:billId/cash")
  .post(
    restrictTo("landlord", "admin"),
    billPaymentController.recordCashPayment
  );

router
  .route("/bill/:billId/bank-transfer")
  .post(
    restrictTo("landlord", "admin"),
    billPaymentController.recordBankTransferPayment
  );

router
  .route("/bill/:billId/payments")
  .get(billPaymentController.getBillPayments);

router
  .route("/tenant/history")
  .get(
    restrictTo("tenant", "co-tenant"),
    billPaymentController.getTenantPaymentHistory
  );

router
  .route("/landlord/history")
  .get(
    restrictTo("landlord", "admin"),
    billPaymentController.getLandlordPaymentHistory
  );

router.route("/:paymentId").get(billPaymentController.getPaymentDetails);

router
  .route("/:paymentId/refund")
  .post(restrictTo("landlord", "admin"), billPaymentController.refundPayment);

module.exports = router;
