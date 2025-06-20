const express = require('express');
const router = express.Router();
const controller = require('../controllers/accommodationController');

router.post('/', controller.createAccommodation);
router.get('/:id',controller.getAccommodationById);
router.put('/:id', controller.updateAccommodation);
router.get('/', controller.getAccommodations);
router.put('/:id/status', controller.updateStatus);

module.exports = router;
