const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/User");
const BuddyProfile = require("../models/BuddyProfile");
const Transaction = require("../models/Transaction");
const WalletSettings = require("../models/WalletSettings");
const { releaseBookingFunds, refundBookingFunds } = require("./walletLedger");

function setup(t, premium = false, paymentStatus = "Paid") {
  const state = {
    escrowStatus: "Held",
    paymentStatus,
    systemBalance: 140000,
    adminBalance: 0,
    travelerBalance: 0,
    localBalance: 0,
    transactions: [],
  };
  const settings = { _id: "settings", standardCommissionPercent: 10, premiumCommissionPercent: 5 };
  const model = {
    findOneAndUpdate: async (filter, update) => {
      if (state.escrowStatus !== filter.escrowStatus) return null;
      Object.assign(state, update.$set);
      return state;
    },
    updateOne: async (filter, update) => Object.assign(state, update.$set),
  };
  const booking = {
    _id: "booking", customer: "traveler", buddy: "buddy", price: 140000,
    paymentStatus,
    constructor: model,
  };
  t.mock.method(WalletSettings, "findOneAndUpdate", async () => settings);
  t.mock.method(WalletSettings, "updateOne", async (filter, update) => {
    if (filter.systemBalance && state.systemBalance < filter.systemBalance.$gte) return { modifiedCount: 0 };
    for (const [key, value] of Object.entries(update.$inc)) state[key] += value;
    return { modifiedCount: 1 };
  });
  t.mock.method(User, "updateOne", async (filter, update) => {
    const key = filter._id === "traveler" ? "travelerBalance" : "localBalance";
    state[key] += update.$inc.walletBalance;
    return { matchedCount: 1 };
  });
  t.mock.method(User, "findOne", () => ({ select: async () => ({ _id: "admin" }) }));
  t.mock.method(BuddyProfile, "findById", () => ({
    populate: async () => ({ user: { _id: "local", isPremium: premium } }),
  }));
  t.mock.method(Transaction, "create", async (records) => {
    state.transactions.push(...(Array.isArray(records) ? records : [records]));
  });
  return { state, booking };
}

test("non-refundable cancellation splits held funds equally and clears pending payment status", async (t) => {
  const { state, booking } = setup(t, false, "RefundPending");
  const result = await releaseBookingFunds(booking, 50);

  assert.equal(result.commission, 70000);
  assert.equal(result.localAmount, 70000);
  assert.equal(state.systemBalance, 0);
  assert.equal(state.adminBalance, 70000);
  assert.equal(state.localBalance, 70000);
  assert.equal(state.travelerBalance, 0);
  assert.equal(state.paymentStatus, "Paid");
  assert.equal(state.escrowStatus, "Released");
  assert.deepEqual(state.transactions.map((item) => [item.type, item.amount]), [
    ["Earning", 70000],
    ["Commission", 70000],
    ["Escrow", 140000],
  ]);
});

for (const [premium, expectedCommission] of [[false, 14000], [true, 7000]]) {
  test(`release 140000 with ${premium ? "premium" : "standard"} commission once`, async (t) => {
    const { state, booking } = setup(t, premium);
    const result = await releaseBookingFunds(booking);
    assert.equal(result.commission, expectedCommission);
    assert.equal(state.systemBalance, 0);
    assert.equal(state.adminBalance, expectedCommission);
    assert.equal(state.localBalance, 140000 - expectedCommission);
    assert.deepEqual(state.transactions.map((item) => [item.type, item.walletOwner || "User", item.amount]), [
      ["Earning", "User", 140000 - expectedCommission],
      ["Commission", "Admin", expectedCommission],
      ["Escrow", "System", 140000],
    ]);
    assert.equal(await releaseBookingFunds(booking), false);
  });
}

test("refund returns held funds and records system debit and traveler credit once", async (t) => {
  const { state, booking } = setup(t);
  assert.equal(await refundBookingFunds(booking), true);
  assert.equal(state.systemBalance, 0);
  assert.equal(state.travelerBalance, 140000);
  assert.deepEqual(state.transactions.map((item) => [item.type, item.walletOwner || "User", item.status]), [
    ["Refund", "User", "Completed"],
    ["Escrow", "System", "Refunded"],
  ]);
  assert.equal(await refundBookingFunds(booking), false);
});
