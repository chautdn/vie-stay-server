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
router.put("/:id/status", accommodationController.updateStatus);
module.exports = router;
