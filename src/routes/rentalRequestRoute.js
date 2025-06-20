const express = require("express");
const router = express.Router();
const rentalRequestController = require("../controllers/requestRentalController");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

router.use(protect);
router.use(restrictTo("landlord", "tenant"));
// Tạo yêu cầu thuê phòng
router.post("/", rentalRequestController.createRentalRequest);

// Lấy yêu cầu theo landlord
router.get("/me", rentalRequestController.getRequestsByLandlord);

// Lấy yêu cầu theo toà nhà
router.get(
  "/accommodation/:accommodationId",
  rentalRequestController.getRequestsByAccommodation
);

router.patch("/:requestId/accept", rentalRequestController.acceptRentalRequest);

router.patch("/:requestId/reject", rentalRequestController.rejectRentalRequest);

router.get("/:requestId", rentalRequestController.getRentalRequestDetails);

// Lấy yêu cầu theo phòng
router.get("/room/:roomId", rentalRequestController.getRequestsByRoom);

// Lấy yêu cầu theo tenant
router.get("/tenant/:tenantId", rentalRequestController.getRequestsByTenant);

// Cập nhật trạng thái yêu cầu
router.patch("/status/:requestId", rentalRequestController.updateRequestStatus);

// Xoá yêu cầu
router.delete("/:requestId", rentalRequestController.deleteRentalRequest);

// Đánh dấu đã xem
router.patch("/viewed/:requestId", rentalRequestController.markAsViewed);

module.exports = router;
