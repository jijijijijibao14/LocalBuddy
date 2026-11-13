const Notification = require("../models/Notification");
const User = require("../models/User");
const mongoose = require("mongoose");

async function notifyUser(recipient, notification) {
  try {
    if (!recipient || !global.io || mongoose.connection.readyState !== 1) return;
    const created = await Notification.create({ recipient, ...notification });
    global.io?.to(String(recipient)).emit("new_notification", created);
  } catch (error) {
    console.error("Create notification error:", error);
  }
}

async function notifyRole(role, notification) {
  try {
    if (role === "admin" && notification.type !== "first_login") return;
    if (!global.io || mongoose.connection.readyState !== 1) return;
    const users = await User.find({ role }).select("_id");
    if (users.length) {
      const created = await Notification.insertMany(
        users.map((user) => ({ recipient: user._id, ...notification })),
      );
      for (const item of created) {
        global.io?.to(String(item.recipient)).emit("new_notification", item);
      }
    }
  } catch (error) {
    console.error(`Create ${role} notifications error:`, error);
  }
}

async function notifyBookingStatus(booking, status, actorRole) {
  if (!global.io || mongoose.connection.readyState !== 1) return;
  const populated = await booking.populate([
    { path: "customer", select: "_id fullName" },
    { path: "buddy", select: "user fullName" },
  ]);
  const labels = {
    Confirmed: "được xác nhận",
    Cancelled: "bị hủy",
    Completed: "đã hoàn thành",
  };
  const label = labels[status];
  if (!label) return;
  const actor = actorRole === "admin" ? "Admin" : actorRole === "local" ? "Local" : "Traveler";
  await notifyUser(populated.customer?._id, {
    title: `Yêu cầu ${label}`,
    message: `Yêu cầu trải nghiệm với ${populated.buddy?.fullName || "Local"} ${label}.`,
    link: "/dashboard",
    type: `booking_${status.toLowerCase()}`,
    booking: booking._id,
  });
  if (populated.buddy?.user) {
    await notifyUser(populated.buddy.user, {
      title: `Yêu cầu ${label}`,
      message: `Yêu cầu trải nghiệm của ${populated.customer?.fullName || "Traveler"} ${label}.`,
      link: "/local-dashboard",
      type: `booking_${status.toLowerCase()}`,
      booking: booking._id,
    });
  }
  await notifyRole("admin", {
    title: `Yêu cầu ${label}`,
    message: `Yêu cầu trải nghiệm ${booking._id} ${label} bởi ${actor}.`,
    link: "/admin",
    type: `booking_${status.toLowerCase()}`,
    booking: booking._id,
  });
  if (status === "Completed") {
    await notifyRole("admin", {
      title: "Số dư ví hệ thống và ví Admin thay đổi",
      message: `Chuyến ${booking._id} hoàn thành: hoa hồng đã vào ví Admin, phần thu nhập Local chờ tất toán.`,
      link: "/wallet",
      type: "wallet_changed",
      booking: booking._id,
    });
  }
}

module.exports = { notifyUser, notifyRole, notifyBookingStatus };
