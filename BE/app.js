require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const { getMedia } = require("./controllers/mediaController");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const seedAdmin = require("./seedAdmin");
const User = require("./models/User");
const Message = require("./models/Message");
const { buildRoomId, validateMessageContent } = require("./utils/chatUtils");
const { startBookingExpiryWorker } = require("./utils/bookingExpiry");

const app = express();
if (process.env.RENDER === "true") app.set("trust proxy", 1);
const httpServer = http.createServer(app);

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`CLIENT_URL không phải URL hợp lệ: ${value}`);
  }
}

// CLIENT_URL chấp nhận danh sách các nguồn gốc frontend được phân cách bằng dấu phẩy.
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
app.get("/media/:id", getMedia);
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
app.set("io", io);

io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");
    if (!token) return next(new Error("Chưa xác thực."));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      "fullName avatar role status",
    );
    if (!user || user.status !== "Active") {
      return next(new Error("Tài khoản không hoạt động."));
    }

    socket.user = user;
    next();
  } catch {
    next(new Error("Token không hợp lệ."));
  }
});

io.on("connection", (socket) => {
  const { _id: userId, role, fullName } = socket.user;
  console.log(`[Socket] ${fullName} (${role}) kết nối – ${socket.id}`);
  socket.join(String(userId));

  const canChatWith = async (otherUserId) => {
    const otherUser = await User.findById(otherUserId).select("role status");
    if (!otherUser || otherUser.status !== "Active") return false;
    return role === "admin"
      ? otherUser.role !== "admin"
      : otherUser.role === "admin" ||
          (role === "traveler" && otherUser.role === "local") ||
          (role === "local" && otherUser.role === "traveler");
  };

  socket.on("join_room", async ({ otherUserId } = {}) => {
    if (!otherUserId || !(await canChatWith(otherUserId))) return;
    socket.join(buildRoomId(userId, otherUserId));
  });

  socket.on("leave_room", ({ otherUserId } = {}) => {
    if (otherUserId) socket.leave(buildRoomId(userId, otherUserId));
  });

  socket.on("send_message", async ({ otherUserId, content, replyTo } = {}, ack) => {
    try {
      const validation = validateMessageContent(content);
      if (!validation.valid) {
        if (typeof ack === "function") ack({ error: validation.reason });
        return;
      }
      if (!otherUserId || !(await canChatWith(otherUserId))) {
        if (typeof ack === "function") {
          ack({ error: "Bạn không thể chat với tài khoản này." });
        }
        return;
      }

      const travelerId =
        role === "admin" ? otherUserId : role === "traveler" ? userId : otherUserId;
      const localId =
        role === "admin" ? userId : role === "local" ? userId : otherUserId;
      const roomId = buildRoomId(travelerId, localId);

      if (replyTo) {
        const parent = await Message.findOne({ _id: replyTo, roomId }).select("_id");
        if (!parent) {
          if (typeof ack === "function") {
            ack({ error: "Tin nhắn được trả lời không thuộc cuộc trò chuyện này." });
          }
          return;
        }
      }

      const message = await Message.create({
        roomId,
        sender: userId,
        traveler: travelerId,
        local: localId,
        participants: [userId, otherUserId],
        content: content.trim(),
        ...(replyTo ? { replyTo } : {}),
      });
      await message.populate("sender", "fullName avatar role");

      const payload = {
        _id: message._id,
        roomId: message.roomId,
        sender: message.sender,
        content: message.content,
        replyTo: message.replyTo,
        read: message.read,
        createdAt: message.createdAt,
      };
      io.to(roomId).emit("new_message", payload);
      io.to(String(otherUserId)).emit("new_message_notification", {
        roomId,
        from: { _id: userId, fullName, role },
        preview: content.trim().slice(0, 80),
        createdAt: message.createdAt,
      });
      if (typeof ack === "function") ack({ ok: true, message: payload });
    } catch (error) {
      console.error("[Socket] send_message error:", error);
      if (typeof ack === "function") {
        ack({ error: "Lỗi máy chủ, vui lòng thử lại." });
      }
    }
  });

  socket.on("typing", ({ otherUserId, isTyping } = {}) => {
    if (!otherUserId) return;
    const roomId = buildRoomId(userId, otherUserId);
    socket.to(roomId).emit("user_typing", {
      userId: String(userId),
      fullName,
      isTyping: Boolean(isTyping),
    });
  });

  socket.on("mark_read", async ({ otherUserId } = {}) => {
    if (!otherUserId) return;
    const roomId = buildRoomId(userId, otherUserId);
    await Message.updateMany(
      { roomId, sender: otherUserId, read: false },
      { $set: { read: true } },
    ).catch((error) => console.error("[Socket] mark_read error:", error));
    io.to(String(otherUserId)).emit("messages_read", { roomId });
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] ${fullName} ngắt kết nối`);
  });
});

const port = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDB();
    console.log("MongoDB connected successfully");

    await seedAdmin();

    httpServer.listen(port, () => {
      console.log(`Local Buddy API listening on http://localhost:${port}`);
      startBookingExpiryWorker();
    });
  } catch (err) {
    console.error("Không thể khởi động server:", err.message);
    process.exit(1);
  }
}

startServer();
