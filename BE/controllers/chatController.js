const Message = require("../models/Message");
const User = require("../models/User");
const { buildRoomId, validateMessageContent } = require("../utils/chatUtils");

function mayChat(role, otherRole) {
  return role === "admin"
    ? otherRole !== "admin"
    : otherRole === "admin" ||
      (role === "traveler" && otherRole === "local") ||
      (role === "local" && otherRole === "traveler");
}

/**
 * GET /api/chat/conversations
 * Lấy danh sách các cuộc hội thoại của user đang đăng nhập (kèm tin nhắn cuối).
 */
async function getConversations(req, res) {
  try {
    const userId = req.user._id;

    // Lấy tất cả tin nhắn có liên quan đến user hiện tại
    const messages = await Message.find({
      $or: [{ participants: userId }, { traveler: userId }, { local: userId }],
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
        deleted: msg.deleted,
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

async function getSupportContact(req, res) {
  const admin = await User.findOne({ role: "admin", status: "Active" }).select(
    "fullName avatar role",
  );
  if (!admin) return res.status(503).json({ message: "Chưa có Admin hỗ trợ." });
  res.json({ user: admin });
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
    if (!mayChat(req.user.role, otherUser.role)) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập cuộc trò chuyện này." });
    }

    const roomId = buildRoomId(userId, otherUserId);

    const total = await Message.countDocuments({ roomId });
    const messages = await Message.find({ roomId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sender", "fullName avatar role")
      .populate({
        path: "replyTo",
        select: "content deleted sender createdAt",
        populate: { path: "sender", select: "fullName role" },
      });

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
    const { content, replyTo } = req.body;

    // Validation nội dung
    const validation = validateMessageContent(content);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
    }

    const otherUser = await User.findById(otherUserId).select("role status");
    if (!otherUser || otherUser.status !== "Active") {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }

    if (!mayChat(senderRole, otherUser.role)) {
      return res.status(403).json({ message: "Bạn không thể chat với tài khoản này." });
    }

    // Keep the legacy traveler/local fields populated for existing conversations.
    let travelerId, localId;
    if (senderRole === "admin" || otherUser.role === "admin") {
      travelerId = senderRole === "admin" ? otherUserId : senderId;
      localId = senderRole === "admin" ? senderId : otherUserId;
    } else if (senderRole === "traveler") {
      travelerId = senderId;
      localId = otherUserId;
    } else if (senderRole === "local") {
      travelerId = otherUserId;
      localId = senderId;
    }

    const roomId = buildRoomId(travelerId, localId);
    if (replyTo) {
      const parent = await Message.findOne({ _id: replyTo, roomId }).select("_id");
      if (!parent) {
        return res.status(400).json({ message: "Tin nhắn được trả lời không thuộc cuộc trò chuyện này." });
      }
    }

    const message = await Message.create({
      roomId,
      sender: senderId,
      traveler: travelerId,
      local: localId,
      participants: [travelerId, localId],
      replyTo: replyTo || null,
      content: content.trim(),
    });
    await message.populate([
      { path: "sender", select: "fullName avatar role" },
      {
        path: "replyTo",
        select: "content deleted sender createdAt",
        populate: { path: "sender", select: "fullName role" },
      },
    ]);

    res.status(201).json({ message });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

async function updateMessage(req, res) {
  const validation = validateMessageContent(req.body.content);
  if (!validation.valid) return res.status(400).json({ message: validation.reason });
  const message = await Message.findOneAndUpdate(
    { _id: req.params.messageId, sender: req.user._id, deleted: false },
    { $set: { content: req.body.content.trim(), edited: true } },
    { new: true },
  ).populate("sender", "fullName avatar role");
  if (!message) return res.status(404).json({ message: "Không tìm thấy tin nhắn của bạn." });
  req.app.get("io")?.to(message.roomId).emit("message_updated", message);
  res.json({ message });
}

async function deleteMessage(req, res) {
  const message = await Message.findOneAndUpdate(
    { _id: req.params.messageId, sender: req.user._id, deleted: false },
    { $set: { content: "", deleted: true } },
    { new: true },
  );
  if (!message) return res.status(404).json({ message: "Không tìm thấy tin nhắn của bạn." });
  req.app.get("io")?.to(message.roomId).emit("message_deleted", {
    _id: message._id,
    roomId: message.roomId,
  });
  res.json({ message });
}

/**
 * PATCH /api/chat/:otherUserId/read
 * Đánh dấu tất cả tin nhắn từ user kia là đã đọc.
 */
async function markRead(req, res) {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    const otherUser = await User.findById(otherUserId).select("role status");
    if (!otherUser || otherUser.status !== "Active") {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }
    if (!mayChat(req.user.role, otherUser.role)) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập cuộc trò chuyện này." });
    }
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

module.exports = {
  getConversations,
  getSupportContact,
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  markRead,
};
