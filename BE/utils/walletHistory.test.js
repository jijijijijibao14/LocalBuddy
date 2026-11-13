const test = require("node:test");
const assert = require("node:assert/strict");
const { transactionHistoryFilter } = require("./walletHistory");

test("traveler history is restricted to their own wallet payments and refunds", () => {
  assert.deepEqual(transactionHistoryFilter({ role: "traveler", _id: "traveler-1" }), {
    user: "traveler-1",
    walletOwner: { $in: ["User", null] },
    type: { $in: ["TopUp", "Withdrawal", "Booking", "Refund"] },
  });
});

test("local history excludes traveler payments and system entries", () => {
  assert.deepEqual(transactionHistoryFilter({ role: "local", _id: "local-1" }), {
    user: "local-1",
    walletOwner: { $in: ["User", null] },
    type: { $in: ["TopUp", "Withdrawal", "Earning"] },
  });
});

test("admin history contains only system and shared admin wallet activity", () => {
  assert.deepEqual(transactionHistoryFilter({ role: "admin", _id: "admin-1" }), {
    $or: [
      { walletOwner: "System", type: { $in: ["Escrow", "Earning"] } },
      { walletOwner: "Admin", type: "Commission" },
      { walletOwner: "Admin", type: "Withdrawal" },
    ],
  });
  assert.throws(() => transactionHistoryFilter({ role: "other" }));
});

test("history filters isolate accounts and admin wallet owners", () => {
  const records = [
    { user: "traveler-1", type: "TopUp", walletOwner: "User" },
    { user: "traveler-2", type: "TopUp", walletOwner: "User" },
    { user: "traveler-1", type: "Booking", walletOwner: "User" },
    { user: "traveler-1", type: "Escrow", walletOwner: "System" },
    { user: "local-1", type: "Earning", walletOwner: "System", status: "Pending" },
    { user: "local-1", type: "Earning", walletOwner: "User" },
    { user: "local-2", type: "Withdrawal", walletOwner: "User" },
    { user: "admin-2", type: "Withdrawal", walletOwner: "Admin" },
    { user: "admin-1", type: "Commission", walletOwner: "Admin" },
  ];
  const matches = (record, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some((branch) => matches(record, branch));
    if (value && value.$in) return value.$in.includes(record[key] ?? null);
    return record[key] === value;
  });
  const select = (role, _id) => records.filter((record) => matches(record, transactionHistoryFilter({ role, _id })));
  assert.deepEqual(select("traveler", "traveler-1"), [records[0], records[2]]);
  assert.deepEqual(select("local", "local-1"), [records[5]]);
  assert.deepEqual(select("admin", "admin-1"), [records[3], records[4], records[7], records[8]]);
});
