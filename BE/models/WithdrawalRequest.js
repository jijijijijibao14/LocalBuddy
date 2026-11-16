const mongoose = require("mongoose");

const withdrawalHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    note: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const withdrawalRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userRole: {
      type: String,
      enum: ["traveler", "local", "admin"],
      default: "traveler",
    },
    amount: {
      type: Number,
      required: true,
      min: [1000, "Số tiền rút tối thiểu là 1,000 VND"],
    },
    bankName: {
      type: String,
      required: [true, "Tên ngân hàng là bắt buộc"],
      trim: true,
    },
    bankCode: {
      type: String,
      default: "",
      trim: true,
    },
    accountNumber: {
      type: String,
      required: [true, "Số tài khoản là bắt buộc"],
      trim: true,
    },
    accountName: {
      type: String,
      required: [true, "Tên chủ tài khoản là bắt buộc"],
      trim: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Completed", "Rejected", "Cancelled"],
      default: "Pending",
      index: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    bankTransactionCode: {
      type: String,
      default: "",
      trim: true,
    },
    transferDate: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },
    history: {
      type: [withdrawalHistorySchema],
      default: [],
    },
  },
  { timestamps: true },
);

withdrawalRequestSchema.index({ createdAt: -1 });
withdrawalRequestSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);

