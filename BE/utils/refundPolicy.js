const { availabilityInstant } = require("./availability");

const DEFAULT_CANCELLATION_POLICY = {
  overSixHoursPercent: 100,
  threeToSixHoursPercent: 75,
  oneToThreeHoursPercent: 50,
  underOneHourPercent: 25,
};

function calculateCancellationQuote(booking, policy, now = new Date()) {
  const start = availabilityInstant(
    booking.date instanceof Date
      ? booking.date.toISOString().slice(0, 10)
      : String(booking.date || "").slice(0, 10),
    booking.startTime,
  );
  if (!start) throw new Error("Thời gian trải nghiệm không hợp lệ.");

  const hoursUntilExperience = (start.getTime() - now.getTime()) / 3_600_000;
  const percentage = hoursUntilExperience > 6
    ? policy.overSixHoursPercent
    : hoursUntilExperience >= 3
      ? policy.threeToSixHoursPercent
      : hoursUntilExperience >= 1
        ? policy.oneToThreeHoursPercent
        : hoursUntilExperience > 0
          ? policy.underOneHourPercent
          : 0;

  return {
    percentage,
    amount: Math.round((booking.price * percentage) / 100),
    hoursUntilExperience,
  };
}

function isValidCancellationPolicy(policy) {
  return [
    policy.overSixHoursPercent,
    policy.threeToSixHoursPercent,
    policy.oneToThreeHoursPercent,
    policy.underOneHourPercent,
  ].every((value) => Number.isInteger(value) && value >= 0 && value <= 100);
}

module.exports = {
  DEFAULT_CANCELLATION_POLICY,
  calculateCancellationQuote,
  isValidCancellationPolicy,
};
