const express = require("express");
const router = express.Router();
const roomOccupancyController = require("../controllers/roomOccupancyController");
const { protect, restrictTo } = require("../controllers/authenticateController");

// Protect all routes
router.use(protect);

// Room occupancy management routes
router
  .route("/room/:roomId/tenants")
  .get(roomOccupancyController.getRoomTenants)
  .post(restrictTo("landlord", "admin"), roomOccupancyController.addTenantToRoom);

router
  .route("/room/:roomId/tenants/:tenantId")
  .delete(restrictTo("landlord", "admin"), roomOccupancyController.removeTenantFromRoom);

router
  .route("/room/:roomId/representative")
  .get(roomOccupancyController.getRoomRepresentative);

router
  .route("/room/:roomId/representative/:tenantId")
  .put(restrictTo("landlord", "admin"), roomOccupancyController.setRepresentative);

router
  .route("/tenant/:tenantId/history")
  .get(roomOccupancyController.getTenantHistory);

module.exports = router;