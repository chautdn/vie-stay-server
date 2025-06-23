const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authenticateController');

const router = express.Router();

// Authentication routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/google-login', authController.googleLogin);
router.post('/logout', authController.logout);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendEmailVerification);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);

// Protected routes (add authentication middleware if you have it)
// router.use(authController.protect); // Uncomment if you have authentication middleware

// Specific profile update routes
router.patch('/:id/name', userController.updateUserName);
router.patch('/:id/phone', userController.updateUserPhone);
router.patch('/:id/avatar', userController.uploadUserPhoto, userController.updateUserAvatar);

// General user routes
router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;