const User = require("../models/User");
const BuddyProfile = require("../models/BuddyProfile");
const Booking = require("../models/Booking");
const Transaction = require("../models/Transaction");
const { releaseBookingFunds } = require("../utils/walletLedger");
const { bookingEndInstant } = require("../utils/bookingExpiry");
const { notifyBookingStatus } = require("../utils/notifications");
const refundController = require("./refundController");

exports.stats = async (req, res) => {
  const [users, buddies, bookings, transactions] = await Promise.all([
    User.countDocuments(),
    BuddyProfile.countDocuments(),
    Booking.countDocuments(),
    Transaction.countDocuments(),
  ]);
  res.json({ users, buddies, bookings, transactions });
};

exports.users = async (req, res) =>
  res.json(
    await User.find({ role: { $in: ["local", "traveler"] } })
      .select("-password")
      .sort({ createdAt: -1 }),
  );

exports.updateUser = async (req, res) => {
  const allowed = ["Active", "Suspended"];
  if (!allowed.includes(req.body.status))
    return res.status(400).json({ message: "Trạng thái không hợp lệ." });
  if (String(req.user._id) === req.params.id && req.body.status !== "Active") {
    return res
      .status(400)
      .json({ message: "Không thể tự khóa tài khoản Admin đang sử dụng." });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true },
  ).select("-password");
  if (!user)
    return res.status(404).json({ message: "Không tìm thấy tài khoản." });
  if (user.role === "local") {
    await BuddyProfile.findOneAndUpdate(
      { user: user._id },
      { active: user.status === "Active" },
    );
  }
  res.json(user);
};

exports.buddies = async (req, res) => {
  // Tạo hồ sơ công khai cho các tài khoản Local cũ chưa được đồng bộ.
  const locals = await User.find({ role: "local" });
  const interestMap = {
    "Ẩm thực": "Ẩm thực",
    "ẩm thực": "Ẩm thực",
    Food: "Ẩm thực",
    "Food & Street Food": "Ẩm thực",
    "cà phê": "cà phê",
    "Cà phê": "cà phê",
    "Coffee & Chill": "cà phê",
    "du lịch": "du lịch",
    "Du lịch": "du lịch",
    "Travel & Danh Lam": "du lịch",
  };
  for (const user of locals) {
    const interests = [
      ...new Set(
        (user.interests || [])
          .map((value) => interestMap[String(value).trim()])
          .filter(Boolean),
      ),
    ];
    await BuddyProfile.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          fullName: user.fullName,
          area: `${(user.areas?.length ? user.areas : [user.city].filter(Boolean)).join(", ") || "Đà Nẵng"}`,
          areas: user.areas?.length ? user.areas : [user.city].filter(Boolean),
          bio: user.bio || "",
          photos: user.profilePhotos || [],
          coverImage:
            user.avatar ||
            "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=80",
          languages: user.languages?.length ? user.languages : ["Tiếng Việt"],
          active: user.status === "Active",
          ...(user.interests?.length
            ? { interests, categories: interests }
            : {}),
        },
        $setOnInsert: { user: user._id, verified: false, price: 250000 },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  res.json(
    await BuddyProfile.find()
      .populate(
        "user",
        "fullName email phone kycStatus status interests languages city areas bio profilePhotos isPremium",
      )
      .sort({ createdAt: -1 }),
  );
};

exports.updateBuddyVerification = async (req, res) => {
  const { verified } = req.body;
  if (typeof verified !== "boolean")
    return res
      .status(400)
      .json({ message: "Trạng thái xác minh không hợp lệ." });
  const existing = await BuddyProfile.findById(req.params.id).populate(
    "user",
    "role kycStatus",
  );
  if (!existing)
    return res.status(404).json({ message: "Không tìm thấy hồ sơ Buddy." });
  if (verified && (existing.user?.role !== "local" || existing.user.kycStatus !== "Verified")) {
    return res.status(400).json({
      message: "Local phải hoàn thành eKYC trước khi Admin xác minh hồ sơ.",
      kycStatus: existing.user?.kycStatus || "Not Started",
    });
  }
  const buddy = await BuddyProfile.findByIdAndUpdate(
    req.params.id,
    { verified },
    { new: true },
  ).populate("user", "fullName email phone kycStatus status");
  if (!buddy)
    return res.status(404).json({ message: "Không tìm thấy hồ sơ Buddy." });
  res.json(buddy);
};

exports.updateLocalPremium = async (req, res) => {
  if (typeof req.body.isPremium !== "boolean")
    return res.status(400).json({ message: "Trạng thái Premium không hợp lệ." });
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, role: "local" },
    { $set: { isPremium: req.body.isPremium } },
    { new: true },
  ).select("-password");
  if (!user)
    return res.status(404).json({ message: "Không tìm thấy tài khoản Local." });
  res.json(user);
};

exports.bookings = async (req, res) =>
  res.json(
    await Booking.find()
      .populate("customer", "fullName email phone")
      .populate("buddy", "fullName area user")
      .populate("feedback.author", "fullName")
      .populate("feedback.repliedBy", "fullName")
      .sort({ createdAt: -1 })
      .limit(200),
  );

exports.updateBooking = async (req, res) => {
  const allowed = ["Confirmed", "Completed", "Cancelled"];
  if (!allowed.includes(req.body.status))
    return res.status(400).json({ message: "Trạng thái không hợp lệ." });
  const current = await Booking.findById(req.params.id);
  if (!current)
    return res
      .status(404)
      .json({ message: "Không tìm thấy yêu cầu đặt lịch." });
  if (req.body.status === "Confirmed") {
    if (current.status !== "Pending") {
      return res.status(400).json({ message: "Chỉ xác nhận yêu cầu đang chờ." });
    }
    if (current.paymentStatus !== "Paid") {
      return res.status(400).json({
        message: "Traveler cần thanh toán trước khi xác nhận yêu cầu.",
      });
    }
    if (current.escrowStatus !== "Held") {
      return res.status(400).json({
        message: "Tiền đặt lịch chưa được giữ hợp lệ. Vui lòng đối soát giao dịch trước khi xác nhận.",
      });
    }
    const endInstant = bookingEndInstant(current);
    if (!endInstant || endInstant <= new Date()) {
      return res.status(400).json({ message: "Không thể xác nhận lịch đã hết thời gian trải nghiệm." });
    }
    const conflict = await Booking.findOne({
      _id: { $ne: current._id },
      buddy: current.buddy,
      date: current.date,
      time: current.time,
      status: "Confirmed",
    });
    if (conflict)
      return res.status(409).json({
        message: "Buddy đã có lịch được xác nhận trong khung giờ này.",
      });
    const buddy = await BuddyProfile.findById(current.buddy);
    if (!buddy || !buddy.verified || !buddy.active) {
      return res.status(400).json({
        message: "Chỉ xác nhận lịch của Buddy đang hoạt động và đã xác minh.",
      });
    }
  }
  if (req.body.status === "Completed" && current.status !== "Confirmed") {
    return res.status(400).json({ message: "Chỉ hoàn thành yêu cầu đã được xác nhận." });
  }
  if (req.body.status === "Completed" && current.paymentStatus !== "Paid") {
    return res.status(400).json({
      message: "Chỉ quyết toán yêu cầu đã được thanh toán.",
    });
  }
  if (req.body.status === "Completed" && current.escrowStatus !== "Held") {
    return res.status(400).json({
      message: "Tiền đặt lịch chưa được giữ hợp lệ. Vui lòng đối soát giao dịch trước khi quyết toán.",
    });
  }
  if (req.body.status === "Cancelled" && !["Pending", "Confirmed"].includes(current.status)) {
    return res.status(400).json({ message: "Không thể hủy yêu cầu ở trạng thái này." });
  }
  if (req.body.status === "Cancelled") {
    const result = await refundController.cancelByLocalOrAdmin(
      current,
      req.user,
      req.body.reason || "Hủy lịch bởi Admin",
    );
    if (result.error) {
      return res.status(409).json({ message: result.error });
    }
    const updated = await Booking.findById(current._id);
    await updated.populate([
      { path: "customer", select: "fullName email phone" },
      { path: "buddy", select: "fullName area" },
    ]);
    return res.json(updated);
  }
  const previousStatus = current.status;
  const claimed = await Booking.findOneAndUpdate(
    {
      _id: current._id,
      status: previousStatus,
      paymentStatus: "Paid",
      escrowStatus: "Held",
    },
    { $set: { status: req.body.status } },
    { new: true },
  );
  if (!claimed) {
    return res.status(409).json({ message: "Yêu cầu đã được xử lý hoặc không còn tồn tại." });
  }
  try {
    if (req.body.status === "Completed") {
      if (claimed.escrowStatus !== "Held" || !(await releaseBookingFunds(claimed))) {
        throw new Error("Không thể quyết toán tiền đặt lịch.");
      }
    }
  } catch (error) {
    await Booking.updateOne(
      { _id: current._id, status: req.body.status },
      { $set: { status: previousStatus } },
    );
    console.error("Settle admin booking funds error:", error);
    return res.status(500).json({
      message: "Không thể hoàn tiền hoặc quyết toán ví cho yêu cầu này.",
    });
  }
  const updated = await Booking.findById(current._id);
  await notifyBookingStatus(updated, req.body.status, "admin");
  await updated.populate([
    { path: "customer", select: "fullName email phone" },
    { path: "buddy", select: "fullName area" },
  ]);
  res.json(updated);
};
