const DA_NANG_TIME_ZONE = "Asia/Ho_Chi_Minh";

function getDaNangDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DA_NANG_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function availabilityInstant(date, time) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof time !== "string" ||
    !/^\d{2}:\d{2}$/.test(time)
  ) {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  return new Date(`${date}T${time}:00+07:00`);
}

function isAvailabilityFuture(slot, now = new Date()) {
  const end = availabilityInstant(slot?.date, slot?.endTime);
  return end !== null && end > now;
}

function filterFutureAvailability(availability, now = new Date()) {
  return (Array.isArray(availability) ? availability : []).filter((slot) =>
    isAvailabilityFuture(slot, now),
  );
}

module.exports = {
  availabilityInstant,
  filterFutureAvailability,
  getDaNangDate,
};
