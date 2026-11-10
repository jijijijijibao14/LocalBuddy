import { test } from "node:test";
import assert from "node:assert/strict";
import { filterAccounts, paginate } from "./adminPagination.js";

test("pagination limits each page to five and clamps the current page", () => {
  const items = Array.from({ length: 11 }, (_, i) => i + 1);
  assert.deepEqual(paginate(items, 1).items, [1, 2, 3, 4, 5]);
  assert.deepEqual(paginate(items, 2).items, [6, 7, 8, 9, 10]);
  assert.deepEqual(paginate(items, 9), { page: 3, pageCount: 3, items: [11] });
  assert.deepEqual(paginate([], 3), { page: 1, pageCount: 1, items: [] });
});

test("account filter combines role, name or email, and status", () => {
  const users = [
    { role: "local", fullName: "Anh Nguyen", email: "one@example.com", status: "Active" },
    { role: "local", fullName: "Binh", email: "anh@example.com", status: "Suspended" },
    { role: "traveler", fullName: "Anh", email: "two@example.com", status: "Active" },
  ];
  assert.deepEqual(filterAccounts(users, "local", "ANH", "Active"), [users[0]]);
  assert.deepEqual(filterAccounts(users, "local", "anh@", ""), [users[1]]);
  assert.deepEqual(filterAccounts(users, "traveler", "", ""), [users[2]]);
});
