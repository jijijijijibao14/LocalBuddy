const mongoose = require("mongoose");

const uploadedFileSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
}, { timestamps: true });

module.exports = mongoose.model("UploadedFile", uploadedFileSchema);
