const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
function makeToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}
function safeUser(user) {
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    kycStatus: user.kycStatus,
    walletBalance: user.walletBalance,
    bio: user.bio || "",
    city: user.city || "",
    languages: user.languages || [],
    interests: user.interests || [],
    avatar: user.avatar || "",
    profileComplete: Boolean(user.profileComplete),
    createdAt: user.createdAt,
  };
}
exports.register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      phone = "",
      role = "traveler",
    } = req.body;
    if (!fullName?.trim() || !email || !password)
      return res
        .status(400)
        .json({ message: "Vui lòng nhập họ tên, email và mật khẩu." });
    if (!["traveler", "local"].includes(role))
      return res.status(400).json({
        message:
          "Vai trò đăng ký không hợp lệ. Chỉ được chọn Traveler hoặc Local.",
      });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: "Email không hợp lệ." });
    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "Mật khẩu cần có ít nhất 8 ký tự." });
    if (phone && !/^0\d{9}$/.test(phone))
      return res.status(400).json({
        message: "Số điện thoại cần gồm 10 chữ số và bắt đầu bằng 0.",
      });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ message: "Email đã được sử dụng." });
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName: fullName.trim(),
      email: email.toLowerCase(),
      password: hash,
      phone,
      role,
      status: "Active",
    });
    res.status(201).json({
      message: "Đăng ký thành công. Bạn có thể đăng nhập.",
      user: safeUser(user),
    });
  } catch (e) {
    res.status(500).json({
      message: "Không thể tạo tài khoản.",
      detail: process.env.NODE_ENV === "development" ? e.message : undefined,
    });
  }
};
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Vui lòng nhập email và mật khẩu." });
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không chính xác." });
    if (user.status !== "Active")
      return res
        .status(403)
        .json({ message: `Tài khoản đang ở trạng thái: ${user.status}.` });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ message: "Đăng nhập thất bại." });
  }
};
exports.me = async (req, res) => res.json(safeUser(req.user));
