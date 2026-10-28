import { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  Send,
  MessageCircle,
  AlertTriangle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import api, { API_BASE_URL } from "../services/api";
import { getSocket } from "../utils/socket";
import { validateMessage } from "../utils/messageValidator";

/**
 * Lấy URL socket từ API_BASE_URL (bỏ /api ở cuối)
 * Ví dụ: http://localhost:3001/api → http://localhost:3001
 */
function getSocketUrl() {
  return API_BASE_URL.replace(/\/api$/, "");
}

/**
 * Format thời gian hiển thị trong chat.
 */
function formatTime(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format ngày nhóm tin nhắn.
 */
function formatDateGroup(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today - msgDay) / 86400000;

  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * ChatModal – hộp chat nổi (float) giữa Traveler và Local.
 *
 * Props:
 *  - otherUser: { _id, fullName, avatar, role }
 *  - currentUser: { _id, fullName, avatar, role }
 *  - onClose: () => void
 */
export default function ChatModal({ otherUser, currentUser, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [inputError, setInputError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);

  const token = localStorage.getItem("lb_token");

  // ── Cuộn xuống cuối ──────────────────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // ── Tải lịch sử tin nhắn ────────────────────────────────────────────────
  const loadMessages = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        const { data } = await api.get(
          `/chat/${otherUser._id}/messages?page=${pageNum}&limit=50`
        );

        const newMsgs = data.messages || [];
        if (append) {
          setMessages((prev) => [...newMsgs, ...prev]);
        } else {
          setMessages(newMsgs);
          // Scroll xuống sau khi tải lần đầu
          setTimeout(() => scrollToBottom(false), 100);
        }

        setHasMore(pageNum < (data.pagination?.pages || 1));
        setPage(pageNum);
      } catch {
        /* bỏ qua lỗi tải lịch sử */
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [otherUser._id, scrollToBottom]
  );

  // ── Kết nối Socket.IO ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const sock = getSocket(getSocketUrl(), token);
    socketRef.current = sock;

    function onConnect() {
      setConnected(true);
      setSocketError("");
      sock.emit("join_room", { otherUserId: otherUser._id });
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onConnectError(err) {
      setSocketError("Mất kết nối realtime. Tin nhắn sẽ gửi chậm hơn.");
      setConnected(false);
    }

    function onNewMessage(msg) {
      setMessages((prev) => {
        // Tránh trùng lặp
        if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
      setTimeout(() => scrollToBottom(true), 50);
    }

    function onUserTyping({ userId, isTyping: typing }) {
      if (String(userId) === String(otherUser._id)) {
        setIsTyping(typing);
      }
    }

    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);
    sock.on("connect_error", onConnectError);
    sock.on("new_message", onNewMessage);
    sock.on("user_typing", onUserTyping);

    // Nếu đã kết nối từ trước
    if (sock.connected) {
      setConnected(true);
      sock.emit("join_room", { otherUserId: otherUser._id });
    }

    return () => {
      sock.emit("leave_room", { otherUserId: otherUser._id });
      sock.off("connect", onConnect);
      sock.off("disconnect", onDisconnect);
      sock.off("connect_error", onConnectError);
      sock.off("new_message", onNewMessage);
      sock.off("user_typing", onUserTyping);
    };
  }, [otherUser._id, token, scrollToBottom]);

  // ── Tải tin nhắn lần đầu ────────────────────────────────────────────────
  useEffect(() => {
    loadMessages(1, false);
  }, [loadMessages]);

  // ── Đánh dấu đã đọc khi mở chat ────────────────────────────────────────
  useEffect(() => {
    api.patch(`/chat/${otherUser._id}/read`).catch(() => {});
    if (socketRef.current?.connected) {
      socketRef.current.emit("mark_read", { otherUserId: otherUser._id });
    }
  }, [otherUser._id]);

  // ── Xử lý typing indicator ──────────────────────────────────────────────
  const handleTyping = useCallback(
    (value) => {
      setInputText(value);
      // Xoá lỗi khi user đang nhập lại
      if (inputError) setInputError("");

      if (socketRef.current?.connected) {
        socketRef.current.emit("typing", {
          otherUserId: otherUser._id,
          isTyping: true,
        });
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          socketRef.current?.emit("typing", {
            otherUserId: otherUser._id,
            isTyping: false,
          });
        }, 1500);
      }
    },
    [otherUser._id, inputError]
  );

  // ── Gửi tin nhắn ────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();

    // Validate phía client trước
    const validation = validateMessage(text);
    if (!validation.valid) {
      setInputError(validation.reason);
      inputRef.current?.focus();
      return;
    }

    setSending(true);
    setInputError("");

    // Dừng typing indicator
    clearTimeout(typingTimerRef.current);
    socketRef.current?.emit("typing", {
      otherUserId: otherUser._id,
      isTyping: false,
    });

    if (socketRef.current?.connected) {
      // Gửi qua Socket.IO (realtime)
      socketRef.current.emit(
        "send_message",
        { otherUserId: otherUser._id, content: text },
        (ack) => {
          setSending(false);
          if (ack?.error) {
            setInputError(ack.error);
          } else {
            setInputText("");
          }
        }
      );
    } else {
      // Fallback: gửi qua REST API
      try {
        const { data } = await api.post(`/chat/${otherUser._id}/messages`, {
          content: text,
        });
        setMessages((prev) => [...prev, data.message]);
        setInputText("");
        setTimeout(() => scrollToBottom(true), 50);
      } catch (err) {
        setInputError(
          err.response?.data?.message || "Không thể gửi tin nhắn."
        );
      } finally {
        setSending(false);
      }
    }
  }, [inputText, otherUser._id, scrollToBottom]);

  // ── Enter để gửi ────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ── Tải thêm tin cũ khi cuộn lên ────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadMessages(page + 1, true);
    }
  }, [loadingMore, hasMore, loadMessages, page]);

  // ── Group tin nhắn theo ngày ──────────────────────────────────────────
  const grouped = [];
  let lastDate = null;
  for (const msg of messages) {
    const dStr = formatDateGroup(msg.createdAt);
    if (dStr !== lastDate) {
      grouped.push({ type: "date", label: dStr });
      lastDate = dStr;
    }
    grouped.push({ type: "msg", msg });
  }

  const isMine = (msg) =>
    String(msg.sender?._id || msg.sender) === String(currentUser._id);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-center sm:justify-end pointer-events-none p-0 sm:p-6">
      {/* Backdrop mờ nhẹ cho mobile */}
      <div
        className="absolute inset-0 bg-black/30 sm:hidden pointer-events-auto"
        onClick={onClose}
      />

      {/* Chat box */}
      <div className="relative flex flex-col w-full h-full sm:w-[400px] sm:h-[600px] sm:max-h-[90vh] bg-white sm:rounded-2xl shadow-2xl pointer-events-auto overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white">
          <div className="relative shrink-0">
            {otherUser.avatar ? (
              <img
                src={otherUser.avatar}
                alt={otherUser.fullName}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-sm font-bold ring-2 ring-white/30">
                {otherUser.fullName?.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                connected ? "bg-emerald-400" : "bg-slate-400"
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">
              {otherUser.fullName}
            </p>
            <p className="text-[11px] text-blue-200">
              {connected ? "Đang trực tuyến" : "Đang kết nối lại..."}
              {isTyping && " · đang nhập..."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 hover:bg-white/20 transition-colors"
            aria-label="Đóng chat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Safety notice */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700">
          <ShieldCheck size={12} className="shrink-0" />
          <span>
            Không chia sẻ SĐT, Zalo hoặc link ngoài (trừ Google Maps) để bảo
            vệ quyền lợi của bạn.
          </span>
        </div>

        {socketError && (
          <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
            <AlertTriangle size={12} className="shrink-0" />
            <span>{socketError}</span>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {hasMore && (
            <div className="flex justify-center pb-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 size={12} className="inline animate-spin mr-1" />
                ) : null}
                Tải tin nhắn cũ hơn
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <MessageCircle size={40} strokeWidth={1.5} />
              <p className="text-sm">Bắt đầu cuộc trò chuyện với {otherUser.fullName}!</p>
            </div>
          ) : (
            grouped.map((item, idx) => {
              if (item.type === "date") {
                return (
                  <div
                    key={`date-${idx}`}
                    className="flex items-center gap-2 py-2"
                  >
                    <div className="flex-1 border-t border-slate-100" />
                    <span className="text-[10px] text-slate-400 font-medium">
                      {item.label}
                    </span>
                    <div className="flex-1 border-t border-slate-100" />
                  </div>
                );
              }

              const { msg } = item;
              const mine = isMine(msg);

              return (
                <div
                  key={msg._id || idx}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  {!mine && (
                    <div className="mr-2 mt-auto shrink-0">
                      {otherUser.avatar ? (
                        <img
                          src={otherUser.avatar}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                          {otherUser.fullName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed break-words ${
                      mine
                        ? "rounded-br-sm bg-blue-600 text-white"
                        : "rounded-bl-sm bg-slate-100 text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        mine ? "text-blue-200 text-right" : "text-slate-400"
                      }`}
                    >
                      {formatTime(msg.createdAt)}
                      {mine && msg.read && (
                        <span className="ml-1">✓✓</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="mr-2 mt-auto shrink-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                  {otherUser.fullName?.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2">
                <div className="flex gap-1 items-center h-4">
                  <span className="animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400 [animation-delay:0ms]" />
                  <span className="animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-100 bg-white px-3 py-3">
          {inputError && (
            <div className="mb-2 flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[11px] text-red-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{inputError}</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all max-h-28 overflow-y-auto"
              placeholder="Nhập tin nhắn... (Enter để gửi)"
              value={inputText}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={2000}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={sending || !inputText.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Gửi"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 text-right">
            {inputText.length}/2000
          </p>
        </div>
      </div>
    </div>
  );
}

