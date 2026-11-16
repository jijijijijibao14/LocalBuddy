const router = require("express").Router();
const c = require("../controllers/adminController");
const refunds = require("../controllers/refundController");
const wallet = require("../controllers/walletController");
const { protect, allowRoles } = require("../middleware/auth");
router.use(protect, allowRoles("admin"));
router.get("/stats", c.stats);
router.get("/users", c.users);
router.patch("/users/:id/status", c.updateUser);
router.patch("/users/:id/premium", c.updateLocalPremium);
router.get("/buddies", c.buddies);
router.patch("/buddies/:id/verification", c.updateBuddyVerification);
router.get("/bookings", c.bookings);
router.patch("/bookings/:id", c.updateBooking);
router.get("/refunds", refunds.listAdmin);
router.patch("/refunds/:id/review", refunds.review);
router.patch("/refunds/:id/confirm-external", refunds.confirmExternalRefund);
router.get("/settings/cancellation-policy", refunds.getCancellationPolicy);
router.patch("/settings/cancellation-policy", refunds.updateCancellationPolicy);

// Quản lý rút tiền trong Admin
router.get("/withdrawals", wallet.getAdminWithdrawals);
router.get("/withdrawals/:id", wallet.getWithdrawalDetail);
router.patch("/withdrawals/:id/process", wallet.processWithdrawal);
router.patch("/withdrawals/:id/complete", wallet.completeWithdrawal);
router.patch("/withdrawals/:id/reject", wallet.rejectWithdrawal);
module.exports = router;
