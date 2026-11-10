const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/User");
const BuddyProfile = require("../models/BuddyProfile");
const UploadedFile = require("../models/UploadedFile");
const { updateMyProfile } = require("./userController");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function localUser() {
  return {
    _id: "local-1",
    role: "local",
    fullName: "Local",
    phone: "0912345678",
    city: "Sơn Trà",
    areas: ["Sơn Trà"],
    bio: "Hello",
    languages: ["Tiếng Việt"],
    interests: ["du lịch"],
    avatar: "/uploads/avatar.jpg",
    profilePhotos: ["/uploads/one.jpg", "/uploads/two.jpg"],
    languageCertificates: [{ language: "Tiếng Việt", certificateUrl: "" }],
    async save() {},
  };
}

test("stores a certificate in MongoDB and syncs its URL", async (t) => {
  const user = localUser();
  t.mock.method(User, "findById", async () => user);
  const create = t.mock.method(UploadedFile, "create", async () => ({ _id: "aaaaaaaaaaaaaaaaaaaaaaaa" }));
  const sync = t.mock.method(BuddyProfile, "findOneAndUpdate", async () => ({}));
  const res = response();
  await updateMyProfile({
    user: { _id: user._id },
    body: {},
    files: [{ fieldname: "certificate_0", originalname: "cert.pdf", buffer: Buffer.from("pdf") }],
    protocol: "https",
    get: () => "api.example.com",
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(create.mock.calls[0].arguments[0].contentType, "application/pdf");
  assert.equal(res.body.user.languageCertificates[0].certificateUrl, "https://api.example.com/media/aaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(sync.mock.calls[0].arguments[1].$set.languageCertificates[0].certificateUrl, "https://api.example.com/media/aaaaaaaaaaaaaaaaaaaaaaaa");
});

test("deletes unreferenced MongoDB media owned by the user after saving", async (t) => {
  const user = localUser();
  user.avatar = "https://api.example.com/media/0123456789abcdef01234567";
  t.mock.method(User, "findById", async () => user);
  t.mock.method(BuddyProfile, "findOneAndUpdate", async () => ({}));
  const remove = t.mock.method(UploadedFile, "deleteMany", async () => ({}));
  const res = response();
  await updateMyProfile({ user: { _id: user._id }, body: { avatar: "" }, files: [] }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(remove.mock.calls[0].arguments[0], {
    _id: { $in: ["0123456789abcdef01234567"] }, owner: user._id,
  });
});

test("cleans up new media if saving the user fails", async (t) => {
  const user = localUser();
  user.save = async () => { throw new Error("save failed"); };
  t.mock.method(console, "error", () => {});
  t.mock.method(User, "findById", async () => user);
  t.mock.method(UploadedFile, "create", async () => ({ _id: "aaaaaaaaaaaaaaaaaaaaaaaa" }));
  const remove = t.mock.method(UploadedFile, "deleteMany", async () => ({}));
  const res = response();
  await updateMyProfile({
    user: { _id: user._id }, body: {},
    files: [{ fieldname: "avatarFile", originalname: "new.jpg", buffer: Buffer.from("photo") }],
    protocol: "http", get: () => "localhost:3001",
  }, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(remove.mock.calls[0].arguments[0], {
    _id: { $in: ["aaaaaaaaaaaaaaaaaaaaaaaa"] }, owner: user._id,
  });
});

for (const scenario of [
  {
    name: "removes avatar and all photos and syncs buddy profile",
    body: { avatar: "", profilePhotos: "[]" },
    files: [],
    avatar: "",
    photos: [],
  },
  {
    name: "removes one photo and appends a new photo",
    body: { profilePhotos: JSON.stringify(["/uploads/two.jpg"]) },
    files: [{ fieldname: "profilePhotoFiles", originalname: "new.jpg", buffer: Buffer.from("photo") }],
    avatar: "/uploads/avatar.jpg",
    photos: ["/uploads/two.jpg", "http://localhost:3001/media/aaaaaaaaaaaaaaaaaaaaaaaa"],
  },
  {
    name: "keeps photos when no removal is requested",
    body: { bio: "Updated" },
    files: [],
    avatar: "/uploads/avatar.jpg",
    photos: ["/uploads/one.jpg", "/uploads/two.jpg"],
  },
  {
    name: "replaces an avatar after removing the old one",
    body: { avatar: "" },
    files: [{ fieldname: "avatarFile", originalname: "new.jpg", buffer: Buffer.from("photo") }],
    avatar: "http://localhost:3001/media/aaaaaaaaaaaaaaaaaaaaaaaa",
    photos: ["/uploads/one.jpg", "/uploads/two.jpg"],
  },
]) {
  test(scenario.name, async (t) => {
    const user = localUser();
    t.mock.method(User, "findById", async () => user);
    const create = t.mock.method(UploadedFile, "create", async () => ({ _id: "aaaaaaaaaaaaaaaaaaaaaaaa" }));
    const sync = t.mock.method(BuddyProfile, "findOneAndUpdate", async () => ({}));
    const res = response();
    await updateMyProfile({
      user: { _id: user._id },
      body: scenario.body,
      files: scenario.files,
      protocol: "http",
      get: () => "localhost:3001",
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.avatar, scenario.avatar);
    assert.deepEqual(res.body.user.profilePhotos, scenario.photos);
    assert.equal(sync.mock.calls[0].arguments[1].$set.coverImage, scenario.avatar);
    assert.deepEqual(sync.mock.calls[0].arguments[1].$set.photos, scenario.photos);
    if (scenario.files.length) {
      assert.equal(create.mock.calls[0].arguments[0].data.toString(), "photo");
      assert.equal(create.mock.calls[0].arguments[0].contentType, "image/jpeg");
    }
  });
}
