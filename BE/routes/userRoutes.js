const router = require("express").Router();
const { protect } = require("../middleware/auth");
const userController = require("../controllers/userController");
const upload = require("../middleware/upload");

// Lấy hồ sơ của tài khoản đang đăng nhập.
router.get("/me", protect, userController.getMyProfile);
router.get("/me/buddy-profile", protect, userController.getMyBuddyProfile);

// Cập nhật hồ sơ của tài khoản đang đăng nhập.
router.patch("/me", protect, upload.any(), userController.updateMyProfile);

router.patch("/me/kyc-demo/complete", protect, userController.completeDemoKyc);

module.exports = router;
