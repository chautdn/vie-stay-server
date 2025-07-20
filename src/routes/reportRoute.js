const express = require('express');
const reportController = require('../controllers/reportController');
const { protect, restrictTo } = require('../controllers/authenticateController');

const router = express.Router();

// Public routes
router.post('/', reportController.createReport);

// Protected routes (Admin only)
router.use(protect);
router.use(restrictTo('admin'));

router.get('/', reportController.getAllReports);
router.get('/stats', reportController.getReportStats);
router.get('/post/:postId', reportController.getReportsByPost);
router.get('/:id', reportController.getReportById);
router.patch('/:id/status', reportController.updateReportStatus);

module.exports = router;
