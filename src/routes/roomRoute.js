const express = require("express");
const roomController = require("../controllers/roomController");
const { protect, restrictTo } = require("../controllers/authenticateController");

const router = express.Router();

// ✅ Public routes (không cần auth)
router.get("/", roomController.getAllRooms);
router.get("/search", roomController.searchRooms);
router.get("/new-posts", roomController.getNewestRoom); // ✅ Lấy 10 bài đăng mới nhất

// ✅ Protected routes
// ✅ Routes theo roomId (đặt cuối để tránh conflict)
router.get("/:roomId", roomController.getRoomById);
router.use(protect); // Apply auth cho tất cả routes phía dưới

// ✅ Routes theo accommodation
router.get(
  "/accommodation/:accommodationId",
  roomController.getAllRoomsByAccommodateId
);
router.post(
  "/accommodation/:accommodationId/create", // ✅ SỬA: Rõ ràng hơn
  restrictTo("landlord"),
  roomController.createRoom
);

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
router.put(
  "/:roomId/update",
  restrictTo("landlord"),
  roomController.updateRoom
);

router.patch("/:roomId/deactivate", 
  restrictTo("landlord"), 
  roomController.deactivateRoom
);

router.patch("/:roomId/reactivate", 
  restrictTo("landlord"), 
  roomController.reactivateRoom
);
router.delete("/:roomId", restrictTo("landlord"), roomController.deleteRoom);

module.exports = router;
