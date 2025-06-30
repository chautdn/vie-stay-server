const tenantController = require("../controllers/tenantController");
const express = require("express");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");
const router = express.Router();

// Protect all routes
// router.use(protect);

// Get tenants by room ID từ currentTenant
router.get("/room/:roomId", tenantController.getTenantByRoom);

// Get tenant details by tenant ID
router.get("/details/:tenantId", tenantController.getTenantDetails);

module.exports = router;
