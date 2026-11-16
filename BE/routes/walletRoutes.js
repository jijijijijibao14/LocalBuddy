const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { allowRoles } = require("../middleware/auth");
const walletController = require("../controllers/walletController");

// Tạo liên kết thanh toán PayOS QR
router.post("/payos/create-url", protect, walletController.createPayOSPaymentUrl);

// Kiểm tra trạng thái giao dịch PayOS (dùng cho polling và xác nhận)
router.get("/payos/status/:orderCode", protect, walletController.checkPayOSStatus);

// PayOS redirect người dùng về sau khi thanh toán trên trang web hosted
router.get("/payos/return", walletController.handlePayOSReturn);

// PayOS gọi Webhook (Server-to-Server)
router.post("/payos/webhook", walletController.handlePayOSWebhook);

// Xác nhận giao dịch PayOS
router.post("/payos/confirm", protect, walletController.confirmDeposit);

// Alias cho các endpoint VNPay cũ để không gây lỗi nếu có nơi gọi
router.post("/vnpay/create-url", protect, walletController.createPayOSPaymentUrl);
router.get("/vnpay/return", walletController.handlePayOSReturn);
router.get("/vnpay/ipn", walletController.handleVNPayIpn);

// Lấy lịch sử giao dịch ví của user
router.get("/transactions", protect, walletController.getMyTransactions);

// Xác nhận giao dịch nạp tiền qua mã QR
router.post("/confirm-deposit", protect, walletController.confirmDeposit);

// Mô phỏng nạp tiền trong môi trường test/sandbox
router.post("/simulate-topup", protect, walletController.simulateTopUp);
router.get("/exchange-rates", walletController.getExchangeRates);
router.get("/overview", protect, walletController.getOverview);
router.get("/settlements", protect, allowRoles("admin"), walletController.getPendingSettlements);
router.patch("/settlements/:id", protect, allowRoles("admin"), walletController.settleLocalBooking);
// Rút tiền - Dành cho người dùng
router.post("/withdraw", protect, walletController.requestWithdrawal);
router.get("/withdrawals/mine", protect, walletController.getMyWithdrawals);
router.get("/withdrawals/:id", protect, walletController.getWithdrawalDetail);
router.patch("/withdrawals/:id", protect, walletController.updatePendingWithdrawal);
router.patch("/withdrawals/:id/cancel", protect, walletController.cancelPendingWithdrawal);

// Quản lý rút tiền - Dành cho Admin
router.get("/admin/withdrawals", protect, allowRoles("admin"), walletController.getAdminWithdrawals);
router.patch("/admin/withdrawals/:id/process", protect, allowRoles("admin"), walletController.processWithdrawal);
router.patch("/admin/withdrawals/:id/complete", protect, allowRoles("admin"), walletController.completeWithdrawal);
router.patch("/admin/withdrawals/:id/reject", protect, allowRoles("admin"), walletController.rejectWithdrawal);

// Tương thích ngược với các endpoint cũ
router.get("/withdrawals", protect, allowRoles("admin"), walletController.getPendingWithdrawals);
router.patch(
  "/withdrawals/:id",
  protect,
  allowRoles("admin"),
  walletController.resolveWithdrawal,
);
router.patch(
  "/commission",
  protect,
  allowRoles("admin"),
  walletController.updateCommission,
);

module.exports = router;
