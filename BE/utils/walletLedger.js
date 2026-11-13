const User = require("../models/User");
const Transaction = require("../models/Transaction");
const WalletSettings = require("../models/WalletSettings");
const { notifyUser, notifyRole } = require("./notifications");

async function getWalletSettings() {
  return WalletSettings.findOneAndUpdate(
    { key: "primary" },
    { $setOnInsert: { key: "primary" } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function holdBookingFunds(booking, userId, paymentMethod, recordPayment = true) {
  const claimed = await booking.constructor.findOneAndUpdate(
    {
      _id: booking._id,
      status: "Pending",
      paymentStatus: "Unpaid",
      escrowStatus: { $in: ["None", null] },
    },
    { $set: { escrowStatus: "Processing" } },
    { new: true },
  );
  if (!claimed) {
    return { ok: false, currentBalance: null, alreadyHeld: true };
  }
  let updatedUser = null;
  try {
    if (paymentMethod === "Wallet") {
      updatedUser = await User.findOneAndUpdate(
        { _id: userId, walletBalance: { $gte: booking.price } },
        { $inc: { walletBalance: -booking.price } },
        { new: true },
      );
      if (!updatedUser) {
        const user = await User.findById(userId).select("walletBalance");
        await booking.constructor.updateOne(
          { _id: booking._id, escrowStatus: "Processing" },
          { $set: { escrowStatus: "None" } },
        );
        return { ok: false, currentBalance: user?.walletBalance || 0 };
      }
    }
  } catch (error) {
    await booking.constructor.updateOne(
      { _id: booking._id, escrowStatus: "Processing" },
      { $set: { escrowStatus: "None" } },
    );
    throw error;
  }

  let systemFunded = false;
  try {
    const settings = await getWalletSettings();
    await WalletSettings.updateOne(
      { _id: settings._id },
      { $inc: { systemBalance: booking.price } },
    );
    systemFunded = true;
    booking.paymentStatus = "Paid";
    booking.paymentMethod = paymentMethod;
    booking.paidAt = new Date();
    booking.escrowStatus = "Held";
    await booking.save();
    const records = [
      ...(recordPayment ? [{
        user: userId,
        booking: booking._id,
        type: "Booking",
        amount: booking.price,
        status: "Completed",
        paymentMethod,
        description: `Thanh toán đặt lịch #${booking._id}`,
      }] : []),
      {
        user: userId,
        booking: booking._id,
        type: "Escrow",
        amount: booking.price,
        status: "Held",
        walletOwner: "System",
        paymentMethod,
        description: `Giữ tiền đặt lịch #${booking._id} trong ví hệ thống`,
      },
    ];
    await Transaction.create(records);
    if (paymentMethod === "Wallet") {
      await notifyUser(userId, {
        title: "Số dư ví đã thay đổi",
        message: `Ví đã trừ ${booking.price.toLocaleString("vi-VN")} đ để thanh toán chuyến đi.`,
        link: "/wallet",
        type: "wallet_changed",
        booking: booking._id,
      });
    }
    await notifyRole("admin", {
      title: "Số dư ví hệ thống đã thay đổi",
      message: `Ví hệ thống vừa nhận khoản thanh toán ${booking.price.toLocaleString("vi-VN")} đ.`,
      link: "/wallet",
      type: "wallet_changed",
      booking: booking._id,
    });
    return { ok: true, newBalance: updatedUser?.walletBalance };
  } catch (error) {
    if (systemFunded) {
      await WalletSettings.updateOne(
        { key: "primary", systemBalance: { $gte: booking.price } },
        { $inc: { systemBalance: -booking.price } },
      );
    }
    if (updatedUser) {
      await User.updateOne(
        { _id: userId },
        { $inc: { walletBalance: booking.price } },
      );
    }
    await booking.constructor.updateOne(
      { _id: booking._id, escrowStatus: { $in: ["Processing", "Held"] } },
      { $set: { escrowStatus: "None", paymentStatus: "Unpaid", paidAt: null } },
    );
    await Transaction.deleteMany({
      booking: booking._id,
      type: "Escrow",
      status: "Held",
    });
    if (recordPayment) {
      await Transaction.deleteMany({
        booking: booking._id,
        type: "Booking",
        status: "Completed",
      });
    }
    throw error;
  }
}

async function refundBookingFunds(booking, reason) {
  const claimed = await booking.constructor.findOneAndUpdate(
    { _id: booking._id, escrowStatus: "Held" },
    { $set: { escrowStatus: "Refunded", paymentStatus: "Refunded" } },
    { new: true },
  );
  if (!claimed) return false;

  let settings;
  let systemDebit;
  try {
    settings = await getWalletSettings();
    systemDebit = await WalletSettings.updateOne(
      { _id: settings._id, systemBalance: { $gte: booking.price } },
      { $inc: { systemBalance: -booking.price } },
    );
  } catch (error) {
    await booking.constructor.updateOne(
      { _id: booking._id, escrowStatus: "Refunded" },
      { $set: { escrowStatus: "Held", paymentStatus: "Paid" } },
    );
    throw error;
  }
  if (!systemDebit.modifiedCount) {
    await booking.constructor.updateOne(
      { _id: booking._id },
      { $set: { escrowStatus: "Held", paymentStatus: "Paid" } },
    );
    throw new Error("Số dư ví hệ thống không đủ để hoàn tiền.");
  }
  let credited = false;
  try {
    const creditResult = await User.updateOne(
      { _id: booking.customer },
      { $inc: { walletBalance: booking.price } },
    );
    if (!creditResult.matchedCount) throw new Error("Không tìm thấy tài khoản Traveler để hoàn tiền.");
    credited = true;
    await Transaction.create([
      {
        user: booking.customer,
        booking: booking._id,
        type: "Refund",
        amount: booking.price,
        status: "Completed",
        paymentMethod: "Wallet",
        description: reason || `Hoàn tiền đặt lịch #${booking._id}`,
      },
      {
        user: booking.customer,
        booking: booking._id,
        type: "Escrow",
        amount: booking.price,
        status: "Refunded",
        walletOwner: "System",
        paymentMethod: "Wallet",
        description: `Hoàn tiền từ ví hệ thống cho đặt lịch #${booking._id}`,
      },
    ]);
  } catch (error) {
    await Promise.all([
      ...(credited ? [User.updateOne(
        { _id: booking.customer, walletBalance: { $gte: booking.price } },
        { $inc: { walletBalance: -booking.price } },
      )] : []),
      WalletSettings.updateOne(
        { _id: settings._id },
        { $inc: { systemBalance: booking.price } },
      ),
      booking.constructor.updateOne(
        { _id: booking._id },
        { $set: { escrowStatus: "Held", paymentStatus: "Paid" } },
      ),
    ]);
    await Transaction.deleteMany({
      booking: booking._id,
      $or: [
        { type: "Refund", status: "Completed" },
        { type: "Escrow", walletOwner: "System", status: "Refunded" },
      ],
    });
    throw error;
  }
  return true;
}

async function settleBookingRefund(booking, refund) {
  const amount = refund.amount;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > booking.price) {
    throw new Error("Số tiền hoàn không hợp lệ.");
  }

  const isFullRefund = amount === booking.price;
  if (refund._id) {
    const existing = await Transaction.findOne({ refundId: refund._id, type: "Refund" });
    if (existing) {
      const expectedStatus = isFullRefund ? "Refunded" : "PartiallyRefunded";
      if (booking.paymentStatus === expectedStatus) return true;
      throw new Error("Giao dịch hoàn tiền đã tồn tại nhưng trạng thái đặt lịch cần đối soát.");
    }
  }
  const previousPaymentStatus = booking.paymentStatus;
  const updatedBooking = await booking.constructor.findOneAndUpdate(
    {
      _id: booking._id,
      escrowStatus: "Held",
      paymentStatus: { $in: ["Paid", "RefundPending", "PartiallyRefunded"] },
    },
    {
      $set: {
        paymentStatus: isFullRefund ? "Refunded" : "PartiallyRefunded",
        ...(isFullRefund ? { escrowStatus: "Refunded" } : {}),
      },
    },
    { new: true },
  );
  if (!updatedBooking) return false;

  let settings;
  let debited = false;
  let credited = false;
  try {
    settings = await getWalletSettings();
    const debit = await WalletSettings.updateOne(
      { _id: settings._id, systemBalance: { $gte: amount } },
      { $inc: { systemBalance: -amount } },
    );
    if (!debit.modifiedCount) {
      throw new Error("Số dư sổ cái nội bộ không đủ để ghi nhận khoản hoàn.");
    }
    debited = true;

    if (booking.paymentMethod === "Wallet") {
      const credit = await User.updateOne(
        { _id: booking.customer },
        { $inc: { walletBalance: amount } },
      );
      if (!credit.matchedCount) {
        throw new Error("Không tìm thấy tài khoản Traveler để hoàn tiền.");
      }
      credited = true;
    }

    await Transaction.create([
      {
        user: booking.customer,
        booking: booking._id,
        ...(refund._id ? { refundId: refund._id } : {}),
        type: "Refund",
        amount,
        status: "Completed",
        paymentMethod: booking.paymentMethod,
        description: refund.reason || `Hoàn tiền đặt lịch #${booking._id}`,
      },
      {
        user: booking.customer,
        booking: booking._id,
        type: "Escrow",
        amount,
        status: "Refunded",
        walletOwner: "System",
        paymentMethod: booking.paymentMethod,
        description: `Ghi nhận hoàn tiền đặt lịch #${booking._id}`,
      },
    ]);
  } catch (error) {
    await Promise.all([
      ...(credited
        ? [User.updateOne(
            { _id: booking.customer, walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount } },
          )]
        : []),
      ...(debited
        ? [WalletSettings.updateOne(
            { _id: settings._id },
            { $inc: { systemBalance: amount } },
          )]
        : []),
      booking.constructor.updateOne(
        { _id: booking._id, paymentStatus: isFullRefund ? "Refunded" : "PartiallyRefunded" },
        {
          $set: {
            escrowStatus: "Held",
            paymentStatus: previousPaymentStatus,
          },
        },
      ),
    ]);
    await Transaction.deleteMany({
      booking: booking._id,
      ...(refund._id ? { refundId: refund._id } : {}),
      type: "Refund",
      status: "Completed",
    });
    await Transaction.deleteMany({
      booking: booking._id,
      type: "Escrow",
      walletOwner: "System",
      amount,
      status: "Refunded",
      paymentMethod: booking.paymentMethod,
    });
    throw error;
  }

  booking.paymentStatus = isFullRefund ? "Refunded" : "PartiallyRefunded";
  if (isFullRefund) booking.escrowStatus = "Refunded";
  return true;
}

async function releaseBookingFunds(booking, adminSharePercent = null) {
  if (
    adminSharePercent !== null &&
    (!Number.isInteger(adminSharePercent) || adminSharePercent < 0 || adminSharePercent > 100)
  ) {
    throw new Error("Tỷ lệ chia doanh thu không hợp lệ.");
  }
  const previousPaymentStatus = booking.paymentStatus;
  const claimed = await booking.constructor.findOneAndUpdate(
    { _id: booking._id, escrowStatus: "Held" },
    { $set: { escrowStatus: "Released", paymentStatus: "Paid" } },
    { new: true },
  );
  if (!claimed) return false;

  let buddy;
  let settings;
  let adminUser;
  try {
    [buddy, settings, adminUser] = await Promise.all([
      require("../models/BuddyProfile").findById(booking.buddy).populate("user", "isPremium"),
      getWalletSettings(),
      User.findOne({ role: "admin" }).select("_id"),
    ]);
  } catch (error) {
    await booking.constructor.updateOne(
      { _id: booking._id, escrowStatus: "Released" },
      { $set: { escrowStatus: "Held", paymentStatus: previousPaymentStatus } },
    );
    throw error;
  }
  if (!buddy?.user) {
    await booking.constructor.updateOne(
      { _id: booking._id },
      { $set: { escrowStatus: "Held", paymentStatus: previousPaymentStatus } },
    );
    throw new Error("Không tìm thấy tài khoản Local để quyết toán.");
  }

  const rate = adminSharePercent === null
    ? buddy.user.isPremium
      ? settings.premiumCommissionPercent
      : settings.standardCommissionPercent
    : adminSharePercent;
  const commission = Math.round((booking.price * rate) / 100);
  const localAmount = booking.price - commission;
  const deferLocalSettlement = adminSharePercent === null && localAmount > 0;
  const systemDebitAmount = deferLocalSettlement ? commission : booking.price;
  let systemDebit;
  try {
    systemDebit = await WalletSettings.updateOne(
      { _id: settings._id, systemBalance: { $gte: booking.price } },
      {
        $inc: {
          systemBalance: -systemDebitAmount,
          adminBalance: commission,
        },
      },
    );
  } catch (error) {
    await booking.constructor.updateOne(
      { _id: booking._id, escrowStatus: "Released" },
      { $set: { escrowStatus: "Held", paymentStatus: previousPaymentStatus } },
    );
    throw error;
  }
  if (!systemDebit.modifiedCount) {
    await booking.constructor.updateOne(
      { _id: booking._id },
      { $set: { escrowStatus: "Held", paymentStatus: previousPaymentStatus } },
    );
    throw new Error("Số dư ví hệ thống không đủ để quyết toán.");
  }
  let creditedLocal = false;
  try {
    if (deferLocalSettlement) {
      const bookingUpdate = await booking.constructor.updateOne(
        { _id: booking._id, escrowStatus: "Released" },
        {
          $set: {
            localEarning: localAmount,
            adminCommission: commission,
            settlementStatus: "Pending",
          },
        },
      );
      if (!bookingUpdate.matchedCount) {
        throw new Error("Không thể cập nhật khoản tất toán đang chờ.");
      }
    } else {
      const creditResult = await User.updateOne(
        { _id: buddy.user._id },
        { $inc: { walletBalance: localAmount } },
      );
      if (!creditResult.matchedCount) throw new Error("Không tìm thấy tài khoản Local để quyết toán.");
      creditedLocal = true;
    }
    await Transaction.create([
      {
        user: buddy.user._id,
        booking: booking._id,
        type: "Earning",
        amount: localAmount,
        status: deferLocalSettlement ? "Pending" : "Completed",
        walletOwner: deferLocalSettlement ? "System" : "User",
        paymentMethod: "Wallet",
        description: deferLocalSettlement
          ? `Chờ Admin tất toán khoản thu nhập từ đặt lịch #${booking._id}`
          : `Thu nhập sau hoa hồng từ đặt lịch #${booking._id}`,
      },
      {
        user: adminUser?._id || buddy.user._id,
        booking: booking._id,
        type: "Commission",
        amount: commission,
        status: "Completed",
        walletOwner: "Admin",
        paymentMethod: "Wallet",
        description: `Hoa hồng ${rate}% từ đặt lịch #${booking._id}`,
      },
      {
        user: buddy.user._id,
        booking: booking._id,
        type: "Escrow",
        amount: booking.price,
        status: "Completed",
        walletOwner: "System",
        paymentMethod: "Wallet",
        description: `Giải ngân đặt lịch #${booking._id}`,
      },
    ]);
  } catch (error) {
    await Promise.all([
      ...(creditedLocal
        ? [User.updateOne(
            { _id: buddy.user._id, walletBalance: { $gte: localAmount } },
            { $inc: { walletBalance: -localAmount } },
          )]
        : []),
      WalletSettings.updateOne(
        { _id: settings._id },
        {
          $inc: {
            systemBalance: systemDebitAmount,
            adminBalance: -commission,
          },
        },
      ),
      booking.constructor.updateOne(
        { _id: booking._id },
        {
          $set: {
            escrowStatus: "Held",
            paymentStatus: previousPaymentStatus,
            ...(deferLocalSettlement
              ? { settlementStatus: "None", localEarning: 0, adminCommission: 0 }
              : {}),
          },
        },
      ),
    ]);
    await Transaction.deleteMany({
      booking: booking._id,
      type: { $in: ["Earning", "Commission", "Escrow"] },
      status: "Completed",
    });
    await Transaction.deleteMany({
      booking: booking._id,
      type: "Earning",
      status: "Pending",
      walletOwner: "System",
    });
    throw error;
  }
  if (deferLocalSettlement) {
    booking.localEarning = localAmount;
    booking.adminCommission = commission;
    booking.settlementStatus = "Pending";
  }
  booking.paymentStatus = "Paid";
  booking.escrowStatus = "Released";
  if (!deferLocalSettlement) {
    await notifyUser(buddy.user._id, {
      title: "Số dư ví đã thay đổi",
      message: `Đã cộng ${localAmount.toLocaleString("vi-VN")} đ thu nhập từ chuyến đi.`,
      link: "/wallet",
      type: "wallet_changed",
      booking: booking._id,
    });
    await notifyRole("admin", {
      title: "Số dư ví hệ thống và ví Admin thay đổi",
      message: `Đã chia escrow chuyến ${booking._id}: hoa hồng ${commission.toLocaleString("vi-VN")} đ.`,
      link: "/wallet",
      type: "wallet_changed",
      booking: booking._id,
    });
  }
  return { commission, localAmount, rate };
}

async function settleLocalEarning(booking) {
  const claimed = await booking.constructor.findOneAndUpdate(
    { _id: booking._id, status: "Completed", settlementStatus: "Pending", escrowStatus: "Released" },
    { $set: { settlementStatus: "Processing" } },
    { new: true },
  );
  if (!claimed) return false;

  const amount = booking.localEarning;
  let settings;
  let localUserId;
  let debited = false;
  let credited = false;
  let earning;
  try {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("Số tiền tất toán không hợp lệ.");
    }
    const buddy = await require("../models/BuddyProfile")
      .findById(booking.buddy)
      .select("user");
    if (!buddy?.user) throw new Error("Không tìm thấy tài khoản Local để tất toán.");
    localUserId = buddy.user;
    settings = await getWalletSettings();
    const debit = await WalletSettings.updateOne(
      { _id: settings._id, systemBalance: { $gte: amount } },
      { $inc: { systemBalance: -amount } },
    );
    if (!debit.modifiedCount) throw new Error("Số dư ví hệ thống không đủ để tất toán.");
    debited = true;

    const credit = await User.updateOne(
      { _id: localUserId },
      { $inc: { walletBalance: amount } },
    );
    if (!credit.matchedCount) throw new Error("Không tìm thấy tài khoản Local để tất toán.");
    credited = true;

    earning = await Transaction.findOneAndUpdate(
      {
        booking: booking._id,
        type: "Earning",
        status: "Pending",
        walletOwner: "System",
      },
      { $set: { status: "Completed", walletOwner: "User" } },
      { new: true },
    );
    if (!earning) throw new Error("Không tìm thấy khoản thu nhập đang chờ tất toán.");

    const completed = await booking.constructor.updateOne(
      { _id: booking._id, settlementStatus: "Processing" },
      { $set: { settlementStatus: "Completed" } },
    );
    if (!completed.matchedCount && !completed.modifiedCount) {
      throw new Error("Không thể cập nhật trạng thái tất toán.");
    }
  } catch (error) {
    await Promise.all([
      ...(credited
        ? [User.updateOne(
            { _id: localUserId, walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount } },
          )]
        : []),
      ...(debited
        ? [WalletSettings.updateOne({ _id: settings._id }, { $inc: { systemBalance: amount } })]
        : []),
      ...(earning
        ? [Transaction.updateOne(
            { _id: earning._id },
            { $set: { status: "Pending", walletOwner: "System" } },
          )]
        : []),
      booking.constructor.updateOne(
        { _id: booking._id, settlementStatus: "Processing" },
        { $set: { settlementStatus: "Pending" } },
      ),
    ]);
    throw error;
  }
  return true;
}

module.exports = {
  getWalletSettings,
  holdBookingFunds,
  refundBookingFunds,
  settleBookingRefund,
  releaseBookingFunds,
  settleLocalEarning,
};
