export function normalizeFilterText(value = "") {
  return String(value)
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export function normalizeLanguage(value) {
  const normalized = normalizeFilterText(
    String(value).replace(/\s*\([^)]*\)/g, ""),
  );
  if (["english", "tieng anh", "anh"].includes(normalized)) return "tieng anh";
  if (["vietnamese", "tieng viet", "viet"].includes(normalized))
    return "tieng viet";
  return normalized;
}

function normalizeInterest(value) {
  const normalized = normalizeFilterText(value)
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();
  if (["food", "food and street food", "am thuc"].includes(normalized))
    return "am thuc";
  if (["coffee", "coffee and chill", "ca phe"].includes(normalized))
    return "ca phe";
  if (["travel", "travel and danh lam", "du lich"].includes(normalized))
    return "du lich";
  return normalized;
}

function toMinutes(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) return NaN;
  return hour * 60 + minute;
}

export function matchesAvailability(buddy, date, startTime) {
  if (!date) return true;

  const start = toMinutes(startTime);
  if (!Number.isFinite(start)) return false;
  return (Array.isArray(buddy.availability) ? buddy.availability : []).some(
    (slot) => {
      const slotDate =
        typeof slot.date === "string" ? slot.date.slice(0, 10) : "";
      if (slotDate !== date) return false;
      const slotStart = toMinutes(slot.startTime);
      const slotEnd = toMinutes(slot.endTime);

      return (
        Number.isFinite(slotStart) &&
        Number.isFinite(slotEnd) &&
        slotStart <= start &&
        start < slotEnd
      );
    },
  );
}

export function filterBuddies(buddies, filters) {
  return buddies.filter((buddy) => {
    const interests = [
      ...new Set([...(buddy.interests || []), ...(buddy.categories || [])]),
    ];
    const matchesCategory =
      filters.category === "Tất cả" ||
      interests.some(
        (interest) =>
          normalizeInterest(interest) === normalizeInterest(filters.category),
      );
    const matchesArea =
      filters.area === "Tất cả khu vực" ||
      normalizeFilterText(buddy.area || buddy.user?.city).includes(
        normalizeFilterText(filters.area),
      );
    const matchesLanguage =
      filters.language === "Tất cả ngôn ngữ" ||
      (buddy.languages || []).some(
        (item) => normalizeLanguage(item) === normalizeLanguage(filters.language),
      );
    const matchesPrice =
      filters.maxPrice === "" ||
      Number(
        buddy.pricePerHour ?? Math.round(Number(buddy.price || 0) / 3),
      ) <= Number(filters.maxPrice);

    return (
      matchesCategory &&
      matchesArea &&
      matchesLanguage &&
      matchesPrice &&
      matchesAvailability(buddy, filters.date, filters.startTime)
    );
  });
}
