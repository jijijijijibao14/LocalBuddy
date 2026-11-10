const Booking = require("../models/Booking");
const BuddyProfile = require("../models/BuddyProfile");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { availabilityInstant } = require("../utils/availability");
const { bookingEndInstant } = require("../utils/bookingExpiry");
const {
  holdBookingFunds,
  refundBookingFunds,
  releaseBookingFunds,
} = require("../utils/walletLedger");

function toMinutes(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return NaN;
  }

  const [hour, minute] = value.split(":").map(Number);

  if (hour > 23 || minute > 59) return NaN;

  return hour * 60 + minute;
}

function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

exports.create = async (req, res) => {
  try {
    if (req.user.role !== "traveler") {
      return res.status(403).json({
        message: "Chỉ tài khoản Traveler mới được đặt trải nghiệm.",
      });
    }

    const {
      buddyId,
      date,
      startTime,
      endTime,
      durationHours,
      guestCount = 1,
      language = "Tiếng Việt",
      foodBudget = 0,
      experienceBudget = 0,
      message = "",
      paymentMethod = "None",
    } = req.body;

    if (!buddyId || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: "Vui lòng chọn Local, ngày và giờ trải nghiệm.",
      });
    }

    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    const duration = Number(durationHours);
    const guests = Number(guestCount);
    const budget = Number(foodBudget);
    const plannedSpend = Number(experienceBudget);

    if (!["Wallet", "VNPAY_QR"].includes(paymentMethod)) {
      return res.status(400).json({
        message: "Vui lòng thanh toán trước bằng Ví Local Buddy hoặc VNPAY-QR.",
      });
    }

    if (!Number.isInteger(guests) || guests < 1 || guests > 10) {
      return res.status(400).json({
        message: "Số lượng khách phải từ 1 đến 10.",
      });
    }

    if (!Number.isFinite(budget) || budget < 0) {
      return res.status(400).json({
        message: "Ngân sách ăn uống không hợp lệ.",
      });
    }
    if (!Number.isFinite(plannedSpend) || plannedSpend < 0) {
      return res.status(400).json({
        message: "Ngân sách dự kiến không hợp lệ.",
      });
    }

    if (
      typeof language !== "string" ||
      !language.trim() ||
      language.length > 100
    ) {
      return res.status(400).json({
        message: "Ngôn ngữ không hợp lệ.",
      });
    }

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 12 ||
      end <= start ||
      end - start !== duration * 60
    ) {
      return res.status(400).json({
        message: "Giờ bắt đầu, kết thúc và thời lượng không khớp.",
      });
    }

    // Kiểm tra ngày theo định dạng YYYY-MM-DD.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        message: "Ngày trải nghiệm không hợp lệ.",
      });
    }

    const when = new Date(`${date}T00:00:00.000Z`);

    if (
      Number.isNaN(when.getTime()) ||
      when.toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({
        message: "Ngày trải nghiệm không hợp lệ.",
      });
    }

    const todayParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .reduce((parts, part) => {
        if (part.type !== "literal") parts[part.type] = part.value;
        return parts;
      }, {});
    const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;

    if (date < today) {
      return res.status(400).json({
        message: "Không thể đặt trải nghiệm trong quá khứ.",
      });
    }

    const requestedStart = availabilityInstant(date, startTime);
    if (!requestedStart || requestedStart <= new Date()) {
      return res.status(400).json({
        message: "Không thể đặt khung giờ đã bắt đầu hoặc trong quá khứ.",
      });
    }

    const buddy = await BuddyProfile.findOne({
      _id: buddyId,
      active: true,
    });

    if (!buddy) {
      return res.status(404).json({
        message: "Không tìm thấy Local Buddy đang hoạt động.",
      });
    }

    // Kiểm tra Local đã đăng ký đúng khung giờ này chưa.
    const hasAvailability = (buddy.availability || []).some((slot) => {
      return (
        slot.date === date &&
        toMinutes(slot.startTime) <= start &&
        toMinutes(slot.endTime) >= end
      );
    });

    if (!hasAvailability) {
      return res.status(400).json({
        message: "Local không rảnh trong khung giờ bạn đã chọn.",
      });
    }

    // Kiểm tra các booking đang giữ lịch: Pending hoặc Confirmed.
    const existingBookings = await Booking.find({
      buddy: buddy._id,
      date: when,
      status: { $in: ["Pending", "Confirmed"] },
    }).select("startTime endTime");

    const conflict = existingBookings.some((booking) => {
      const oldStart = toMinutes(booking.startTime);
      const oldEnd = toMinutes(booking.endTime);

      return start < oldEnd && end > oldStart;
    });

    if (conflict) {
      return res.status(409).json({
        message: "Khung giờ vừa được người khác đặt. Vui lòng chọn giờ khác.",
      });
    }

    const calculatedPrice = Math.round((buddy.price / 3) * duration);

    const booking = await Booking.create({
      customer: req.user._id,
      buddy: buddy._id,
      date: when,
      startTime,
      endTime,
      durationHours: duration,
      time: `${startTime} - ${endTime}`,
      message: String(message).slice(0, 1000),
      price: calculatedPrice,
      status: "Pending",
      paymentStatus: "Unpaid",
      paymentMethod,
      guestCount: guests,
      language: language.trim(),
      foodBudget: budget,
      experienceBudget: plannedSpend,
    });

    let qrData = null;
    let newBalance;

    if (paymentMethod === "Wallet") {
      const payment = await holdBookingFunds(booking, req.user._id, "Wallet");
      if (!payment.ok) {
        if (payment.alreadyHeld) {
          return res.status(409).json({ message: "Lịch đặt đã được xử lý hoặc không còn chờ thanh toán." });
        }
        await Booking.deleteOne({ _id: booking._id });
        return res.status(400).json({
          message: `Số dư ví không đủ (${payment.currentBalance.toLocaleString("vi-VN")} đ). Cần ${calculatedPrice.toLocaleString("vi-VN")} đ để thanh toán.`,
          insufficient: true,
          required: calculatedPrice,
          currentBalance: payment.currentBalance,
        });
      }
      newBalance = payment.newBalance;
    } else if (paymentMethod === "VNPAY_QR") {
      const orderId = `BK${booking._id.toString().slice(-6)}${Date.now().toString().slice(-4)}`;
      const qrCodeUrl = `https://api.vietqr.io/image/970419-0123456789-compact2.jpg?amount=${calculatedPrice}&addInfo=LOCALBUDDY%20${orderId}&accountName=LOCAL%20BUDDY`;
      await Transaction.create({
        user: req.user._id,
        booking: booking._id,
        type: "Booking",
        amount: calculatedPrice,
        status: "Pending",
        orderId,
        paymentMethod: "VNPAY_QR",
        description: `Thanh toán đặt lịch Local: ${buddy.fullName} (${duration}h) qua VNPAY-QR`,
      });
      qrData = {
        qrCodeUrl,
        orderId,
        amount: calculatedPrice,
        bookingId: booking._id,
      };
    }
    const paymentStatus = booking.paymentStatus;

    const populatedBooking = await booking.populate([
      { path: "buddy", select: "fullName area coverImage price" },
      { path: "customer", select: "fullName email" },
    ]);

    res.status(201).json({
      message:
        paymentStatus === "Paid"
          ? "Đặt lịch và thanh toán bằng ví thành công!"
          : "Đã gửi yêu cầu đến Local.",
      booking: populatedBooking,
      newBalance,
      qrData,
    });
  } catch (error) {
    console.error("Create booking error:", error);

    res.status(500).json({
      message: "Không thể tạo yêu cầu đặt lịch.",
    });
  }
};

exports.mine = async (req, res) => {
  try {
    if (req.user.role !== "traveler") {
      return res.status(403).json({
        message: "Chức năng này dành cho Traveler.",
      });
    }

    const rows = await Booking.find({ customer: req.user._id })
      .populate("buddy", "fullName area coverImage price")
      .sort({ createdAt: -1 });

    res.json(rows);
  } catch (error) {
    console.error("Load traveler bookings error:", error);
    res.status(500).json({
      message: "Không tải được lịch đặt.",
    });
  }
};

// GET /api/bookings/local
// Local chỉ xem yêu cầu gửi đến chính mình.
exports.localMine = async (req, res) => {
  try {
    if (req.user.role !== "local") {
      return res.status(403).json({
        message: "Chức năng này dành cho Local.",
      });
    }

    const profile = await BuddyProfile.findOne({ user: req.user._id });

    if (!profile) {
      return res.json([]);
    }

    const rows = await Booking.find({ buddy: profile._id, paymentStatus: "Paid" })
      .populate("customer", "fullName email")
      .populate("buddy", "fullName area")
      .sort({ createdAt: -1 });

    res.json(rows);
  } catch (error) {
    console.error("Load Local bookings error:", error);
    res.status(500).json({
      message: "Không tải được yêu cầu trải nghiệm.",
    });
  }
};

// PATCH /api/bookings/:id/local-status
// Local chấp nhận hoặc từ chối yêu cầu của chính mình.

exports.updateLocalStatus = async (req, res) => {
  try {
    // 1. Chỉ tài khoản Local mới được xử lý yêu cầu.
    if (req.user.role !== "local") {
      return res.status(403).json({
        message: "Chức năng này dành cho Local.",
      });
    }

    // 2. Kiểm tra trạng thái mà frontend gửi lên.
    const { status } = req.body;

    if (!["Confirmed", "Cancelled", "Completed"].includes(status)) {
      return res.status(400).json({
        message: "Trạng thái không hợp lệ.",
      });
    }

    // 3. Tìm hồ sơ Local đang đăng nhập.
    const profile = await BuddyProfile.findOne({
      user: req.user._id,
    });

    if (!profile) {
      return res.status(404).json({
        message: "Không tìm thấy hồ sơ Local.",
      });
    }

    // 4. Kiểm tra ID trước khi truy vấn MongoDB.
    if (!require("mongoose").isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "ID yêu cầu đặt lịch không hợp lệ.",
      });
    }

    // 5. Chỉ lấy booking thuộc Local này và đang Pending.
    const currentStatus = status === "Completed" ? "Confirmed" : "Pending";
    const booking = await Booking.findOne({
      _id: req.params.id,
      buddy: profile._id,
      status: currentStatus,
      escrowStatus: { $ne: "Processing" },
    });

    if (!booking) {
      return res.status(404).json({
        message: "Không tìm thấy yêu cầu đang chờ xử lý.",
      });
    }
    if (["Confirmed", "Completed"].includes(status) && booking.paymentStatus !== "Paid") {
      return res.status(400).json({
        message: "Traveler cần thanh toán trước khi Local xác nhận yêu cầu.",
      });
    }
    if (["Confirmed", "Completed"].includes(status) && booking.escrowStatus !== "Held") {
      return res.status(400).json({
        message: "Tiền đặt lịch chưa được giữ hợp lệ. Vui lòng liên hệ Admin để đối soát.",
      });
    }

    // 6. Chỉ kiểm tra lịch khi Local muốn xác nhận.
    if (status === "Confirmed") {
      const endInstant = bookingEndInstant(booking);
      if (!endInstant || endInstant <= new Date()) {
        return res.status(400).json({ message: "Không thể xác nhận lịch đã hết thời gian trải nghiệm." });
      }
      const start = toMinutes(booking.startTime);
      const end = toMinutes(booking.endTime);

      // Kiểm tra dữ liệu giờ trước khi so sánh.
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return res.status(400).json({
          message: "Giờ đặt lịch không hợp lệ.",
        });
      }

      // Chuẩn hóa ngày của booking.
      const bookingDate =
        booking.date instanceof Date
          ? booking.date.toISOString().slice(0, 10)
          : "";

      if (!bookingDate) {
        return res.status(400).json({
          message: "Ngày đặt lịch không hợp lệ.",
        });
      }

      // Chuẩn hóa ngày lịch rảnh, hỗ trợ cả String và Date.
      const dateOnly = (value) => {
        if (value instanceof Date) {
          return Number.isNaN(value.getTime())
            ? ""
            : value.toISOString().slice(0, 10);
        }

        if (typeof value === "string") {
          // Hỗ trợ YYYY-MM-DD và chuỗi ISO datetime.
          const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
          return match ? match[1] : "";
        }

        return "";
      };

      // 7. Kiểm tra booking đã được xác nhận có trùng giờ không.
      const confirmedBookings = await Booking.find({
        _id: { $ne: booking._id },
        buddy: profile._id,
        date: booking.date,
        status: "Confirmed",
      }).select("startTime endTime");

      const conflict = confirmedBookings.some((item) => {
        const oldStart = toMinutes(item.startTime);
        const oldEnd = toMinutes(item.endTime);

        // Hai khoảng giờ giao nhau thì bị trùng lịch.
        return (
          Number.isFinite(oldStart) &&
          Number.isFinite(oldEnd) &&
          start < oldEnd &&
          end > oldStart
        );
      });

      if (conflict) {
        return res.status(409).json({
          message: "Lịch này trùng với một yêu cầu đã xác nhận.",
        });
      }

      // 8. Đảm bảo Local vẫn rảnh trong toàn bộ khung giờ.
      const available = (profile.availability || []).some((slot) => {
        const slotDate = dateOnly(slot.date);
        const slotStart = toMinutes(slot.startTime);
        const slotEnd = toMinutes(slot.endTime);

        return (
          slotDate === bookingDate &&
          Number.isFinite(slotStart) &&
          Number.isFinite(slotEnd) &&
          slotStart <= start &&
          slotEnd >= end
        );
      });

      if (!available) {
        return res.status(409).json({
          message: "Khung giờ không còn nằm trong lịch rảnh của bạn.",
        });
      }
    }

    // 9. Cập nhật trạng thái trực tiếp trong MongoDB.
    // Không gọi save() nên không chạy validate toàn bộ document cũ.
    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        buddy: profile._id,
        status: currentStatus,
        ...(status === "Cancelled"
          ? { escrowStatus: { $ne: "Processing" } }
          : { paymentStatus: "Paid", escrowStatus: "Held" }),
      },
      {
        $set: { status },
      },
      {
        new: true, // Trả về booking sau khi cập nhật.
        runValidators: true, // Kiểm tra validator cho các trường được cập nhật.
      },
    );

    if (!updatedBooking) {
      return res.status(409).json({
        message: "Yêu cầu đã được xử lý hoặc không còn tồn tại.",
      });
    }

    try {
      if (status === "Cancelled" && updatedBooking.escrowStatus === "Held") {
        const refunded = await refundBookingFunds(updatedBooking, `Hoàn tiền do Local từ chối đặt lịch #${booking._id}`);
        if (!refunded) throw new Error("Không thể hoàn tiền đặt lịch.");
      } else if (status === "Completed") {
        if (updatedBooking.escrowStatus !== "Held" || !(await releaseBookingFunds(updatedBooking))) {
          throw new Error("Không thể quyết toán tiền đặt lịch.");
        }
      }
    } catch (error) {
      await Booking.updateOne(
        { _id: booking._id, status },
        { $set: { status: currentStatus } },
      );
      throw error;
    }

    // 10. Lấy thông tin Traveler và Local để trả về frontend.
    const responseBooking = await Booking.findById(updatedBooking._id);
    await responseBooking.populate([
      { path: "customer", select: "fullName email" },
      { path: "buddy", select: "fullName area coverImage price" },
    ]);

    return res.status(200).json({
      message: status === "Confirmed"
        ? "Đã xác nhận yêu cầu trải nghiệm."
        : status === "Completed"
          ? "Đã hoàn thành trải nghiệm và quyết toán ví."
          : "Đã từ chối yêu cầu trải nghiệm.",
      booking: responseBooking,
    });
  } catch (error) {
    // In lỗi đầy đủ để xác định nguyên nhân thực sự trong terminal.
    console.error("Update Local booking status error:", error.stack || error);

    return res.status(500).json({
      message: "Không thể cập nhật yêu cầu.",
      // Hiện chi tiết lỗi trong môi trường development.
      ...(process.env.NODE_ENV === "development"
        ? { error: error.message }
        : {}),
    });
  }
};

// 11. Thanh toán lịch đặt bằng ví Local Buddy
exports.payWithWallet = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOne({ _id: id, customer: req.user._id }).populate("buddy", "fullName");
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu đặt lịch." });
    }
    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({ message: "Lịch đặt này đã được thanh toán trước đó." });
    }
    if (booking.status === "Cancelled") {
      return res.status(400).json({ message: "Không thể thanh toán cho lịch đặt đã bị hủy." });
    }
    if (!bookingEndInstant(booking) || bookingEndInstant(booking) <= new Date()) {
      return res.status(400).json({ message: "Không thể thanh toán cho lịch đã hết thời gian trải nghiệm." });
    }

    const payment = await holdBookingFunds(booking, req.user._id, "Wallet");
    if (!payment.ok) {
      if (payment.alreadyHeld) {
        return res.status(409).json({ message: "Lịch đặt đã được xử lý hoặc không còn chờ thanh toán." });
      }
      return res.status(400).json({
        message: `Số dư ví không đủ. Cần ${booking.price.toLocaleString("vi-VN")} đ nhưng ví hiện chỉ có ${payment.currentBalance.toLocaleString("vi-VN")} đ. Vui lòng nạp thêm tiền.`,
        insufficient: true,
        required: booking.price,
        currentBalance: payment.currentBalance,
      });
    }

    return res.json({
      success: true,
      message: "Thanh toán bằng ví Local Buddy thành công!",
      booking,
      newBalance: payment.newBalance,
    });
  } catch (error) {
    console.error("Pay booking with wallet error:", error);
    return res.status(500).json({ message: "Lỗi xử lý thanh toán ví." });
  }
};

// 12. Lấy thông tin mã VNPAY-QR thanh toán cho lịch đặt
exports.getBookingVNPayQR = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOne({ _id: id, customer: req.user._id }).populate("buddy", "fullName");
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu đặt lịch." });
    }
    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({ message: "Lịch đặt này đã được thanh toán trước đó." });
    }
    if (booking.status !== "Pending" || !bookingEndInstant(booking) || bookingEndInstant(booking) <= new Date()) {
      return res.status(400).json({ message: "Không thể thanh toán cho lịch không còn hiệu lực." });
    }

    const orderId = `BK${booking._id.toString().slice(-6)}${Date.now().toString().slice(-4)}`;
    const qrCodeUrl = `https://api.vietqr.io/image/970419-0123456789-compact2.jpg?amount=${booking.price}&addInfo=LOCALBUDDY%20${orderId}&accountName=LOCAL%20BUDDY`;

    await Transaction.create({
      user: req.user._id,
      booking: booking._id,
      type: "Booking",
      amount: booking.price,
      status: "Pending",
      orderId,
      paymentMethod: "VNPAY_QR",
      description: `Thanh toán đặt lịch Local: ${booking.buddy?.fullName || "Local Buddy"} qua VNPAY-QR`,
    });

    booking.paymentMethod = "VNPAY_QR";
    await booking.save();

    return res.json({
      success: true,
      qrCodeUrl,
      orderId,
      amount: booking.price,
      bookingId: booking._id,
    });
  } catch (error) {
    console.error("Get booking VNPAY QR error:", error);
    return res.status(500).json({ message: "Không thể tạo mã QR thanh toán đặt lịch." });
  }
};

// 13. Xác nhận thanh toán đặt lịch qua VNPAY-QR
exports.confirmBookingVNPayQR = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderId } = req.body;
    const booking = await Booking.findOne({ _id: id, customer: req.user._id });
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu đặt lịch." });
    }
    if (booking.paymentStatus === "Paid") {
      return res.json({
        success: true,
        message: "Lịch đặt này đã được thanh toán.",
        booking,
      });
    }
    if (booking.status !== "Pending" || !bookingEndInstant(booking) || bookingEndInstant(booking) <= new Date()) {
      return res.status(400).json({ message: "Không thể thanh toán cho lịch không còn hiệu lực." });
    }

    const transaction = await Transaction.findOne({
      orderId,
      booking: booking._id,
      user: req.user._id,
      status: "Pending",
    });
    if (!transaction) {
      return res.status(404).json({ message: "Không tìm thấy giao dịch thanh toán đang chờ." });
    }
    if (typeof orderId !== "string" || !orderId.trim()) {
      return res.status(400).json({ message: "Thiếu mã giao dịch thanh toán." });
    }
    const payment = await holdBookingFunds(booking, req.user._id, "VNPAY_QR", false);
    if (!payment.ok) {
      return res.status(400).json({ message: "Không thể ghi nhận khoản thanh toán." });
    }
    transaction.status = "Completed";
    transaction.vnpTransactionNo = `QR${Date.now()}`;
    transaction.vnpBankCode = "VNPAYQR";
    transaction.vnpPayDate = new Date().toISOString();
    await transaction.save();

    return res.json({
      success: true,
      message: "Xác nhận thanh toán đặt lịch qua VNPAY-QR thành công!",
      booking,
    });
  } catch (error) {
    console.error("Confirm booking VNPAY QR error:", error);
    return res.status(500).json({ message: "Lỗi xác nhận thanh toán." });
  }
};
