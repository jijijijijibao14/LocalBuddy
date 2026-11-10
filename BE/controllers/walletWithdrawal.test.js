const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/User");
const WalletSettings = require("../models/WalletSettings");
const Transaction = require("../models/Transaction");
const { requestWithdrawal } = require("./walletController");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

for (const role of ["traveler", "local", "admin"]) {
  test(`${role} withdrawal completes immediately and debits correct wallet`, async (t) => {
    const records = [];
    if (role === "admin") {
      t.mock.method(WalletSettings, "findOneAndUpdate", async (filter, update) => {
        if (filter.key) return { _id: "settings" };
        assert.deepEqual(update.$inc, { adminBalance: -50000 });
        return { adminBalance: 90000 };
      });
    } else {
      t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
        assert.equal(filter._id, "user");
        assert.deepEqual(update.$inc, { walletBalance: -50000 });
        return { _id: "user", walletBalance: 90000 };
      });
    }
    t.mock.method(Transaction, "create", async (record) => { records.push(record); return record; });
    const res = response();
    await requestWithdrawal({
      user: { _id: "user", role },
      body: { amount: 50000, bankName: "BIDV", accountNumber: "123456789" },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.balance, 90000);
    assert.equal(records[0].status, "Completed");
    assert.equal(records[0].walletOwner, role === "admin" ? "Admin" : "User");
    assert.equal(records[0].withdrawalDetails.bankName, "BIDV");
  });
}

test("withdrawal rejects insufficient balance without creating a transaction", async (t) => {
  t.mock.method(User, "findOneAndUpdate", async () => null);
  const create = t.mock.method(Transaction, "create", async () => { throw new Error("unexpected"); });
  const res = response();
  await requestWithdrawal({
    user: { _id: "user", role: "traveler" },
    body: { amount: 50000, bankName: "BIDV", accountNumber: "123456789" },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(create.mock.callCount(), 0);
});

test("withdrawal restores the debit if recording the transaction fails", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(User, "findOneAndUpdate", async () => ({ _id: "user", walletBalance: 90000 }));
  const restore = t.mock.method(User, "updateOne", async () => ({ matchedCount: 1 }));
  t.mock.method(Transaction, "create", async () => { throw new Error("database error"); });
  const res = response();
  await requestWithdrawal({
    user: { _id: "user", role: "local" },
    body: { amount: 50000, bankName: "BIDV", accountNumber: "123456789" },
  }, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(restore.mock.calls[0].arguments, [
    { _id: "user" }, { $inc: { walletBalance: 50000 } },
  ]);
});
