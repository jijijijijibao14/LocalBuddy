const test = require("node:test");
const assert = require("node:assert/strict");
const Booking = require("../models/Booking");
const BuddyProfile = require("../models/BuddyProfile");
const { saveFeedback, saveReply } = require("./feedbackController");

const travelerId = "507f1f77bcf86cd799439011";
const localId = "507f1f77bcf86cd799439012";
const buddyId = "507f1f77bcf86cd799439013";

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeBooking() {
  const booking = new Booking({
    customer: travelerId,
    buddy: buddyId,
    date: new Date("2026-01-01"),
    time: "10:00 - 11:00",
    startTime: "10:00",
    endTime: "11:00",
    durationHours: 1,
    guestCount: 1,
    price: 100000,
    status: "Completed",
  });
  booking.save = async () => booking;
  return booking;
}

function mockCompletedBooking(t, booking) {
  t.mock.method(Booking, "findOne", () => ({
    populate: async () => booking,
  }));
}

test("each participant can create one feedback and edit it", async (t) => {
  const booking = makeBooking();
  mockCompletedBooking(t, booking);
  const req = {
    params: { id: String(booking._id) },
    user: { _id: travelerId, role: "traveler", fullName: "Traveler" },
    body: { rating: 5, comment: "Rất tuyệt" },
  };
  const firstResponse = response();
  await saveFeedback(req, firstResponse);
  assert.equal(firstResponse.statusCode, 200);
  assert.equal(firstResponse.body.feedback.length, 1);

  req.body = { rating: 4, comment: "Đã chỉnh sửa" };
  const editResponse = response();
  await saveFeedback(req, editResponse);
  assert.equal(editResponse.body.feedback.length, 1);
  assert.equal(editResponse.body.feedback[0].rating, 4);
  assert.equal(editResponse.body.feedback[0].comment, "Đã chỉnh sửa");
});

test("feedback reply can be edited without creating a second feedback", async (t) => {
  const booking = makeBooking();
  booking.feedback.push({
    author: travelerId,
    authorRole: "traveler",
    rating: 5,
    comment: "Rất tuyệt",
  });
  mockCompletedBooking(t, booking);
  t.mock.method(BuddyProfile, "findOne", () => ({
    select: async () => ({ _id: buddyId }),
  }));
  const feedbackId = String(booking.feedback[0]._id);
  const req = {
    params: { id: String(booking._id), feedbackId },
    user: { _id: localId, role: "local", fullName: "Local" },
    body: { reply: "Cảm ơn bạn" },
  };
  const firstResponse = response();
  await saveReply(req, firstResponse);
  assert.equal(firstResponse.body.feedback.length, 1);
  assert.equal(firstResponse.body.feedback[0].reply, "Cảm ơn bạn");

  req.body.reply = "Cảm ơn bạn đã chỉnh sửa";
  const editResponse = response();
  await saveReply(req, editResponse);
  assert.equal(editResponse.body.feedback.length, 1);
  assert.equal(editResponse.body.feedback[0].reply, "Cảm ơn bạn đã chỉnh sửa");
});
