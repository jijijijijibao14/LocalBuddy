const User = require("../models/User");
const Transaction = require("../models/Transaction");
const WalletSettings = require("../models/WalletSettings");

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

async function releaseBookingFunds(booking) {
  const claimed = await booking.constructor.findOneAndUpdate(
    { _id: booking._id, escrowStatus: "Held" },
    { $set: { escrowStatus: "Released" } },
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
      { $set: { escrowStatus: "Held" } },
    );
    throw error;
  }
  if (!buddy?.user) {
    await booking.constructor.updateOne(
      { _id: booking._id },
      { $set: { escrowStatus: "Held" } },
    );
    throw new Error("Không tìm thấy tài khoản Local để quyết toán.");
  }

  const rate = buddy.user.isPremium
    ? settings.premiumCommissionPercent
    : settings.standardCommissionPercent;
  const commission = Math.round((booking.price * rate) / 100);
  const localAmount = booking.price - commission;
  let systemDebit;
  try {
    systemDebit = await WalletSettings.updateOne(
      { _id: settings._id, systemBalance: { $gte: booking.price } },
      {
        $inc: {
          systemBalance: -booking.price,
          adminBalance: commission,
        },
      },
    );
  } catch (error) {
    await booking.constructor.updateOne(
      { _id: booking._id, escrowStatus: "Released" },
      { $set: { escrowStatus: "Held" } },
    );
    throw error;
  }
  if (!systemDebit.modifiedCount) {
    await booking.constructor.updateOne(
      { _id: booking._id },
      { $set: { escrowStatus: "Held" } },
    );
    throw new Error("Số dư ví hệ thống không đủ để quyết toán.");
  }
  let credited = false;
  try {
    const creditResult = await User.updateOne(
      { _id: buddy.user._id },
      { $inc: { walletBalance: localAmount } },
    );
    if (!creditResult.matchedCount) throw new Error("Không tìm thấy tài khoản Local để quyết toán.");
    credited = true;
    await Transaction.create([
      {
        user: buddy.user._id,
        booking: booking._id,
        type: "Earning",
        amount: localAmount,
        status: "Completed",
        paymentMethod: "Wallet",
        description: `Thu nhập sau hoa hồng từ đặt lịch #${booking._id}`,
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
      ...(credited ? [User.updateOne(
        { _id: buddy.user._id, walletBalance: { $gte: localAmount } },
        { $inc: { walletBalance: -localAmount } },
      )] : []),
      WalletSettings.updateOne(
        { _id: settings._id },
        {
          $inc: {
            systemBalance: booking.price,
            adminBalance: -commission,
          },
        },
      ),
      booking.constructor.updateOne(
        { _id: booking._id },
        { $set: { escrowStatus: "Held" } },
      ),
    ]);
    await Transaction.deleteMany({
      booking: booking._id,
      type: { $in: ["Earning", "Commission", "Escrow"] },
      status: "Completed",
    });
    throw error;
  }
  return { commission, localAmount, rate };
}

module.exports = {
  getWalletSettings,
  holdBookingFunds,
  refundBookingFunds,
  releaseBookingFunds,
};
