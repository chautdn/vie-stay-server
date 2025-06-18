const express = require("express");
const roomController = require("../controllers/roomController");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

const router = express.Router();

// Protect all routes
// router.use(protect);

// Room CRUD operations
router.get("/", roomController.getAllRoom);
router.post("/", restrictTo("landlord", "admin"), roomController.createRoom);
router.get("/search", roomController.searchRooms);
router.get("/:roomId", roomController.getRoomById);
router.patch(
  "/:roomId",
  // restrictTo("landlord", "admin"),
  roomController.updateRoom
);
router.patch(
  "/:roomId/deactivate",
  // restrictTo("landlord", "admin"),
  roomController.deactivateRoom
);
router.patch(
  "/:roomId/reactivate",
  // restrictTo("landlord", "admin"),
  roomController.reactivateRoom
);
router.delete(
  "/:roomId",
  // restrictTo("landlord", "admin"),
  roomController.deleteRoom
);

// Room management
router.get(
  "/accommodation/:accommodationId",
  roomController.getAllRoomsByAccommodateId
);
router.get(
  "/:roomId/requests",
  // restrictTo("landlord", "admin"),
  roomController.getAllRequestsInRoom
);
router.get(
  "/:roomId/tenants",
  // restrictTo("landlord", "admin"),
  roomController.getCurrentTenantsInRoom
);

module.exports = router;
