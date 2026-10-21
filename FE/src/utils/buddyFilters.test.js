import assert from "node:assert/strict";
import test from "node:test";
import {
  filterBuddies,
  matchesAvailability,
  normalizeLanguage,
} from "./buddyFilters.js";

test("normalizes English label variants to one language", () => {
  assert.equal(normalizeLanguage("English (Fluent)"), "tieng anh");
  assert.equal(normalizeLanguage("Tiếng Anh"), "tieng anh");
  assert.equal(normalizeLanguage("English"), "tieng anh");
});

test("matches Local profile fields and start time without considering duration", () => {
  const buddy = {
    area: "Sơn Trà, Đà Nẵng",
    interests: [],
    categories: ["Food & Street Food"],
    languages: ["English (Fluent)"],
    pricePerHour: 100000,
    availability: [
      { date: "2026-10-22", startTime: "09:00", endTime: "10:00" },
    ],
  };

  assert.equal(
    filterBuddies([buddy], {
      category: "Ẩm thực",
      area: "Sơn Trà",
      language: "Tiếng Anh",
      maxPrice: "",
      date: "2026-10-22",
      startTime: "09:00",
    }).length,
    1,
  );
});

test("requires selected start time to fall inside the Local availability interval", () => {
  const buddy = {
    availability: [
      { date: "2026-10-22", startTime: "09:00", endTime: "10:00" },
    ],
  };

  assert.equal(matchesAvailability(buddy, "2026-10-22", "09:59"), true);
  assert.equal(matchesAvailability(buddy, "2026-10-22", "10:00"), false);
  assert.equal(matchesAvailability(buddy, "2026-10-23", "09:00"), false);
});
