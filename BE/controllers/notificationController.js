const mongoose = require("mongoose");
const Notification = require("../models/Notification");

function visibleNotificationsFilter(user) {
  return {
    recipient: user._id,
    ...(user.role === "admin" ? { type: "first_login" } : {}),
  };
}

exports.listMine = async (req, res) => {
  try {
    const requestedPage = Number(req.query.page || 1);
    if (!Number.isInteger(requestedPage) || requestedPage < 1) {
      return res.status(400).json({ message: "Số trang thông báo không hợp lệ." });
    }
    const filter = visibleNotificationsFilter(req.user);
    const totalCount = await Notification.countDocuments(filter);
    const pageCount = Math.max(1, Math.ceil(totalCount / 10));
    const page = Math.min(requestedPage, pageCount);
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * 10)
      .limit(10);
    res.json({
      notifications,
      page,
      pageCount,
      totalCount,
      unreadCount: await Notification.countDocuments({
        ...filter,
        readAt: null,
      }),
    });
  } catch (error) {
    console.error("Load notifications error:", error);
    res.status(500).json({ message: "Không thể tải thông báo." });
  }
};

exports.markRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Mã thông báo không hợp lệ." });
  }
  const notification = await Notification.findOneAndUpdate(
    { ...visibleNotificationsFilter(req.user), _id: req.params.id, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!notification) {
    const existing = await Notification.findOne({
      ...visibleNotificationsFilter(req.user),
      _id: req.params.id,
    });
    return existing
      ? res.json(existing)
      : res.status(404).json({ message: "Không tìm thấy thông báo." });
  }
  res.json(notification);
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { ...visibleNotificationsFilter(req.user), readAt: null },
      { $set: { readAt: new Date() } },
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ message: "Không thể cập nhật thông báo." });
  }
};
