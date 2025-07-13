const accommodationController = require("../controllers/accommodationController");
const express = require("express");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");

const router = express.Router();

// ✅ PUBLIC ROUTES (no authentication needed)
// Add any public routes here if needed

// ✅ PROTECTED ROUTES (require authentication)
router.use(protect); // Apply authentication to all routes below

// ✅ SPECIFIC ROUTES (must come before generic /:id route)
router.get("/me", 
  restrictTo("landlord"), 
  accommodationController.getAccommodationByOwnerId
);

// ✅ CRUD ROUTES
router.post("/", 
  restrictTo("landlord"), 
  accommodationController.createAccommodation
);

router.get("/", 
  restrictTo("landlord", "admin"), 
  accommodationController.getAccommodations
);

// ✅ SINGLE ACCOMMODATION ROUTES (must come after specific routes)
router.get("/:id", 
  restrictTo("landlord", "admin"), 
  accommodationController.getAccommodationById
);

router.put("/:id", 
  restrictTo("landlord"), 
  accommodationController.updateAccommodation
);

// ✅ STATUS UPDATE (admin only)
router.put("/:id/status", 
  restrictTo("admin"), 
  accommodationController.updateStatus
);

module.exports = router;