const test = require("node:test");
const assert = require("node:assert/strict");
const Notification = require("../models/Notification");
const { listMine } = require("./notificationController");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

for (const role of ["traveler", "local", "admin"]) {
  test(`${role} notifications return ten rows and page metadata`, async (t) => {
    let queryFilter;
    let skip;
    let limit;
    t.mock.method(Notification, "countDocuments", async (filter) =>
      filter.readAt === null ? 29 : 85,
    );
    t.mock.method(Notification, "find", (filter) => {
      queryFilter = filter;
      return {
        sort() { return this; },
        skip(value) { skip = value; return this; },
        limit(value) {
          limit = value;
          return Promise.resolve(Array.from({ length: value }, (_, index) => ({ index })));
        },
      };
    });

    const res = response();
    await listMine({
      query: { page: "5" },
      user: { _id: `${role}-id`, role },
    }, res);

    assert.deepEqual(queryFilter, {
      recipient: `${role}-id`,
      ...(role === "admin" ? { type: "first_login" } : {}),
    });
    assert.equal(skip, 40);
    assert.equal(limit, 10);
    assert.equal(res.body.notifications.length, 10);
    assert.equal(res.body.page, 5);
    assert.equal(res.body.pageCount, 9);
    assert.equal(res.body.totalCount, 85);
    assert.equal(res.body.unreadCount, 29);
  });
}
