const mongoose = require("mongoose");

const premiumSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    packageId: {
      type: String,
      required: true,
      trim: true,
    },
    packageName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Active", "Expired", "Cancelled", "Failed"],
      default: "Pending",
      index: true,
    },
    orderCode: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
    },
    paymentLinkId: {
      type: String,
      default: "",
    },
    paymentMethod: {
      type: String,
      default: "PAYOS_QR",
    },
    qrCodeUrl: {
      type: String,
      default: "",
    },
    checkoutUrl: {
      type: String,
      default: "",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    benefits: {
      type: [String],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

premiumSubscriptionSchema.index({ user: 1, status: 1 });
premiumSubscriptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PremiumSubscription", premiumSubscriptionSchema);

