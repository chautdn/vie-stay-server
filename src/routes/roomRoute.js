const express = require("express");
const roomController = require("../controllers/roomController");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

const router = express.Router();

router.get("/", roomController.getAllRoom);
router.get("/search", roomController.searchRooms);

// ✅ Protected routes
router.use(protect); // Apply auth cho tất cả routes phía dưới

router.get(
  "/accommodation/:accommodationId",
  roomController.getAllRoomsByAccommodateId
);
router.get("/:roomId", restrictTo("landlord"), roomController.getRoomById);
router.get(
  "/:roomId/tenants",
  restrictTo("landlord"),
  roomController.getCurrentTenantsInRoom
);
router.get(
  "/:roomId/requests",
  restrictTo("landlord"),
  roomController.getAllRequestsInRoom
);
router.post("/:accommodationId", restrictTo("landlord"), roomController.createRoom);
router.put(
  "/:roomId/update",
  restrictTo("landlord"),
  roomController.updateRoom
);
router.patch(
  "/:roomId/deactivate",
  restrictTo("landlord"),
  roomController.deactivateRoom
);
router.patch(
  "/:roomId/reactivate",
  restrictTo("landlord"),
  roomController.reactivateRoom
);
router.delete("/:roomId", restrictTo("landlord"), roomController.deleteRoom);
module.exports = router;
