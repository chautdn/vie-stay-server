const express = require("express");
const router = express.Router();
const {
  requestCoTenant,
  getCoTenantRequests,
  approveCoTenantRequest,
  rejectCoTenantRequest,
  getCoTenantRequestsByLandlord,
} = require("../controllers/coTenantController");
const {
  protect,
  restrictTo,
} = require("../controllers/authenticateController");
// Định nghĩa routes

router.use(protect); // Bảo vệ tất cả các route bên dưới

router.post("/rooms/:roomId/request-co-tenant", requestCoTenant);
router.get("/co-tenant-requests", getCoTenantRequests);
router.get("/co-tenant-requests/me", getCoTenantRequestsByLandlord); // Assuming this is for landlord to view requests
router.post("/co-tenant-requests/:requestId/approve", approveCoTenantRequest);
router.post("/co-tenant-requests/:requestId/reject", rejectCoTenantRequest);

module.exports = router;
