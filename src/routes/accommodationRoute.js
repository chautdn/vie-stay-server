const accommodationController = require("../controllers/accommodationController");
const express = require("express");

const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");
const router = express.Router();

// Protect all routes
router.use(protect);
router.use(restrictTo("landlord", "admin"));

// Get accommodations by owner (for the current user)
router.get("/me", accommodationController.getAccommodationByOwnerId);

// Get all accommodations (with filtering)
router.get("/", accommodationController.getAccommodations);

// Get single accommodation by ID
router.get("/:id", accommodationController.getAccommodationById);

// Create new accommodation
router.post("/", accommodationController.createAccommodation);

// Update accommodation
router.put("/:id", accommodationController.updateAccommodation);

// Update accommodation status
router.put("/:id/status", accommodationController.updateStatus);

module.exports = router;