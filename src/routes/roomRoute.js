const express = require("express");
const roomController = require("../controllers/roomController");
const { protect, restrictTo } = require("../controllers/authenticateController");

const router = express.Router();

// Public routes (no authentication required)
router.get("/available", roomController.getAvailableRooms); // Get all available rooms
router.get("/search", roomController.searchRooms); // Search rooms with filters
router.get("/:roomId", roomController.getRoomById); // Get single room details

// Protected routes (authentication required)
router.use(protect);

// All rooms (admin/owner access)
router.get("/", restrictTo("admin", "landlord"), roomController.getAllRoom);

// Accommodation-specific rooms (owner access)
router.get("/accommodation/:accommodationId", 
  restrictTo("landlord"), 
  roomController.getAllRoomsByAccommodateId
);

// Room management (owner access)
router.post("/accommodation/:accommodationId", 
  restrictTo("landlord"), 
  roomController.createRoom
);

router.put("/:roomId", 
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

router.delete("/:roomId", 
  restrictTo("landlord"), 
  roomController.deleteRoom
);

// Room-specific data
router.get("/:roomId/requests", 
  restrictTo("landlord"), 
  roomController.getAllRequestsInRoom
);

router.get("/:roomId/tenants", 
  restrictTo("landlord"), 
  roomController.getCurrentTenantsInRoom
);

module.exports = router;