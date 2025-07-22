const express = require("express");
const router = express.Router();
const tenancyAgreementController = require("../controllers/tenancyAgreementController");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

// Base protection - tất cả routes đều cần đăng nhập
router.use(protect);

// Routes cho landlord
router.get(
  "/landlord/agreements",
  restrictTo("landlord"),
  tenancyAgreementController.getLandlordAgreements
);

router.get(
  "/landlord/agreements/:agreementId",
  restrictTo("landlord"),
  tenancyAgreementController.getAgreementDetails
);

router.get(
  "/landlord/agreements/:agreementId/download",
  restrictTo("landlord"),
  tenancyAgreementController.downloadSignedContract
);

// Routes cho tenant
router.get(
  "/tenant/agreements",
  restrictTo("tenant"),
  tenancyAgreementController.getTenantAgreements
);

router.get(
  "/tenant/agreements/:agreementId",
  restrictTo("tenant"),
  tenancyAgreementController.getAgreementDetails
);

router.get(
  "/tenant/agreements/:agreementId/download",
  restrictTo("tenant"),
  tenancyAgreementController.downloadSignedContract
);

// Routes chung cho cả landlord và tenant (không cần restrictTo)
router.get(
  "/agreements/:agreementId/status",
  tenancyAgreementController.getAgreementStatus
);

// Thêm route mới để lấy agreements theo roomId
router.get(
  "/room/:roomId",
  restrictTo("landlord", "tenant"),
  tenancyAgreementController.getRoomAgreements
);

// Route download cho cả landlord và tenant
router.get(
  "/:agreementId/download",
  restrictTo("landlord", "tenant"),
  tenancyAgreementController.downloadSignedContract
);

module.exports = router;
