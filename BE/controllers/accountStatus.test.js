const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const BuddyProfile = require("../models/BuddyProfile");
const { login } = require("./authController");
const { updateUser } = require("./adminController");
const { protect } = require("../middleware/auth");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

for (const role of ["local", "traveler"]) {
  for (const status of ["Active", "Suspended"]) {
    test(`${role} can only log in when active: ${status}`, async (t) => {
      const user = { _id: "user-1", role, status, password: "hash" };
      t.mock.method(User, "findOne", () => ({ select: async () => user }));
      t.mock.method(bcrypt, "compare", async () => true);
      t.mock.method(jwt, "sign", () => "token");
      const res = response();
      await login({ body: { email: "user@example.test", password: "password" } }, res);
      assert.equal(res.statusCode, status === "Active" ? 200 : 403);
      assert.equal(res.body.token, status === "Active" ? "token" : undefined);
    });

    test(`admin can set ${role} to ${status}`, async (t) => {
      const updated = { _id: "user-1", role, status };
      const update = t.mock.method(User, "findByIdAndUpdate", () => ({
        select: async () => updated,
      }));
      const sync = t.mock.method(BuddyProfile, "findOneAndUpdate", async () => ({}));
      const res = response();
      await updateUser({ user: { _id: "admin-1" }, params: { id: "user-1" }, body: { status } }, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(update.mock.calls[0].arguments[1], { status });
      assert.equal(sync.mock.callCount(), role === "local" ? 1 : 0);
      if (role === "local") {
        assert.deepEqual(sync.mock.calls[0].arguments[1], { active: status === "Active" });
      }
    });
  }
}

for (const status of ["Pending Approval", "Rejected", "invalid"]) {
  test(`admin cannot set status to ${status}`, async (t) => {
    const update = t.mock.method(User, "findByIdAndUpdate", () => {
      throw new Error("unexpected update");
    });
    const res = response();
    await updateUser({ user: { _id: "admin-1" }, params: { id: "user-1" }, body: { status } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(update.mock.callCount(), 0);
  });
}

test("suspension blocks an existing token from protected API routes", async (t) => {
  t.mock.method(jwt, "verify", () => ({ id: "user-1" }));
  t.mock.method(User, "findById", async () => ({ status: "Suspended" }));
  const res = response();
  let called = false;
  await protect({ headers: { authorization: "Bearer token" } }, res, () => { called = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});
