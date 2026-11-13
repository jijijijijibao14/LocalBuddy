const Booking = require("../models/Booking");
const { availabilityInstant, getDaNangDate } = require("./availability");
const { refundBookingFunds, releaseBookingFunds } = require("./walletLedger");

function bookingInstant(booking, timeField) {
  const date = booking.date instanceof Date && !Number.isNaN(booking.date.getTime())
    ? booking.date.toISOString().slice(0, 10)
    : "";
  return availabilityInstant(date, booking[timeField]);
}

function bookingStartInstant(booking) {
  return bookingInstant(booking, "startTime");
}

function bookingEndInstant(booking) {
  return bookingInstant(booking, "endTime");
}

async function processExpiredBooking(booking, now = new Date(), dependencies = {}) {
  const { model = Booking, refund = refundBookingFunds, release = releaseBookingFunds } = dependencies;
  const isConfirmed = booking.status === "Confirmed";
  if (!isConfirmed && booking.status !== "Pending") return false;
  const deadline = isConfirmed ? bookingEndInstant(booking) : bookingStartInstant(booking);
  const deadlineLabel = isConfirmed ? "kết thúc" : "bắt đầu";
  if (!deadline) throw new Error(`Giờ ${deadlineLabel} không hợp lệ cho đặt lịch ${booking._id}.`);
  if (deadline > now) return false;
  if (booking.escrowStatus === "Processing") return false;
  if (isConfirmed && (booking.paymentStatus !== "Paid" || booking.escrowStatus !== "Held")) {
    throw new Error(`Đặt lịch ${booking._id} đã xác nhận nhưng tiền chưa được giữ hợp lệ (paymentStatus=${booking.paymentStatus}, escrowStatus=${booking.escrowStatus}). Cần đối soát giao dịch.`);
  }
  if (!isConfirmed && !["Held", "None", null, undefined].includes(booking.escrowStatus)) {
    throw new Error(`Trạng thái tiền của đặt lịch ${booking._id} không thể xử lý tự động.`);
  }
  if (!isConfirmed && ((booking.paymentStatus === "Paid") !== (booking.escrowStatus === "Held"))) {
    throw new Error(`Trạng thái thanh toán của đặt lịch ${booking._id} không khớp với ví hệ thống.`);
  }

  const status = isConfirmed ? "Completed" : "Cancelled";
  const claimed = await model.findOneAndUpdate(
    {
      _id: booking._id,
      status: booking.status,
      escrowStatus: booking.escrowStatus === "Held" ? "Held" : { $in: ["None", null] },
    },
    { $set: { status } },
    { new: true },
  );
  if (!claimed) return false;
  try {
    if (claimed.escrowStatus === "Held") {
      const result = isConfirmed
        ? await release(claimed)
        : await refund(claimed, `Hoàn tiền do yêu cầu đặt lịch #${claimed._id} hết hạn chưa được xác nhận`);
      if (!result) throw new Error(`Không thể quyết toán tiền cho đặt lịch ${claimed._id}.`);
    }
  } catch (error) {
    const restored = await model.updateOne(
      { _id: claimed._id, status, escrowStatus: claimed.escrowStatus },
      { $set: { status: booking.status } },
    );
    if (!restored.modifiedCount) {
      console.error(`Không thể khôi phục trạng thái đặt lịch ${claimed._id} sau lỗi quyết toán.`);
    }
    throw error;
  }
  return true;
}

async function processExpiredBookings(now = new Date()) {
  const today = new Date(`${getDaNangDate(now)}T00:00:00.000Z`);
  const bookings = Booking.find({
    status: { $in: ["Pending", "Confirmed"] },
    date: { $lte: today },
  }).cursor();
  for await (const booking of bookings) {
    try {
      await processExpiredBooking(booking, now);
    } catch (error) {
      console.error(`Lỗi tự động xử lý đặt lịch ${booking._id}:`, error);
    }
  }
}

function startBookingExpiryWorker() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processExpiredBookings();
    } catch (error) {
      console.error("Lỗi quét đặt lịch hết hạn:", error);
    } finally {
      running = false;
    }
  };
  void run();
  return setInterval(run, 60_000);
}

module.exports = {
  bookingStartInstant,
  bookingEndInstant,
  processExpiredBooking,
  processExpiredBookings,
  startBookingExpiryWorker,
};
