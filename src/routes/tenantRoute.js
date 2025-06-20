const tenancyAgreementController = require("../controllers/tenancyAgreementController");
const express = require("express");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");
const router = express.Router();

// Protect all routes
// router.use(protect);
// Get tenant by room ID
router.get("/room/:roomId", tenancyAgreementController.getTenantByRoom);

module.exports = router;
