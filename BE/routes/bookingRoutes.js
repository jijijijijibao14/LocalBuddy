
const router = require("express").Router();
const c = require("../controllers/bookingController");
const { protect } = require("../middleware/auth");

router.post("/", protect, c.create);
router.get("/mine", protect, c.mine);
router.post("/:id/pay-wallet", protect, c.payWithWallet);
router.post("/:id/pay-vnpay-qr", protect, c.getBookingVNPayQR);
router.post("/:id/confirm-vnpay-qr", protect, c.confirmBookingVNPayQR);

// Các route dành cho Local.
router.get("/local", protect, c.localMine);
router.patch("/:id/local-status", protect, c.updateLocalStatus);

module.exports = router;
