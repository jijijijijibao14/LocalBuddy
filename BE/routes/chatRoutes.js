const router = require("express").Router();
const { protect } = require("../middleware/auth");
const {
  getConversations,
  getMessages,
  sendMessage,
  markRead,
} = require("../controllers/chatController");

// Tất cả routes chat đều yêu cầu đăng nhập
router.use(protect);

// Lấy danh sách cuộc hội thoại
router.get("/conversations", getConversations);

// Lấy lịch sử tin nhắn với một user khác
router.get("/:otherUserId/messages", getMessages);

// Gửi tin nhắn (REST fallback)
router.post("/:otherUserId/messages", sendMessage);

// Đánh dấu đã đọc
router.patch("/:otherUserId/read", markRead);

module.exports = router;

