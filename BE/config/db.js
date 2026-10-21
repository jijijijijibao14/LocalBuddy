const mongoose = require("mongoose");
async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Thiếu MONGODB_URI trong file .env");
  await mongoose.connect(uri);
  console.log("MongoDB connected:", mongoose.connection.name);
}
module.exports = connectDB;
