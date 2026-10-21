const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: { 
      type: String, 
      required: true, 
      trim: true, 
      maxlength: 100 
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { 
      type: String, 
      required: true, 
      select: false 
    },
    phone: { 
      type: String, 
      default: "" 
    },
    bio: { 
      type: String, 
      default: "" 
    },
    // Với Local, city lưu khu vực hoạt động tại Đà Nẵng.
    city: { 
      type: String, 
      default: 
      "Sơn Trà" 
    },
    languages: { 
      type: [String], 
      default: [] 
    },
    languageCertificates: {
      type: [
        {
          language: { type: String, required: true },
          certificateUrl: { type: String, default: "" },
        },
      ],
      default: [],
    },
    interests: { 
      type: [String], 
      default: [] 
    },
    avatar: { 
      type: String, 
      default: "" 
    },
    pricePerHour: { 
      type: Number, 
      default: 100000, 
      min: 0 
    },
    profileComplete: { 
      type: Boolean, 
      default: false 
    },
    role: {
      type: String,
      enum: ["traveler", "local", "admin"],
      default: "traveler",
    },
    status: {
      type: String,
      enum: ["Active", "Pending Approval", "Rejected", "Suspended"],
      default: "Active",
    },
    kycStatus: {
      type: String,
      enum: ["Not Started", "Pending", "Verified", "Rejected"],
      default: "Not Started",
    },
    walletBalance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
