const test = require("node:test");
const assert = require("node:assert/strict");
const UploadedFile = require("../models/UploadedFile");
const { getMedia } = require("./mediaController");

function response() {
  return {
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    type(value) { this.contentType = value; return this; },
    send(value) { this.body = value; return this; },
    sendStatus(value) { this.statusCode = value; return this; },
  };
}

test("retrieves saved file bytes and content type", async (t) => {
  t.mock.method(UploadedFile, "findById", () => ({
    select: async () => ({ contentType: "image/png", data: Buffer.from("image") }),
  }));
  const res = response();
  await getMedia({ params: { id: "0123456789abcdef01234567" } }, res, (error) => { throw error; });
  assert.equal(res.contentType, "image/png");
  assert.equal(res.body.toString(), "image");
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
});

test("missing and invalid file IDs return 404", async (t) => {
  t.mock.method(UploadedFile, "findById", () => ({ select: async () => null }));
  for (const id of ["bad", "0123456789abcdef01234567"]) {
    const res = response();
    await getMedia({ params: { id } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 404);
  }
});
