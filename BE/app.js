require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const seedAdmin = require("./seedAdmin");
const User = require("./models/User");
const Message = require("./models/Message");
const { buildRoomId, validateMessageContent } = require("./utils/chatUtils");

const app = express();
const httpServer = http.createServer(app);

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
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
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
app.use("/api/wallet", require("./routes/walletRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));

app.use((req, res) =>
  res.status(404).json({ message: "API endpoint không tồn tại." }),
);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Lỗi máy chủ nội bộ." });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
        return callback(null, true);
      }
      callback(new Error("Socket: Origin không được phép."));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware xác thực Socket.IO bằng JWT
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");
    if (!token) return next(new Error("Chưa xác thực."));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      "fullName avatar role status"
    );
    if (!user || user.status !== "Active")
      return next(new Error("Tài khoản không hoạt động."));

    socket.user = user;
    next();
  } catch {
    next(new Error("Token không hợp lệ."));
  }
});

io.on("connection", (socket) => {
  const { _id: userId, role, fullName } = socket.user;
  console.log(`[Socket] ${fullName} (${role}) kết nối – ${socket.id}`);

  // Tham gia phòng cá nhân để nhận thông báo riêng
  socket.join(String(userId));

  // ── Tham gia phòng chat với user khác ────────────────────────────────────
  socket.on("join_room", ({ otherUserId }) => {
    if (!otherUserId) return;
    const roomId = buildRoomId(userId, otherUserId);
    socket.join(roomId);
    console.log(`[Socket] ${fullName} tham gia phòng ${roomId}`);
  });

  // ── Rời phòng chat ────────────────────────────────────────────────────────
  socket.on("leave_room", ({ otherUserId }) => {
    if (!otherUserId) return;
    const roomId = buildRoomId(userId, otherUserId);
    socket.leave(roomId);
  });

  // ── Gửi tin nhắn realtime ─────────────────────────────────────────────────
  socket.on("send_message", async ({ otherUserId, content }, ack) => {
    try {
      // Validation nội dung
      const validation = validateMessageContent(content);
      if (!validation.valid) {
        if (typeof ack === "function")
          ack({ error: validation.reason });
        return;
      }

      // Kiểm tra user kia
      const otherUser = await User.findById(otherUserId).select("role status");
      if (!otherUser || otherUser.status !== "Active") {
        if (typeof ack === "function")
          ack({ error: "Người dùng không tồn tại." });
        return;
      }

      // Xác định traveler / local
      let travelerId, localId;
      if (role === "traveler") {
        if (otherUser.role !== "local") {
          if (typeof ack === "function")
            ack({ error: "Bạn chỉ có thể chat với Local Buddy." });
          return;
        }
        travelerId = userId;
        localId = otherUserId;
      } else if (role === "local") {
        if (otherUser.role !== "traveler") {
          if (typeof ack === "function")
            ack({ error: "Bạn chỉ có thể chat với Traveler." });
          return;
        }
        travelerId = otherUserId;
        localId = userId;
      } else {
        if (typeof ack === "function")
          ack({ error: "Admin không dùng tính năng chat này." });
        return;
      }

      const roomId = buildRoomId(travelerId, localId);

      // Lưu vào DB
      const msg = await Message.create({
        roomId,
        sender: userId,
        traveler: travelerId,
        local: localId,
        content: content.trim(),
      });
      await msg.populate("sender", "fullName avatar role");

      const payload = {
        _id: msg._id,
        roomId: msg.roomId,
        sender: msg.sender,
        content: msg.content,
        read: msg.read,
        createdAt: msg.createdAt,
      };

      // Phát đến cả phòng (bao gồm người gửi trên các tab khác)
      io.to(roomId).emit("new_message", payload);

      // Thông báo cho user kia nếu họ chưa ở trong phòng (dùng phòng cá nhân)
      io.to(String(otherUserId)).emit("new_message_notification", {
        roomId,
        from: { _id: userId, fullName, role },
        preview: content.trim().slice(0, 80),
        createdAt: msg.createdAt,
      });

      if (typeof ack === "function") ack({ ok: true, message: payload });
    } catch (err) {
      console.error("[Socket] send_message error:", err);
      if (typeof ack === "function")
        ack({ error: "Lỗi máy chủ, vui lòng thử lại." });
    }
  });

  // ── Đang nhập (typing indicator) ─────────────────────────────────────────
  socket.on("typing", ({ otherUserId, isTyping }) => {
    if (!otherUserId) return;
    const roomId = buildRoomId(userId, otherUserId);
    socket.to(roomId).emit("user_typing", {
      userId: String(userId),
      fullName,
      isTyping: Boolean(isTyping),
    });
  });

  // ── Đánh dấu đã đọc ──────────────────────────────────────────────────────
  socket.on("mark_read", async ({ otherUserId }) => {
    if (!otherUserId) return;
    const roomId = buildRoomId(userId, otherUserId);
    await Message.updateMany(
      { roomId, sender: otherUserId, read: false },
      { read: true }
    ).catch(console.error);
    // Thông báo cho người gửi rằng tin đã được đọc
    io.to(String(otherUserId)).emit("messages_read", { roomId });
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] ${fullName} ngắt kết nối`);
  });
});

// ─── Khởi động server ────────────────────────────────────────────────────────
const port = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDB();
    console.log("MongoDB connected successfully");

    await seedAdmin();

    httpServer.listen(port, () => {
      console.log(`Local Buddy API listening on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Không thể khởi động server:", err.message);
    process.exit(1);
  }
}

startServer();
