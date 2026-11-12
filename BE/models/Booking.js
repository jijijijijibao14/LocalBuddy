
const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    buddy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuddyProfile",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },

    // Giữ trường cũ để tương thích code hiện tại.
    time: {
      type: String,
      required: true,
    },

    // Các trường giờ mới dùng cho đặt lịch chính xác.
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    durationHours: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    guestCount: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 1,
    },
    language: {
      type: String,
      default: "Tiếng Việt",
      maxlength: 100,
    },
    foodBudget: {
      type: Number,
      default: 0,
      min: 0,
    },
    experienceBudget: { type: Number, default: 0, min: 0 },

    message: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Completed", "Cancelled"],
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Paid", "RefundPending", "PartiallyRefunded", "Refunded"],
      default: "Unpaid",
    },
    paymentMethod: {
      type: String,
      enum: ["Wallet", "PAYOS_QR", "VNPAY_QR", "None"],
      default: "None",
    },
    paidAt: {
      type: Date,
    },
    escrowStatus: {
      type: String,
      enum: ["None", "Processing", "Held", "Released", "Refunded"],
      default: "None",
    },
    cancellationReason: { type: String, default: "", maxlength: 500 },
    refundRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", schema);
