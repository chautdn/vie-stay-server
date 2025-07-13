const express = require("express");
const router = express.Router();
const roommateController = require("../controllers/roommateRoomController");

router.get("/", roommateController.getAllRoommateRooms);
router.get("/:id", roommateController.getRoommateRoomById);
router.post("/", roommateController.createRoommateRoom); // <-- thêm dòng này

module.exports = router;
