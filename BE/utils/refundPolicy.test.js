const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateCancellationQuote,
  DEFAULT_CANCELLATION_POLICY,
  isValidCancellationPolicy,
} = require("./refundPolicy");

const booking = {
  date: new Date("2026-12-10T00:00:00.000Z"),
  startTime: "15:00",
  price: 1_000_000,
};
const experienceStart = new Date("2026-12-10T08:00:00.000Z");

test("cancellation quote uses the Da Nang experience start and each exact boundary", () => {
  const cases = [
    { hoursBefore: 6.01, percentage: 100 },
    { hoursBefore: 6, percentage: 75 },
    { hoursBefore: 3, percentage: 75 },
    { hoursBefore: 2.99, percentage: 50 },
    { hoursBefore: 1, percentage: 50 },
    { hoursBefore: 0.99, percentage: 25 },
    { hoursBefore: 0.01, percentage: 25 },
    { hoursBefore: 0, percentage: 0 },
    { hoursBefore: -1, percentage: 0 },
  ];

  for (const { hoursBefore, percentage } of cases) {
    const now = new Date(experienceStart.getTime() - hoursBefore * 3_600_000);
    const quote = calculateCancellationQuote(booking, DEFAULT_CANCELLATION_POLICY, now);
    assert.equal(quote.percentage, percentage, `at ${hoursBefore} hours before start`);
    assert.equal(quote.amount, (booking.price * percentage) / 100);
    assert.equal(quote.hoursUntilExperience, hoursBefore);
  }
});

test("cancellation policy only accepts integer percentages", () => {
  assert.equal(isValidCancellationPolicy(DEFAULT_CANCELLATION_POLICY), true);
  assert.equal(isValidCancellationPolicy({ ...DEFAULT_CANCELLATION_POLICY, underOneHourPercent: 101 }), false);
  assert.equal(isValidCancellationPolicy({ ...DEFAULT_CANCELLATION_POLICY, underOneHourPercent: 25.5 }), false);
  assert.equal(isValidCancellationPolicy({ ...DEFAULT_CANCELLATION_POLICY, oneToThreeHoursPercent: undefined }), false);
});

test("cancellation quote rejects an invalid experience time", () => {
  assert.throws(
    () => calculateCancellationQuote({ ...booking, startTime: "25:00" }, DEFAULT_CANCELLATION_POLICY),
    /Thời gian trải nghiệm không hợp lệ/,
  );
});
