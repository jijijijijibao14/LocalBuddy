const test = require("node:test");
const assert = require("node:assert/strict");
const { bookingEndInstant, processExpiredBooking } = require("./bookingExpiry");

function fixture(status = "Confirmed", escrowStatus = "Held") {
  const booking = {
    _id: "booking", date: new Date("2026-11-09T00:00:00Z"), startTime: "13:30", endTime: "14:30",
    status, escrowStatus, paymentStatus: escrowStatus === "Held" ? "Paid" : "Unpaid",
  };
  const state = { ...booking };
  const calls = [];
  const dependencies = {
    model: {
      findOneAndUpdate: async (filter, update) => {
        if (state.status !== filter.status) return null;
        Object.assign(state, update.$set);
        return { ...state };
      },
      updateOne: async (filter, update) => {
        if (state.status !== filter.status || state.escrowStatus !== filter.escrowStatus) return { modifiedCount: 0 };
        Object.assign(state, update.$set);
        return { modifiedCount: 1 };
      },
    },
    release: async () => { calls.push("release"); return { commission: 14000 }; },
    refund: async () => { calls.push("refund"); return true; },
  };
  return { booking, state, calls, dependencies };
}

test("booking end uses Vietnam local time", () => {
  const { booking } = fixture();
  assert.equal(bookingEndInstant(booking).toISOString(), "2026-11-09T07:30:00.000Z");
  assert.equal(bookingEndInstant({ ...booking, endTime: "25:00" }), null);
});

test("confirmed booking is settled at end, not before, and only once", async () => {
  const { booking, state, calls, dependencies } = fixture();
  assert.equal(await processExpiredBooking(booking, new Date("2026-11-09T07:29:59Z"), dependencies), false);
  assert.equal(await processExpiredBooking(booking, new Date("2026-11-09T07:30:00Z"), dependencies), true);
  assert.equal(state.status, "Completed");
  assert.deepEqual(calls, ["release"]);
  assert.equal(await processExpiredBooking(booking, new Date("2026-11-09T07:31:00Z"), dependencies), false);
  assert.deepEqual(calls, ["release"]);
});

test("pending paid booking is cancelled and refunded at its start time", async () => {
  const { booking, state, calls, dependencies } = fixture("Pending");
  assert.equal(await processExpiredBooking(booking, new Date("2026-11-09T06:29:59Z"), dependencies), false);
  assert.equal(state.status, "Pending");
  assert.deepEqual(calls, []);
  assert.equal(await processExpiredBooking(booking, new Date("2026-11-09T06:30:00Z"), dependencies), true);
  assert.equal(state.status, "Cancelled");
  assert.deepEqual(calls, ["refund"]);
});

test("expired unpaid booking is cancelled without refund", async () => {
  const { booking, state, calls, dependencies } = fixture("Pending", "None");
  assert.equal(await processExpiredBooking(booking, new Date("2026-11-09T06:30:00Z"), dependencies), true);
  assert.equal(state.status, "Cancelled");
  assert.deepEqual(calls, []);
});

test("settlement errors restore status for retry", async () => {
  const { booking, state, dependencies } = fixture();
  dependencies.release = async () => { throw new Error("ledger error"); };
  await assert.rejects(processExpiredBooking(booking, new Date("2026-11-09T07:30:00Z"), dependencies), /ledger error/);
  assert.equal(state.status, "Confirmed");
});

test("processing payments are skipped and inconsistent paid bookings raise an error", async () => {
  const processing = fixture("Pending", "Processing");
  assert.equal(await processExpiredBooking(processing.booking, new Date("2026-11-09T07:30:00Z"), processing.dependencies), false);
  const invalid = fixture("Pending", "None");
  invalid.booking.paymentStatus = "Paid";
  await assert.rejects(processExpiredBooking(invalid.booking, new Date("2026-11-09T07:30:00Z"), invalid.dependencies), /không khớp/);
});

test("confirmed booking without held escrow is not settled", async () => {
  const { booking, state, calls, dependencies } = fixture("Confirmed", "None");
  booking.paymentStatus = "Paid";
  await assert.rejects(
    processExpiredBooking(booking, new Date("2026-11-09T07:30:00Z"), dependencies),
    /paymentStatus=Paid, escrowStatus=None/,
  );
  assert.equal(state.status, "Confirmed");
  assert.deepEqual(calls, []);
});
