require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const BuddyProfile = require("../models/BuddyProfile");
const connectDB = require("../config/db");
const demo = [
  {
    fullName: "Nguyễn Hoàng Nam",
    email: "nam.buddy@localbuddy.vn",
    area: "Sơn Trà, Đà Nẵng",
    rating: 4.9,
    price: 250000,
    coverImage:
      "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=80",
    bio: "Người bản địa yêu du lịch, thích chia sẻ những góc biển và quán cà phê đẹp.",
    categories: ["du lịch", "cà phê"],
    interests: ["du lịch", "cà phê"],
    languages: ["Tiếng Việt", "English (Fluent)"],
  },
  {
    fullName: "Trần Lê Thảo My",
    email: "my.buddy@localbuddy.vn",
    area: "Hải Châu, Đà Nẵng",
    rating: 5,
    price: 200000,
    coverImage:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80",
    bio: "Khám phá ẩm thực đường phố, chợ địa phương và những câu chuyện văn hóa.",
    categories: ["Ẩm thực", "cà phê"],
    interests: ["Ẩm thực", "cà phê"],
    languages: ["Tiếng Việt", "English"],
  },
  {
    fullName: "Lê Quốc Bảo",
    email: "bao.buddy@localbuddy.vn",
    area: "Ngũ Hành Sơn, Đà Nẵng",
    rating: 4.85,
    price: 350000,
    coverImage:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    bio: "Đam mê thiên nhiên, cung đường ven biển và những địa điểm ít người biết.",
    categories: ["du lịch"],
    interests: ["du lịch"],
    languages: ["Tiếng Việt"],
  },
  {
    fullName: "Đặng Thùy Dung",
    email: "dung.buddy@localbuddy.vn",
    area: "Thanh Khê, Đà Nẵng",
    rating: 4.95,
    price: 280000,
    coverImage:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=80",
    bio: "Một người bạn địa phương thân thiện, thích chụp ảnh và kể chuyện Đà Nẵng.",
    categories: ["cà phê", "du lịch"],
    interests: ["cà phê", "du lịch"],
    languages: ["Tiếng Việt", "English"],
  },
];
async function seed() {
  try {
    await connectDB();
    await User.updateMany({ role: "Customer" }, { $set: { role: "traveler" } });
    await User.updateMany({ role: "Buddy" }, { $set: { role: "local" } });
    await User.updateMany({ role: "Admin" }, { $set: { role: "admin" } });
    const adminEmail = (
      process.env.ADMIN_EMAIL || "admin@localbuddy.vn"
    ).toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD || "Admin@12345";
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        fullName: process.env.ADMIN_NAME || "Local Buddy Admin",
        email: adminEmail,
        password: await bcrypt.hash(adminPass, 12),
        role: "admin",
        status: "Active",
      });
      console.log("Created Admin:", adminEmail);
    } else {
      admin.role = "admin";
      admin.status = "Active";
      await admin.save();
      console.log("Admin ready:", adminEmail);
    }
    for (const d of demo) {
      let user = await User.findOne({ email: d.email });
      if (!user)
        user = await User.create({
          fullName: d.fullName,
          email: d.email,
          password: await bcrypt.hash("Buddy@12345", 12),
          role: "local",
          status: "Active",
          kycStatus: "Verified",
        });
      else if (user.role !== "local") {
        user.role = "local";
        user.status = "Active";
        await user.save();
      }
      await BuddyProfile.findOneAndUpdate(
        { user: user._id },
        { ...d, user: user._id, verified: true, active: true },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    console.log("Demo Local Buddy profiles are ready.");
    console.log("Demo Buddy password: Buddy@12345 (demo accounts only)");
    console.log("Admin login:", adminEmail, " / password from server/.env");
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}
seed();
