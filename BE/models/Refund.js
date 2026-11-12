const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "PROCESSING", "REFUNDED", "NO_REFUND", "REJECTED", "FAILED"],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String, default: "" },
    providerRefundId: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedByRole: {
      type: String,
      enum: ["traveler", "local", "admin"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    currency: { type: String, default: "VND" },
    reason: { type: String, required: true, maxlength: 500 },
    paymentMethod: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "PROCESSING", "REFUNDED", "NO_REFUND", "REJECTED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    providerRefundId: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNote: { type: String, default: "" },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

schema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Refund", schema);
