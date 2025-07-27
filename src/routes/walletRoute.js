const express = require("express");
const router = express.Router();
const walletController = require("../controllers/walletController");
const { protect } = require("../controllers/authenticateController");

// Protect all routes
router.use(protect);

// Wallet routes
router.route("/balance").get(walletController.getWalletBalance);

router.route("/deposit").post(walletController.depositToWallet);

router.route("/withdraw").post(walletController.withdrawFromWallet);

router.route("/transactions").get(walletController.getWalletTransactions);

module.exports = router;
