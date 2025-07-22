const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authenticateController");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/google-login", authController.googleLogin);
router.post("/logout", authController.logout);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendEmailVerification);
router.post("/forgot-password", authController.forgotPassword);
router.patch("/reset-password/:token", authController.resetPassword);
router.get("/profile", authController.protect, userController.getUserProfile);

router.patch("/:id/name", userController.updateUserName);
router.patch("/:id/phone", userController.updateUserPhone);
router.patch(
  "/:id/avatar",
  userController.updateUserAvatar
);

router
  .route("/")
  .get(userController.getAllUsers)
  .post(userController.createUser);

router
  .route("/:id")
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

// Thêm routes mới
router.post(
  "/:id/verify-national-id",
  authController.protect,
  userController.uploadNationalIdPhotos,
  userController.verifyAndExtractNationalId
);

router.get(
  "/:id/national-id-info",
  authController.protect,
  userController.getNationalIdInfo
);

module.exports = router;
