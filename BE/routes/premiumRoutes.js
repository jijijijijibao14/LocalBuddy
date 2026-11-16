const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const premiumController = require("../controllers/premiumController");

// Lấy danh sách gói Premium (public hoặc authenticated)
router.get("/plans", premiumController.getPlans);

// Đăng ký gói Premium (yêu cầu đăng nhập)
router.post("/subscribe", protect, premiumController.subscribe);

// Kiểm tra trạng thái thanh toán gói Premium qua polling
router.get("/status/:orderCode", protect, premiumController.checkStatus);

// Lấy thông tin gói Premium hiện tại của người dùng
router.get("/my-subscription", protect, premiumController.getMySubscription);

// Lấy lịch sử đăng ký Premium của người dùng
router.get("/history", protect, premiumController.getHistory);

module.exports = router;

