const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    fullName: { 
      type: String, 
      required: true, 
      trim: true 
    },
    area: { 
      type: String, 
      default: "Sơn Trà, Đà Nẵng" 
    },
    bio: { 
      type: String, 
      default: "" 
    },
    coverImage: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=80",
    },
    rating: { 
      type: Number, 
      default: 5, 
      min: 0, 
      max: 5 
    },
    price: { 
      type: Number, 
      default: 250000, 
      min: 0 },
    pricePerHour: { 
      type: Number, 
      default: 100000, 
      min: 0 
    },
    languageCertificates: {
      type: [{ language: String, certificateUrl: String }],
      default: [],
    },
    categories: { 
      type: [String], 
      default: [] 
    },
    interests: {
      type: [{ 
        type: String, 
        enum: ["Ẩm thực", "cà phê", "du lịch"] }],
      default: [],
    },
    languages: { 
      type: [String], 
      default: ["Tiếng Việt"] 
    },   
    verified: { 
      type: Boolean, 
      default: false 
    },
    
  active: {
    type: Boolean,
    default: true
  },

  // Các ngày và khung giờ Local có thể nhận khách.
  availability: {
    type: [
      {
        date: {
          type: String,
          required: true,
        },
        startTime: {
          type: String,
          required: true,
        },
        endTime: {
          type: String,
          required: true,
        },
      },
    ],
    default: [],
  },

  },
  { timestamps: true },
);

module.exports = mongoose.model("BuddyProfile", schema);
