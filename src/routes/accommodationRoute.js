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


router.get("/me", accommodationController.getAccommodationByOwnerId);
router.get("/:id", accommodationController.getAccommodationById);

router.post("/", accommodationController.createAccommodation);
router.put("/:id", accommodationController.updateAccommodation);
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