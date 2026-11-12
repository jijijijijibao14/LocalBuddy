const test = require("node:test");
const assert = require("node:assert/strict");
const Booking = require("../models/Booking");
const BuddyProfile = require("../models/BuddyProfile");
const { updateLocalStatus, localMine } = require("./bookingController");
const { updateBooking } = require("./adminController");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("Local booking list includes cancelled bookings after refund", async (t) => {
  const cancelledBooking = { _id: "cancelled-booking", status: "Cancelled", paymentStatus: "Refunded" };
  t.mock.method(BuddyProfile, "findOne", async () => ({ _id: "buddy" }));
  let query;
  t.mock.method(Booking, "find", (filter) => {
    query = filter;
    return {
      populate() { return this; },
      sort: async () => [cancelledBooking],
    };
  });
  const res = response();
  await localMine({ user: { _id: "local-user", role: "local" } }, res);

  assert.deepEqual(query, {
    buddy: "buddy",
    $or: [
      { paymentStatus: "Paid" },
      { status: "Cancelled", paymentStatus: "Refunded" },
    ],
  });
  assert.deepEqual(res.body, [cancelledBooking]);
});

for (const actor of ["local", "admin"]) {
  for (const status of ["Confirmed", "Completed"]) {
    test(`${actor} refuses ${status} for paid booking without held escrow`, async (t) => {
      const booking = {
        _id: "507f1f77bcf86cd799439011",
        status: status === "Confirmed" ? "Pending" : "Confirmed",
        paymentStatus: "Paid",
        escrowStatus: "None",
      };
      if (actor === "local") {
        t.mock.method(BuddyProfile, "findOne", async () => ({ _id: "buddy" }));
        t.mock.method(Booking, "findOne", async () => booking);
      } else {
        t.mock.method(Booking, "findById", async () => booking);
      }
      const update = t.mock.method(Booking, "findOneAndUpdate", async () => {
        throw new Error("unexpected update");
      });
      const res = response();
      const req = {
        user: { _id: "local-user", role: "local" },
        params: { id: booking._id },
        body: { status },
      };
      await (actor === "local" ? updateLocalStatus(req, res) : updateBooking(req, res));
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /chưa được giữ hợp lệ/);
      assert.equal(update.mock.callCount(), 0);
    });

    test(`${actor} atomically requires held payment when updating to ${status}`, async (t) => {
      const booking = {
        _id: "507f1f77bcf86cd799439011",
        buddy: "buddy",
        status: status === "Confirmed" ? "Pending" : "Confirmed",
        paymentStatus: "Paid",
        escrowStatus: "Held",
        date: new Date("2099-01-01T00:00:00Z"),
        startTime: "10:00",
        endTime: "11:00",
        time: "10:00 - 11:00",
      };
      if (actor === "local") {
        t.mock.method(BuddyProfile, "findOne", async () => ({
          _id: "buddy",
          availability: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00" }],
        }));
        t.mock.method(Booking, "findOne", async () => booking);
        if (status === "Confirmed") {
          t.mock.method(Booking, "find", () => ({ select: async () => [] }));
        }
      } else {
        t.mock.method(Booking, "findById", async () => booking);
        if (status === "Confirmed") {
          t.mock.method(Booking, "findOne", async () => null);
          t.mock.method(BuddyProfile, "findById", async () => ({ verified: true, active: true }));
        }
      }
      const update = t.mock.method(Booking, "findOneAndUpdate", async () => null);
      const res = response();
      const req = {
        user: { _id: "local-user", role: "local" },
        params: { id: booking._id },
        body: { status },
      };
      await (actor === "local" ? updateLocalStatus(req, res) : updateBooking(req, res));
      assert.equal(res.statusCode, 409);
      assert.equal(update.mock.calls[0].arguments[0].paymentStatus, "Paid");
      assert.equal(update.mock.calls[0].arguments[0].escrowStatus, "Held");
    });
  }
}
