const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { allowRoles } = require("../middleware/auth");
const walletController = require("../controllers/walletController");

// Tạo liên kết thanh toán VNPay QR
router.post("/vnpay/create-url", protect, walletController.createPaymentUrl);

// VNPay redirect người dùng về sau khi thanh toán
router.get("/vnpay/return", walletController.handleVNPayReturn);

// VNPay gọi IPN (Server-to-Server)
router.get("/vnpay/ipn", walletController.handleVNPayIpn);

// Lấy lịch sử giao dịch ví của user
router.get("/transactions", protect, walletController.getMyTransactions);

// Xác nhận giao dịch nạp tiền qua mã QR
router.post("/confirm-deposit", protect, walletController.confirmDeposit);

// Mô phỏng nạp tiền trong môi trường test/sandbox
router.post("/simulate-topup", protect, walletController.simulateTopUp);
router.get("/exchange-rates", walletController.getExchangeRates);
router.get("/overview", protect, walletController.getOverview);
router.post("/withdraw", protect, walletController.requestWithdrawal);
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
