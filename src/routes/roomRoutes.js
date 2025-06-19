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
router.use(protect); // Protect all routes in this router// Restrict access to certain roles
router.get("/", roomController.getAllRoom);
router.post("/", restrictTo("landlord", "admin"), roomController.createRoom);
router.get("/search", roomController.searchRooms);
router.get("/:roomId", roomController.getRoomById);
router.patch("/:roomId/hide", roomController.hideRoom);
router.patch("/:roomId/unhide", roomController.unhideRoom);

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

module.exports = router;
