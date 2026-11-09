const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "primary" },
    systemBalance: { type: Number, min: 0, default: 0 },
    adminBalance: { type: Number, min: 0, default: 0 },
    standardCommissionPercent: { type: Number, min: 0, max: 100, default: 10 },
    premiumCommissionPercent: { type: Number, min: 0, max: 100, default: 5 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("WalletSettings", schema);
