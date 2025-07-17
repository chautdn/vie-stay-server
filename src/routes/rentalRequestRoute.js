const express = require("express");
const router = express.Router();
const rentalRequestController = require("../controllers/requestRentalController");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

// Base protection
router.use(protect);

// Public routes (cả landlord và tenant)
router.get(
  "/:requestId/detail",
  rentalRequestController.getRentalRequestDetails
);

// Tenant only routes
router.get("/my-request", rentalRequestController.getMyRentalRequests);
router.post("/", rentalRequestController.createRentalRequest);
router.patch(
  "/:requestId/withdraw",
  rentalRequestController.withdrawRentalRequest
);

// Landlord only routes
router.get(
  "/me",
  restrictTo("landlord"),
  rentalRequestController.getRequestsByLandlord
);

router.get(
  "/stats",
  restrictTo("landlord"),
  rentalRequestController.getRequestStats
);
router.get(
  "/accommodation/:accommodationId",
  restrictTo("landlord"),
  rentalRequestController.getRequestsByAccommodation
);
router.get(
  "/room/:roomId",
  restrictTo("landlord"),
  rentalRequestController.getRequestsByRoom
);
router.patch(
  "/:requestId/accept",
  restrictTo("landlord"),
  rentalRequestController.acceptRentalRequest
);
router.patch(
  "/:requestId/reject",
  restrictTo("landlord"),
  rentalRequestController.rejectRentalRequest
);
router.patch(
  "/:requestId/viewed",
  restrictTo("landlord"),
  rentalRequestController.markAsViewed
);

// Admin only routes

router.patch(
  "/:requestId/status",
  restrictTo("admin"),
  rentalRequestController.updateRequestStatus
);
router.get(
  "/tenant/:tenantId",
  restrictTo("admin"),
  rentalRequestController.getRequestsByTenant
);

// Mixed permission routes (cần kiểm tra ownership trong controller)
router.delete(
  "/:requestId",
  restrictTo("admin"),
  rentalRequestController.deleteRentalRequest
);

module.exports = router;
