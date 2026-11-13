const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BuddyProfile = require("../models/BuddyProfile");
const Refund = require("../models/Refund");
const WalletSettings = require("../models/WalletSettings");
const Transaction = require("../models/Transaction");
const {
  getWalletSettings,
  releaseBookingFunds,
  settleBookingRefund,
} = require("../utils/walletLedger");
const {
  DEFAULT_CANCELLATION_POLICY,
  calculateCancellationQuote,
  isValidCancellationPolicy,
} = require("../utils/refundPolicy");
const { notifyBookingStatus, notifyUser, notifyRole } = require("../utils/notifications");

function isCancellable(booking) {
  return ["Pending", "Confirmed"].includes(booking.status);
}

function quoteFor(booking, policy, now = new Date()) {
  return calculateCancellationQuote(booking, policy, now);
}

async function submitCancellation(booking, actor, reason, percentage) {
  const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
  if (cleanReason.length < 3) {
    return { error: "Vui lòng nhập lý do hủy (ít nhất 3 ký tự)." };
  }
  if (!isCancellable(booking)) {
    return { error: "Chỉ có thể hủy lịch đang chờ hoặc đã xác nhận." };
  }

  if (booking.paymentStatus !== "Paid" || booking.escrowStatus !== "Held") {
    const updated = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        status: booking.status,
        paymentStatus: "Unpaid",
        escrowStatus: { $in: ["None", null] },
      },
      {
        $set: { status: "Cancelled", cancellationReason: cleanReason },
      },
      { new: true },
    );
    if (!updated) return { error: "Lịch vừa được cập nhật hoặc thanh toán đang được đối soát." };
    await notifyBookingStatus(updated, "Cancelled", actor.role);
    return { booking: updated, refund: null };
  }

  const amount = Math.round((booking.price * percentage) / 100);
  let refund;
  try {
    refund = await Refund.create({
      booking: booking._id,
      customer: booking.customer,
      requestedBy: actor._id,
      requestedByRole: actor.role,
      amount,
      percentage,
      reason: cleanReason,
      paymentMethod: booking.paymentMethod,
      status: "PENDING",
      history: [{
        status: "PENDING",
        actor: actor._id,
        note: `Yêu cầu hủy bởi ${actor.role}.`,
      }],
    });
  } catch (error) {
    if (error.code === 11000) {
      return { error: "Đã có yêu cầu hoàn tiền cho lịch này." };
    }
    throw error;
  }

  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: booking.status,
      paymentStatus: "Paid",
      escrowStatus: "Held",
      refundRequestId: null,
    },
    {
      $set: {
        status: "Cancelled",
        cancellationReason: cleanReason,
        paymentStatus: "RefundPending",
        refundRequestId: refund._id,
      },
    },
    { new: true },
  );
  if (!updated) {
    await Refund.deleteOne({ _id: refund._id, status: "PENDING" });
    return { error: "Lịch vừa được cập nhật hoặc thanh toán đang được đối soát." };
  }

  if (
    actor.role === "local" &&
    booking.status === "Pending" &&
    booking.paymentMethod === "Wallet"
  ) {
    try {
      if (!(await settleBookingRefund(updated, refund))) {
        throw new Error("Không thể ghi nhận hoàn tiền vào ví Traveler.");
      }
      await notifyUser(booking.customer, {
        title: "Số dư ví đã thay đổi",
        message: `Đã hoàn ${refund.amount.toLocaleString("vi-VN")} đ vào ví.`,
        link: "/wallet",
        type: "wallet_changed",
        booking: booking._id,
      });
      await notifyRole("admin", {
        title: "Số dư ví hệ thống đã thay đổi",
        message: `Ví hệ thống đã hoàn ${refund.amount.toLocaleString("vi-VN")} đ cho chuyến ${booking._id}.`,
        link: "/wallet",
        type: "wallet_changed",
        booking: booking._id,
      });
      const settledRefund = await Refund.findOneAndUpdate(
        { _id: refund._id, status: "PENDING" },
        {
          $set: { status: "REFUNDED", reviewedBy: actor._id },
          $push: {
            history: {
              status: "REFUNDED",
              actor: actor._id,
              note: "Hoàn 100% tự động vào ví do Local từ chối yêu cầu.",
            },
          },
        },
        { new: true },
      );
      if (!settledRefund) {
        throw new Error("Đã ghi nhận tiền hoàn nhưng không cập nhật được lịch sử hoàn tiền.");
      }
      refund = settledRefund;
    } catch (error) {
      console.error("Automatically refund Local-rejected wallet booking error:", error);
    }
  }

  await notifyBookingStatus(updated, "Cancelled", actor.role);
  return { booking: updated, refund };
}

exports.quote = async (req, res) => {
  try {
    if (req.user.role !== "traveler") {
      return res.status(403).json({ message: "Chỉ Traveler mới được yêu cầu hủy lịch." });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Mã lịch đặt không hợp lệ." });
    }
    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });
    if (!booking) return res.status(404).json({ message: "Không tìm thấy lịch đặt." });
    if (!isCancellable(booking)) {
      return res.status(400).json({ message: "Lịch này không còn ở trạng thái có thể hủy." });
    }
    if (booking.refundRequestId) {
      return res.status(409).json({ message: "Lịch đã có yêu cầu hoàn tiền." });
    }

    const settings = await getWalletSettings();
    const policy = settings.cancellationPolicy || DEFAULT_CANCELLATION_POLICY;
    const paid = booking.paymentStatus === "Paid" && booking.escrowStatus === "Held";
    return res.json({
      bookingId: booking._id,
      price: booking.price,
      ...(paid
        ? quoteFor(booking, policy)
        : { percentage: 0, amount: 0, hoursUntilExperience: null }),
      policy,
      currency: "VND",
      paid,
    });
  } catch (error) {
    console.error("Calculate cancellation refund quote error:", error);
    return res.status(500).json({ message: "Không thể tính số tiền hoàn dự kiến." });
  }
};

exports.cancel = async (req, res) => {
  try {
    if (req.user.role !== "traveler") {
      return res.status(403).json({ message: "Chỉ Traveler mới được yêu cầu hủy lịch." });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Mã lịch đặt không hợp lệ." });
    }
    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });
    if (!booking) return res.status(404).json({ message: "Không tìm thấy lịch đặt." });

    let percentage = 0;
    if (booking.paymentStatus === "Paid" && booking.escrowStatus === "Held") {
      const settings = await getWalletSettings();
      const policy = settings.cancellationPolicy || DEFAULT_CANCELLATION_POLICY;
      percentage = quoteFor(booking, policy).percentage;
    }
    const result = await submitCancellation(booking, req.user, req.body.reason, percentage);
    if (result.error) return res.status(409).json({ message: result.error });
    return res.status(201).json({
      message: result.refund
        ? "Đã gửi yêu cầu hủy và hoàn tiền để Admin xử lý."
        : "Đã hủy lịch chưa thanh toán.",
      booking: result.booking,
      refund: result.refund,
    });
  } catch (error) {
    console.error("Submit traveler cancellation error:", error);
    return res.status(500).json({ message: "Không thể gửi yêu cầu hủy lịch." });
  }
};

exports.cancelByLocalOrAdmin = async (booking, actor, reason) => {
  if (!["local", "admin"].includes(actor.role)) {
    return { error: "Không có quyền hủy lịch." };
  }
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  if (actor.role === "local" && booking.status === "Confirmed" && cleanReason.length < 3) {
    return { error: "Vui lòng nhập lý do hủy chuyến (ít nhất 3 ký tự)." };
  }
  const cancellationReason = booking.status === "Confirmed" && actor.role === "local"
    ? `Local yêu cầu hủy chuyến: ${cleanReason}`
    : cleanReason || "Local từ chối yêu cầu đặt lịch.";
  return submitCancellation(booking, actor, cancellationReason, 100);
};

exports.listMine = async (req, res) => {
  try {
    const refunds = await Refund.find({ customer: req.user._id })
      .populate({
        path: "booking",
        select: "date time price status paymentMethod",
        populate: { path: "buddy", select: "fullName" },
      })
      .sort({ createdAt: -1 });
    return res.json(refunds);
  } catch (error) {
    console.error("Load traveler refunds error:", error);
    return res.status(500).json({ message: "Không thể tải lịch sử hoàn tiền." });
  }
};

exports.listAdmin = async (req, res) => {
  try {
    const refunds = await Refund.find()
      .populate("customer", "fullName email")
      .populate("requestedBy", "fullName role")
      .populate({
        path: "booking",
        select: "date time price paymentMethod status",
        populate: { path: "buddy", select: "fullName" },
      })
      .sort({ createdAt: -1 })
      .limit(200);
    return res.json(refunds);
  } catch (error) {
    console.error("Load admin refund requests error:", error);
    return res.status(500).json({ message: "Không thể tải yêu cầu hoàn tiền." });
  }
};

exports.review = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Mã yêu cầu hoàn tiền không hợp lệ." });
    }
    const { action, note = "" } = req.body;
    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "Thao tác duyệt hoàn tiền không hợp lệ." });
    }
    const refund = await Refund.findOneAndUpdate(
      { _id: req.params.id, status: "PENDING" },
      {
        $set: {
          status: action === "REJECT" ? "REJECTED" : "APPROVED",
          reviewedBy: req.user._id,
          reviewNote: String(note).trim().slice(0, 500),
        },
        $push: {
          history: {
            status: action === "REJECT" ? "REJECTED" : "APPROVED",
            actor: req.user._id,
            note: String(note).trim().slice(0, 500),
          },
        },
      },
      { new: true },
    );
    if (!refund) {
      return res.status(409).json({ message: "Yêu cầu đã được xử lý hoặc không còn chờ duyệt." });
    }

    const booking = await Booking.findById(refund.booking);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy lịch của yêu cầu hoàn tiền." });
    if (action === "REJECT") {
      await Booking.updateOne(
        { _id: booking._id, paymentStatus: "RefundPending" },
        { $set: { paymentStatus: "Paid" } },
      );
      return res.json(refund);
    }
    if (refund.amount === 0) {
      const payoutNote = "Chính sách áp dụng mức hoàn 0%; tiền escrow được chia 50% cho Admin và 50% cho Local.";
      try {
        const payout = await releaseBookingFunds(booking, 50);
        if (!payout) throw new Error("Escrow không còn ở trạng thái có thể chia khoản không hoàn.");
        const completed = await Refund.findOneAndUpdate(
          { _id: refund._id, status: "APPROVED" },
          {
            $set: {
              status: "NO_REFUND",
              reviewedBy: req.user._id,
              reviewNote: payoutNote,
            },
            $push: {
              history: {
                status: "NO_REFUND",
                actor: req.user._id,
                note: payoutNote,
              },
            },
          },
          { new: true },
        );
        if (!completed) {
          throw new Error("Đã chia escrow nhưng không cập nhật được trạng thái yêu cầu; cần đối soát thủ công.");
        }
        return res.json(completed);
      } catch (error) {
        await Refund.findOneAndUpdate(
          { _id: refund._id, status: "APPROVED" },
          {
            $set: { status: "FAILED", reviewNote: error.message },
            $push: {
              history: {
                status: "FAILED",
                actor: req.user._id,
                note: error.message,
              },
            },
          },
        );
        await Booking.updateOne(
          { _id: booking._id, escrowStatus: "Held", paymentStatus: "RefundPending" },
          { $set: { paymentStatus: "Paid" } },
        );
        throw error;
      }
    }
    if (refund.paymentMethod !== "Wallet") {
      const processing = await Refund.findOneAndUpdate(
        { _id: refund._id, status: "APPROVED" },
        {
          $set: {
            status: "PROCESSING",
            reviewNote: "Được duyệt. Cần hoàn tiền trên cổng PayOS và nhập mã xác nhận.",
          },
          $push: {
            history: {
              status: "PROCESSING",
              actor: req.user._id,
              note: "PayOS không cung cấp thao tác hoàn tiền qua SDK hiện tại; cần xử lý trên Merchant Portal.",
            },
          },
        },
        { new: true },
      );
      return res.json(processing);
    }

    await Refund.updateOne(
      { _id: refund._id, status: "APPROVED" },
      {
        $set: { status: "PROCESSING" },
        $push: { history: { status: "PROCESSING", actor: req.user._id, note: "Đang ghi có khoản hoàn vào ví nội bộ." } },
      },
    );
    try {
      const settled = await settleBookingRefund(booking, refund);
      if (!settled) throw new Error("Số dư/escrow đặt lịch không còn ở trạng thái có thể hoàn.");
      await notifyUser(booking.customer, {
        title: "Số dư ví đã thay đổi",
        message: `Đã hoàn ${refund.amount.toLocaleString("vi-VN")} đ vào ví.`,
        link: "/wallet",
        type: "wallet_changed",
        booking: booking._id,
      });
      await notifyRole("admin", {
        title: "Số dư ví hệ thống đã thay đổi",
        message: `Ví hệ thống đã hoàn ${refund.amount.toLocaleString("vi-VN")} đ cho chuyến ${booking._id}.`,
        link: "/wallet",
        type: "wallet_changed",
        booking: booking._id,
      });
      const completed = await Refund.findOneAndUpdate(
        { _id: refund._id, status: "PROCESSING" },
        {
          $set: { status: "REFUNDED", reviewedBy: req.user._id },
          $push: { history: { status: "REFUNDED", actor: req.user._id, note: "Đã ghi có tiền hoàn vào ví Traveler." } },
        },
        { new: true },
      );
      return res.json(completed);
    } catch (error) {
      await Refund.findOneAndUpdate(
        { _id: refund._id, status: "PROCESSING" },
        {
          $set: { status: "FAILED", reviewNote: error.message },
          $push: { history: { status: "FAILED", actor: req.user._id, note: error.message } },
        },
      );
      await Booking.updateOne(
        { _id: booking._id, paymentStatus: "RefundPending" },
        { $set: { paymentStatus: "Paid" } },
      );
      throw error;
    }
  } catch (error) {
    console.error("Review refund request error:", error);
    return res.status(500).json({ message: error.message || "Không thể xử lý yêu cầu hoàn tiền." });
  }
};

exports.confirmExternalRefund = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Mã yêu cầu hoàn tiền không hợp lệ." });
    }
    const providerRefundId = typeof req.body.providerRefundId === "string"
      ? req.body.providerRefundId.trim().slice(0, 120)
      : "";
    const note = typeof req.body.note === "string" ? req.body.note.trim().slice(0, 500) : "";
    if (!providerRefundId || !note) {
      return res.status(400).json({ message: "Cần mã giao dịch hoàn PayOS và ghi chú đối soát." });
    }
    const refund = await Refund.findOneAndUpdate(
      { _id: req.params.id, status: "PROCESSING", paymentMethod: { $ne: "Wallet" }, providerRefundId: "" },
      {
        $set: { providerRefundId, reviewNote: note },
        $push: { history: { status: "PROCESSING", actor: req.user._id, providerRefundId, note } },
      },
      { new: true },
    );
    if (!refund) {
      return res.status(409).json({ message: "Yêu cầu không còn chờ xác nhận hoặc đã có mã hoàn tiền." });
    }

    const booking = await Booking.findById(refund.booking);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy lịch của yêu cầu hoàn tiền." });
    const existing = await Transaction.findOne({ refundId: refund._id, type: "Refund" });
    if (!existing) {
      const settled = await settleBookingRefund(booking, refund);
      if (!settled) {
        await Refund.updateOne(
          { _id: refund._id, status: "PROCESSING" },
          {
            $set: { status: "FAILED", reviewNote: "Cổng đã xác nhận hoàn tiền nhưng sổ cái nội bộ không thể đối soát." },
            $push: { history: { status: "FAILED", actor: req.user._id, providerRefundId, note: "Đối soát sổ cái thất bại; cần xử lý thủ công." } },
          },
        );
        return res.status(409).json({ message: "Không thể đối soát sổ cái sau xác nhận PayOS; yêu cầu được đánh dấu để xử lý thủ công." });
      }
      await notifyRole("admin", {
        title: "Số dư ví hệ thống đã thay đổi",
        message: `Đã đối soát khoản hoàn ${refund.amount.toLocaleString("vi-VN")} đ cho chuyến ${booking._id}.`,
        link: "/wallet",
        type: "wallet_changed",
        booking: booking._id,
      });
    }
    const completed = await Refund.findOneAndUpdate(
      { _id: refund._id, status: "PROCESSING", providerRefundId },
      {
        $set: { status: "REFUNDED", reviewedBy: req.user._id },
        $push: { history: { status: "REFUNDED", actor: req.user._id, providerRefundId, note } },
      },
      { new: true },
    );
    return res.json(completed);
  } catch (error) {
    console.error("Confirm external refund error:", error);
    if (mongoose.isValidObjectId(req.params.id)) {
      await Refund.updateOne(
        { _id: req.params.id, status: "PROCESSING", providerRefundId: { $ne: "" } },
        {
          $set: { status: "FAILED", reviewNote: error.message },
          $push: {
            history: {
              status: "FAILED",
              actor: req.user._id,
              providerRefundId: req.body?.providerRefundId || "",
              note: `PayOS đã được báo xác nhận nhưng cần đối soát nội bộ: ${error.message}`,
            },
          },
        },
      );
    }
    return res.status(500).json({ message: "Không thể xác nhận khoản hoàn từ cổng thanh toán." });
  }
};

exports.getCancellationPolicy = async (req, res) => {
  const settings = await getWalletSettings();
  return res.json({
    cancellationPolicy: settings.cancellationPolicy || DEFAULT_CANCELLATION_POLICY,
  });
};

exports.updateCancellationPolicy = async (req, res) => {
  const policy = req.body.cancellationPolicy;
  if (!policy || !isValidCancellationPolicy(policy)) {
    return res.status(400).json({ message: "Tỷ lệ hoàn phải là số nguyên từ 0 đến 100." });
  }
  const settings = await getWalletSettings();
  const updated = await WalletSettings.findByIdAndUpdate(
    settings._id,
    { $set: { cancellationPolicy: policy } },
    { new: true, runValidators: true },
  );
  return res.json({ cancellationPolicy: updated.cancellationPolicy });
};
