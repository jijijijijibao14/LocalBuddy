const test = require("node:test");
const assert = require("node:assert/strict");
const Booking = require("../models/Booking");
const BuddyProfile = require("../models/BuddyProfile");
const Refund = require("../models/Refund");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const WalletSettings = require("../models/WalletSettings");
const { review } = require("./refundController");

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("approving a zero-refund request pays the held escrow 50/50 to Admin and Local", async (t) => {
  const bookingId = "507f1f77bcf86cd799439011";
  const localId = "507f1f77bcf86cd799439012";
  const adminId = "507f1f77bcf86cd799439013";
  const state = {
    escrowStatus: "Held",
    paymentStatus: "RefundPending",
    systemBalance: 140000,
    adminBalance: 0,
    localBalance: 0,
    travelerBalance: 0,
    transactions: [],
  };
  const booking = {
    _id: bookingId,
    customer: "traveler",
    buddy: "buddy",
    price: 140000,
    paymentMethod: "Wallet",
    paymentStatus: "RefundPending",
    escrowStatus: "Held",
    constructor: Booking,
  };
  const approvedRefund = {
    _id: bookingId,
    booking: bookingId,
    amount: 0,
    percentage: 0,
    paymentMethod: "Wallet",
    status: "APPROVED",
  };
  const completedRefund = {
    ...approvedRefund,
    status: "NO_REFUND",
  };

  t.mock.method(Refund, "findOneAndUpdate", async (filter) => (
    filter.status === "PENDING" ? approvedRefund : completedRefund
  ));
  t.mock.method(Booking, "findById", async () => booking);
  t.mock.method(Booking, "findOneAndUpdate", async (filter, update) => {
    if (state.escrowStatus !== filter.escrowStatus) return null;
    Object.assign(state, update.$set);
    return booking;
  });
  t.mock.method(WalletSettings, "findOneAndUpdate", async () => ({
    _id: "settings",
    standardCommissionPercent: 10,
    premiumCommissionPercent: 5,
  }));
  t.mock.method(WalletSettings, "updateOne", async (_filter, update) => {
    for (const [key, amount] of Object.entries(update.$inc)) state[key] += amount;
    return { modifiedCount: 1 };
  });
  t.mock.method(BuddyProfile, "findById", () => ({
    populate: async () => ({ user: { _id: localId, isPremium: false } }),
  }));
  t.mock.method(User, "findOne", () => ({
    select: async () => ({ _id: adminId }),
  }));
  t.mock.method(User, "updateOne", async (filter, update) => {
    if (filter._id === localId) state.localBalance += update.$inc.walletBalance;
    if (filter._id === "traveler") state.travelerBalance += update.$inc.walletBalance;
    return { matchedCount: 1 };
  });
  t.mock.method(Transaction, "create", async (records) => {
    state.transactions.push(...records);
  });

  const res = response();
  await review({
    params: { id: bookingId },
    body: { action: "APPROVE" },
    user: { _id: adminId },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "NO_REFUND");
  assert.equal(state.systemBalance, 0);
  assert.equal(state.adminBalance, 70000);
  assert.equal(state.localBalance, 70000);
  assert.equal(state.travelerBalance, 0);
  assert.equal(state.escrowStatus, "Released");
  assert.equal(state.paymentStatus, "Paid");
  assert.deepEqual(state.transactions.map(({ type, amount }) => [type, amount]), [
    ["Earning", 70000],
    ["Commission", 70000],
    ["Escrow", 140000],
  ]);
});
