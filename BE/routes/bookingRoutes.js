
const router = require("express").Router();
const c = require("../controllers/bookingController");
const refund = require("../controllers/refundController");
const { protect } = require("../middleware/auth");

router.post("/", protect, c.create);
router.get("/mine", protect, c.mine);
router.get("/refunds/mine", protect, refund.listMine);
router.post("/:id/cancel", protect, refund.cancel);
router.get("/:id/refund-quote", protect, refund.quote);
router.post("/:id/pay-wallet", protect, c.payWithWallet);
router.post("/:id/pay-payos-qr", protect, c.getBookingPayOSQR);
router.get("/:id/payos-status/:orderCode", protect, c.checkBookingPayOSStatus);
router.post("/:id/confirm-payos-qr", protect, c.confirmBookingPayOSQR);

// Giữ lại alias cho VNPay cũ
router.post("/:id/pay-vnpay-qr", protect, c.getBookingPayOSQR);
router.post("/:id/confirm-vnpay-qr", protect, c.confirmBookingPayOSQR);

// Các route dành cho Local.
router.get("/local", protect, c.localMine);
router.patch("/:id/local-status", protect, c.updateLocalStatus);

module.exports = router;
