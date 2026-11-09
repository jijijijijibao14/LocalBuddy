const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // Phòng chat được xác định bởi cặp (travelerId, localId) - sắp xếp theo alphabet để unique
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // traveler hoặc local trong phòng chat này
    traveler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    local: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true,
    },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    edited: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index để lấy tin nhắn của một phòng theo thứ tự thời gian
messageSchema.index({ roomId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
