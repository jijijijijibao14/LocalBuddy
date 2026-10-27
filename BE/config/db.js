const dns = require("dns");
const mongoose = require("mongoose");

// Tránh lỗi querySrv ECONNREFUSED do DNS cục bộ/nhà mạng không phân giải được bản ghi SRV của MongoDB Atlas
try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (err) {
  console.warn("Không thể cấu hình DNS servers:", err.message);
}

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Thiếu MONGODB_URI trong file .env");
  await mongoose.connect(uri);
  console.log("MongoDB host:", mongoose.connection.host);
  console.log("MongoDB database:", mongoose.connection.name);
  console.log("MongoDB connected:", mongoose.connection.name);
}
module.exports = connectDB;
