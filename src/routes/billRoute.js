const express = require("express");
const router = express.Router();
const billController = require("../controllers/billController");
const { protect, restrictTo } = require("../controllers/authenticateController");

// Protect all routes
router.use(protect);

// Bill management routes
router
  .route("/room/:roomId/monthly")
  .post(restrictTo("landlord", "admin"), billController.createMonthlyBill);

router
  .route("/room/:roomId/custom")
  .post(restrictTo("landlord", "admin"), billController.createCustomBill);

router
  .route("/room/:roomId")
  .get(restrictTo("landlord", "admin"), billController.getRoomBills);

router
  .route("/tenant/my-bills")
  .get(restrictTo("tenant", "co-tenant"), billController.getTenantBills);

router
  .route("/:billId")
  .get(billController.getBillDetails)
  .put(restrictTo("landlord", "admin"), billController.updateBill)
  .delete(restrictTo("landlord", "admin"), billController.deleteBill);

router
  .route("/:billId/send")
  .post(restrictTo("landlord", "admin"), billController.sendBill);

router
  .route("/:billId/view")
  .post(restrictTo("tenant", "co-tenant"), billController.markBillAsViewed);

module.exports = router;