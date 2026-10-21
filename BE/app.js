require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const seedAdmin = require("./seedAdmin");
const app = express();

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`CLIENT_URL không phải URL hợp lệ: ${value}`);
  }
}

// CLIENT_URL accepts a comma-separated list of frontend origins.
const allowedOrigins = new Set([
  "http://localhost:5173",
  ...(process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin),
]);

// Cấu hình CORS
app.use(cors({
  origin: function (origin, callback) {
    // Cho phép request không có Origin và domain đã được cho phép
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    return callback(new Error("Origin không được phép truy cập API"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(morgan("dev"));
// Route gốc: kiểm tra backend khi mở URL Render
app.get("/", (req, res) => {
  res.json({
    message: "Local Buddy API is running",
    health: "/api/health"
  });
});
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "Local Buddy API" }),
);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/buddies", require("./routes/buddyRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use((req, res) =>
  res.status(404).json({ message: "API endpoint không tồn tại." }),
);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Lỗi máy chủ nội bộ." });
});

const port = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDB();
    console.log("MongoDB connected successfully");

    await seedAdmin();

    app.listen(port, () => {
      console.log(`Local Buddy API listening on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Không thể khởi động server:", err.message);
    process.exit(1);
  }
}

startServer();
