// const express = require('express');
// const userController = require('../controllers/userController');
// const authController = require('../controllers/authenticateController');

// const router = express.Router();

// router.post('/signup', authController.signup);
// router.post('/login', authController.login);
// router.post('/google-login', authController.googleLogin);
// router.post('/logout', authController.logout);
// router.post('/verify-email', authController.verifyEmail);
// router.post('/resend-verification', authController.resendEmailVerification);
// router.post('/forgot-password', authController.forgotPassword);
// router.patch('/reset-password/:token', authController.resetPassword);

// router
//   .route('/')
//   .get(userController.getAllUsers)
//   .post(userController.createUser);

// router
//   .route('/:id')
//   // .get(userController.getUser)
//   .patch(userController.updateUser)
//   .delete(userController.deleteUser)
//   .get(userController.getUserById);

  


// module.exports = router;

const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authenticateController");
const editController = require("../controllers/editProfile");

const router = express.Router();

// ===== AUTHENTICATION ROUTES =====
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/google-login", authController.googleLogin);
router.post("/logout", authController.logout);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendEmailVerification);
router.post("/forgot-password", authController.forgotPassword);
router.patch("/reset-password/:token", authController.resetPassword);

// ===== USER CRUD =====
router
  .route("/")
  .get(userController.getAllUsers)
  .post(userController.createUser);

router
  .route("/:id")
  .get(userController.getUserById)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

// ===== PROFILE UPDATE ROUTES =====
router.patch("/:id/name", editController.updateName);
router.patch("/:id/phone", editController.updatePhone);
router.patch("/:id/password", editController.updatePassword);
router.patch("/:id/avatar", editController.uploadAvatar, editController.updateAvatar);

module.exports = router;

