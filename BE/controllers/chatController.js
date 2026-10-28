const Message = require("../models/Message");
const User = require("../models/User");
const { buildRoomId, validateMessageContent } = require("../utils/chatUtils");

/**
 * GET /api/chat/conversations
 * Lấy danh sách các cuộc hội thoại của user đang đăng nhập (kèm tin nhắn cuối).
 */
async function getConversations(req, res) {
  try {
    const userId = req.user._id;

    // Lấy tất cả tin nhắn có liên quan đến user hiện tại
    const messages = await Message.find({
      $or: [{ traveler: userId }, { local: userId }],
    })
      .sort({ createdAt: -1 })
      .populate("traveler", "fullName avatar role")
      .populate("local", "fullName avatar role")
      .populate("sender", "fullName avatar role");

    // Group theo roomId, chỉ giữ tin nhắn cuối mỗi phòng
    const roomMap = new Map();
    for (const msg of messages) {
      if (!roomMap.has(msg.roomId)) {
        roomMap.set(msg.roomId, msg);
      }
    }

    // Đếm số tin chưa đọc từng phòng
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          $or: [{ traveler: userId }, { local: userId }],
          sender: { $ne: userId },
          read: false,
        },
      },
      { $group: { _id: "$roomId", count: { $sum: 1 } } },
    ]);
    const unreadMap = new Map(
      unreadCounts.map((r) => [r._id, r.count])
    );

    const conversations = Array.from(roomMap.values()).map((msg) => ({
      roomId: msg.roomId,
      traveler: msg.traveler,
      local: msg.local,
      lastMessage: {
        content: msg.content,
        sender: msg.sender,
        createdAt: msg.createdAt,
      },
      unreadCount: unreadMap.get(msg.roomId) || 0,
    }));

    // Sắp xếp mới nhất lên đầu
    conversations.sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
    );

    res.json({ conversations });
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

/**
 * GET /api/chat/:otherUserId/messages
 * Lấy lịch sử tin nhắn với một user khác (phân trang).
 */
async function getMessages(req, res) {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);

    // Kiểm tra user kia có tồn tại không
    const otherUser = await User.findById(otherUserId).select(
      "fullName avatar role status"
    );
    if (!otherUser || otherUser.status !== "Active") {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }

    const roomId = buildRoomId(userId, otherUserId);

    const total = await Message.countDocuments({ roomId });
    const messages = await Message.find({ roomId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sender", "fullName avatar role");

    // Đảo lại để hiển thị từ cũ → mới
    messages.reverse();

    // Đánh dấu đã đọc
    await Message.updateMany(
      { roomId, sender: otherUserId, read: false },
      { read: true }
    );

    res.json({
      messages,
      otherUser,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

/**
 * POST /api/chat/:otherUserId/messages
 * Gửi tin nhắn (dùng cho REST fallback – Socket.IO là kênh chính).
 */
async function sendMessage(req, res) {
  try {
    const senderId = req.user._id;
    const senderRole = req.user.role;
    const { otherUserId } = req.params;
    const { content } = req.body;

    // Validation nội dung
    const validation = validateMessageContent(content);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
    }

    const otherUser = await User.findById(otherUserId).select("role status");
    if (!otherUser || otherUser.status !== "Active") {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }

    // Xác định ai là traveler, ai là local
    let travelerId, localId;
    if (senderRole === "traveler") {
      if (otherUser.role !== "local") {
        return res
          .status(400)
          .json({ message: "Bạn chỉ có thể chat với Local Buddy." });
      }
      travelerId = senderId;
      localId = otherUserId;
    } else if (senderRole === "local") {
      if (otherUser.role !== "traveler") {
        return res
          .status(400)
          .json({ message: "Bạn chỉ có thể chat với Traveler." });
      }
      travelerId = otherUserId;
      localId = senderId;
    } else {
      return res
        .status(403)
        .json({ message: "Admin không sử dụng tính năng chat này." });
    }

    const roomId = buildRoomId(travelerId, localId);

    const message = await Message.create({
      roomId,
      sender: senderId,
      traveler: travelerId,
      local: localId,
      content: content.trim(),
    });

    await message.populate("sender", "fullName avatar role");

    res.status(201).json({ message });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

/**
 * PATCH /api/chat/:otherUserId/read
 * Đánh dấu tất cả tin nhắn từ user kia là đã đọc.
 */
async function markRead(req, res) {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    const roomId = buildRoomId(userId, otherUserId);

    await Message.updateMany(
      { roomId, sender: otherUserId, read: false },
      { read: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("markRead error:", err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

module.exports = { getConversations, getMessages, sendMessage, markRead };

