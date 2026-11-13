const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 500 },
    link: { type: String, required: true, maxlength: 300 },
    type: { type: String, required: true, maxlength: 60 },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ recipient: 1, createdAt: -1 });
module.exports = mongoose.model("Notification", schema);
