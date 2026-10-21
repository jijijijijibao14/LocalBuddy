const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME || "Local Buddy Admin";

  if (!email || !password) {
    throw new Error("Thiếu ADMIN_EMAIL hoặc ADMIN_PASSWORD trong file .env");
  }

  // Tìm tài khoản theo email
  let admin = await User.findOne({ email }).select("+password");

  if (admin) {
    // Nếu đã tồn tại, cập nhật tài khoản thành Admin
    admin.fullName = fullName;
    admin.role = "admin";
    admin.status = "Active";
    admin.password = await bcrypt.hash(password, 12);

    await admin.save();
    console.log(`Đã cập nhật tài khoản Admin: ${email}`);
  } else {
    // Nếu chưa tồn tại, tạo tài khoản Admin mới
    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: "admin",
      status: "Active",
      kycStatus: "Verified",
    });

    console.log(`Đã tạo tài khoản Admin: ${email}`);
  }
}

module.exports = seedAdmin;
