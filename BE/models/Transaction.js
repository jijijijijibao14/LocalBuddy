const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    type: {
      type: String,
      enum: ["TopUp", "Booking", "Refund"],
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Failed"],
      default: "Pending",
    },
    description: { type: String, default: "" },
    orderId: { type: String, unique: true, sparse: true },
    paymentMethod: { type: String, default: "VNPAY" },
    vnpTransactionNo: { type: String, default: "" },
    vnpBankCode: { type: String, default: "" },
    vnpPayDate: { type: String, default: "" },
    vnpResponseCode: { type: String, default: "" },
  },
  { timestamps: true },
);
module.exports = mongoose.model("Transaction", schema);
