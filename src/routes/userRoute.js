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

router.patch('/:id/name', userController.updateUserName);
router.patch('/:id/phone', userController.updateUserPhone);
router.patch('/:id/avatar', userController.uploadUserPhoto, userController.updateUserAvatar);

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