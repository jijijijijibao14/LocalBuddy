/**
 * Socket.IO singleton – dùng chung một kết nối trong toàn bộ FE.
 */
import { io } from "socket.io-client";

let socket = null;

/**
 * Lấy hoặc tạo socket kết nối đến server.
 * @param {string} serverUrl  URL của backend (không cần /api)
 * @param {string} token      JWT token
 * @returns {import("socket.io-client").Socket}
 */
export function getSocket(serverUrl, token) {
  if (socket && socket.connected) return socket;

  // Huỷ kết nối cũ (nếu có) trước khi tạo mới
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(serverUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("[Socket] Kết nối thành công:", socket.id);
  });
  socket.on("connect_error", (err) => {
    console.warn("[Socket] Lỗi kết nối:", err.message);
  });
  socket.on("disconnect", (reason) => {
    console.log("[Socket] Ngắt kết nối:", reason);
  });

  return socket;
}

/** Ngắt kết nối và xoá instance */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export { socket };

