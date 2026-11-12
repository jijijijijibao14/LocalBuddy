const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    refundId: { type: mongoose.Schema.Types.ObjectId, ref: "Refund" },
    type: {
      type: String,
      enum: ["TopUp", "Booking", "Refund", "Escrow", "Earning", "Commission", "Withdrawal"],
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Held", "Completed", "Failed", "Refunded"],
      default: "Pending",
    },
    walletOwner: {
      type: String,
      enum: ["User", "System", "Admin"],
      default: "User",
    },
    description: { type: String, default: "" },
    withdrawalDetails: {
      bankName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      accountName: { type: String, default: "" },
    },
    orderId: { type: String, unique: true, sparse: true },
    paymentMethod: { type: String, default: "PAYOS_QR" },
    payosOrderCode: { type: Number, index: true, sparse: true },
    payosPaymentLinkId: { type: String, default: "" },
    payosStatus: { type: String, default: "" },
    vnpTransactionNo: { type: String, default: "" },
    vnpBankCode: { type: String, default: "" },
    vnpPayDate: { type: String, default: "" },
    vnpResponseCode: { type: String, default: "" },
  },
  { timestamps: true },
);
schema.index({ refundId: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model("Transaction", schema);
