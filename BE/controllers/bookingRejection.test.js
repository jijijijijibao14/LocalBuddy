const test = require("node:test");
const assert = require("node:assert/strict");
const Booking = require("../models/Booking");
const BuddyProfile = require("../models/BuddyProfile");
const Refund = require("../models/Refund");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const WalletSettings = require("../models/WalletSettings");
const { localMine } = require("./bookingController");
const { cancelByLocalOrAdmin } = require("./refundController");

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

test("Local booking history query includes cancelled bookings awaiting refund", async (t) => {
  const rows = [{ _id: "cancelled-booking", status: "Cancelled", paymentStatus: "RefundPending" }];
  const populatedPaths = [];
  const query = {
    populate(path) {
      populatedPaths.push(path);
      return this;
    },
    sort: async () => rows,
  };
  t.mock.method(BuddyProfile, "findOne", async () => ({ _id: "buddy" }));
  const findBookings = t.mock.method(Booking, "find", () => query);
  const res = response();

  await localMine({ user: { _id: "local-user", role: "local" } }, res);

  assert.deepEqual(res.body, rows);
  assert.deepEqual(findBookings.mock.calls[0].arguments[0], {
    buddy: "buddy",
    $or: [
      { paymentStatus: "Paid" },
      { status: "Cancelled" },
    ],
  });
  assert(populatedPaths.includes("refundRequestId"));
});

test("Local rejection immediately refunds a Wallet booking and records it as refunded", async (t) => {
  const bookingId = "507f1f77bcf86cd799439011";
  const actor = { _id: "local-user", role: "local" };
  const refund = { _id: "refund-id", amount: 1000, percentage: 100, reason: "Hủy bởi Local" };
  const settledRefund = { ...refund, status: "REFUNDED" };
  const updatedBooking = {
    _id: bookingId,
    customer: "traveler",
    price: 1000,
    status: "Cancelled",
    paymentStatus: "RefundPending",
    paymentMethod: "Wallet",
    escrowStatus: "Held",
    constructor: Booking,
  };
  const booking = {
    ...updatedBooking,
    status: "Pending",
    paymentStatus: "Paid",
    cancellationReason: "",
  };

  t.mock.method(Refund, "create", async () => refund);
  t.mock.method(Refund, "findOneAndUpdate", async () => settledRefund);
  t.mock.method(Booking, "findOneAndUpdate", async () => updatedBooking);
  t.mock.method(Transaction, "findOne", async () => null);
  t.mock.method(Transaction, "create", async () => []);
  t.mock.method(User, "updateOne", async () => ({ matchedCount: 1 }));
  t.mock.method(WalletSettings, "findOneAndUpdate", async () => ({ _id: "settings" }));
  t.mock.method(WalletSettings, "updateOne", async () => ({ modifiedCount: 1 }));

  const result = await cancelByLocalOrAdmin(booking, actor);

  assert.equal(result.booking.status, "Cancelled");
  assert.equal(result.refund.status, "REFUNDED");
  assert.equal(result.refund.amount, booking.price);
});

test("Local cancellation of a confirmed Wallet booking waits for Admin approval", async (t) => {
  const refund = {
    _id: "refund-id",
    amount: 1000,
    percentage: 100,
    reason: "Local yêu cầu hủy chuyến: Có việc đột xuất",
    status: "PENDING",
  };
  const updatedBooking = {
    _id: "507f1f77bcf86cd799439011",
    customer: "traveler",
    price: 1000,
    status: "Cancelled",
    paymentStatus: "RefundPending",
    paymentMethod: "Wallet",
    escrowStatus: "Held",
  };
  const booking = {
    ...updatedBooking,
    status: "Confirmed",
    paymentStatus: "Paid",
    cancellationReason: "",
  };

  t.mock.method(Refund, "create", async () => refund);
  const updateRefund = t.mock.method(Refund, "findOneAndUpdate", async () => {
    throw new Error("confirmed Local cancellations must not be automatically settled");
  });
  t.mock.method(Booking, "findOneAndUpdate", async () => updatedBooking);

  const result = await cancelByLocalOrAdmin(
    booking,
    { _id: "local-user", role: "local" },
    "Có việc đột xuất",
  );

  assert.equal(result.booking.paymentStatus, "RefundPending");
  assert.equal(result.refund.status, "PENDING");
  assert.equal(result.refund.percentage, 100);
  assert.equal(result.refund.reason, "Local yêu cầu hủy chuyến: Có việc đột xuất");
  assert.equal(updateRefund.mock.callCount(), 0);
});
