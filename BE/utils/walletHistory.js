function transactionHistoryFilter(user) {
  if (user.role === "traveler") {
    return {
      user: user._id,
      walletOwner: { $in: ["User", null] },
      type: { $in: ["TopUp", "Withdrawal", "Booking", "Refund"] },
    };
  }
  if (user.role === "local") {
    return {
      user: user._id,
      walletOwner: { $in: ["User", null] },
      type: { $in: ["TopUp", "Withdrawal", "Earning"] },
    };
  }
  if (user.role === "admin") {
    return {
      $or: [
        { walletOwner: "System", type: "Escrow" },
        { walletOwner: "Admin", type: "Commission" },
        { walletOwner: "Admin", type: "Withdrawal" },
      ],
    };
  }
  throw new Error("Vai trò không được hỗ trợ cho lịch sử ví.");
}

module.exports = { transactionHistoryFilter };
