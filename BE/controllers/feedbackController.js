const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BuddyProfile = require("../models/BuddyProfile");
const { notifyUser } = require("../utils/notifications");

async function getParticipantBooking(req) {
  if (!mongoose.isValidObjectId(req.params.id) || !["local", "traveler"].includes(req.user.role)) {
    return null;
  }
  const query = { _id: req.params.id, status: "Completed" };
  if (req.user.role === "traveler") query.customer = req.user._id;
  else {
    const profile = await BuddyProfile.findOne({ user: req.user._id }).select("_id");
    if (!profile) return null;
    query.buddy = profile._id;
  }
  return Booking.findOne(query).populate("buddy", "user");
}

exports.saveFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const score = Number(rating);
    const text = typeof comment === "string" ? comment.trim() : "";
    if (!Number.isInteger(score) || score < 1 || score > 5 || !text || text.length > 1000) {
      return res.status(400).json({ message: "Vui lòng chọn 1–5 sao và nhập nhận xét tối đa 1000 ký tự." });
    }
    const booking = await getParticipantBooking(req);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy chuyến đã hoàn thành của bạn." });
    const role = req.user.role;
    const existing = booking.feedback.find((item) => item.authorRole === role);
    const wasCreated = !existing;
    if (existing) {
      existing.rating = score;
      existing.comment = text;
      existing.author = req.user._id;
    } else {
      booking.feedback.push({ author: req.user._id, authorRole: role, rating: score, comment: text });
    }
    await booking.save();
    const recipient = role === "traveler" ? booking.buddy?.user : booking.customer;
    if (wasCreated) {
      await notifyUser(recipient, {
        title: "Bạn vừa nhận được feedback",
        message: `${req.user.fullName} đã gửi feedback về chuyến đi.`,
        link: role === "traveler" ? "/local-dashboard" : "/dashboard",
        type: "feedback_created",
        booking: booking._id,
      });
    }
    res.json({ feedback: booking.feedback });
  } catch (error) {
    console.error("Save booking feedback error:", error);
    res.status(500).json({ message: "Không thể lưu feedback." });
  }
};

exports.saveReply = async (req, res) => {
  try {
    const text = typeof req.body.reply === "string" ? req.body.reply.trim() : "";
    if (!mongoose.isValidObjectId(req.params.feedbackId) || !text || text.length > 1000) {
      return res.status(400).json({ message: "Nội dung trả lời không hợp lệ (tối đa 1000 ký tự)." });
    }
    const booking = await getParticipantBooking(req);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy chuyến đã hoàn thành của bạn." });
    const feedback = booking.feedback.id(req.params.feedbackId);
    if (!feedback || feedback.authorRole === req.user.role) {
      return res.status(404).json({ message: "Không tìm thấy feedback cần trả lời." });
    }
    const wasCreated = !feedback.reply;
    feedback.reply = text;
    feedback.repliedBy = req.user._id;
    feedback.repliedAt = new Date();
    await booking.save();
    if (wasCreated) {
      await notifyUser(feedback.author, {
        title: "Feedback của bạn đã được phản hồi",
        message: `${req.user.fullName} đã trả lời feedback của bạn.`,
        link: feedback.authorRole === "traveler" ? "/dashboard" : "/local-dashboard",
        type: "feedback_reply",
        booking: booking._id,
      });
    }
    res.json({ feedback: booking.feedback });
  } catch (error) {
    console.error("Save feedback reply error:", error);
    res.status(500).json({ message: "Không thể lưu phản hồi feedback." });
  }
};
