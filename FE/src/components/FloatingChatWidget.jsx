import { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageCircle,
  X,
  Send,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Minus,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import api, { API_BASE_URL } from "../services/api";
import { getSocket } from "../utils/socket";
import { validateMessage } from "../utils/messageValidator";

function getSocketUrl() {
  return API_BASE_URL.replace(/\/api$/, "");
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("lb_user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    const user = u.user && !u.fullName ? u.user : u;
    if (user && !user._id && user.id) user._id = user.id;
    return user;
  } catch {
    return null;
  }
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return Math.floor(hrs / 24) + "d";
}

// Chuyển link Google Maps trong tin nhắn thành thẻ <a> click được
function renderMessageContent(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline font-semibold text-blue-200 hover:text-white break-all"
        >
          <span>{part}</span>
          <ExternalLink size={11} className="shrink-0" />
        </a>
      );
    }
    return part;
  });
}

export default function FloatingChatWidget() {
  const [user, setUser] = useState(getStoredUser);
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState(null);

  // State danh sách hội thoại
  const [conversations, setConversations] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // State phòng chat đang mở
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [inputError, setInputError] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);

  const token = localStorage.getItem("lb_token");

  // Đồng bộ user khi đăng nhập / đăng xuất
  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    window.addEventListener("lb-auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lb-auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Lắng nghe sự kiện toàn cục: khi nhấn vào chat bất kỳ đâu trên web thì mở ngay trong bong bóng
  useEffect(() => {
    function handleOpenChatEvent(e) {
      const { otherUser } = e.detail || {};
      setIsOpen(true);
      if (otherUser) {
        setActiveChatUser(otherUser);
      }
    }
    window.addEventListener("lb-open-chat", handleOpenChatEvent);
    return () => window.removeEventListener("lb-open-chat", handleOpenChatEvent);
  }, []);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Tải danh sách hội thoại
  const loadConversations = useCallback(async () => {
    if (!token || !user) return;
    try {
      setLoadingConversations(true);
      const { data } = await api.get("/chat/conversations");
      const list = data.conversations || [];
      setConversations(list);
      const unread = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setTotalUnread(unread);
    } catch {
      /* ignore */
    } finally {
      setLoadingConversations(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (token && user) {
      loadConversations();
    }
  }, [token, user, loadConversations]);

  // Tải tin nhắn khi mở phòng chat với một người
  useEffect(() => {
    if (!activeChatUser?._id || !token) return;

    let cancelled = false;
    async function fetchChatMessages() {
      try {
        setLoadingMessages(true);
        const { data } = await api.get(
          `/chat/${activeChatUser._id}/messages?page=1&limit=50`
        );
        if (!cancelled) {
          setMessages(data.messages || []);
          setTimeout(() => scrollToBottom(false), 50);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    fetchChatMessages();
    api.patch(`/chat/${activeChatUser._id}/read`).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeChatUser?._id, token, scrollToBottom]);

  // Kết nối Socket.IO toàn cục
  useEffect(() => {
    if (!token || !user?._id) return;

    const sock = getSocket(getSocketUrl(), token);
    socketRef.current = sock;

    function onConnect() {
      setConnected(true);
      if (activeChatUser?._id) {
        sock.emit("join_room", { otherUserId: activeChatUser._id });
      }
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onNewMessageNotification({ roomId, from, preview, createdAt }) {
      // Cập nhật danh sách hội thoại
      setConversations((prev) => {
        const existing = prev.find((c) => c.roomId === roomId);
        if (existing) {
          return prev.map((c) =>
            c.roomId === roomId
              ? {
                  ...c,
                  lastMessage: { content: preview, sender: from, createdAt },
                  unreadCount: (c.unreadCount || 0) + 1,
                }
              : c
          );
        }
        loadConversations();
        return prev;
      });
      setTotalUnread((prev) => prev + 1);
    }

    function onNewMessage(msg) {
      if (
        activeChatUser?._id &&
        (String(msg.sender?._id || msg.sender) === String(activeChatUser._id) ||
          String(msg.sender?._id || msg.sender) === String(user._id))
      ) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
          return [...prev, msg];
        });
        setTimeout(() => scrollToBottom(true), 50);
      }
    }

    function onUserTyping({ userId, isTyping: typing }) {
      if (activeChatUser?._id && String(userId) === String(activeChatUser._id)) {
        setIsTyping(typing);
      }
    }

    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);
    sock.on("new_message_notification", onNewMessageNotification);
    sock.on("new_message", onNewMessage);
    sock.on("user_typing", onUserTyping);

    if (sock.connected) {
      setConnected(true);
      if (activeChatUser?._id) {
        sock.emit("join_room", { otherUserId: activeChatUser._id });
      }
    }

    return () => {
      sock.off("connect", onConnect);
      sock.off("disconnect", onDisconnect);
      sock.off("new_message_notification", onNewMessageNotification);
      sock.off("new_message", onNewMessage);
      sock.off("user_typing", onUserTyping);
    };
  }, [token, user?._id, activeChatUser?._id, loadConversations, scrollToBottom]);

  // Tham gia phòng khi chuyển người chat
  useEffect(() => {
    if (!socketRef.current?.connected || !activeChatUser?._id) return;
    socketRef.current.emit("join_room", { otherUserId: activeChatUser._id });
    socketRef.current.emit("mark_read", { otherUserId: activeChatUser._id });

    return () => {
      socketRef.current?.emit("leave_room", { otherUserId: activeChatUser._id });
    };
  }, [activeChatUser?._id]);

  function getOtherUser(conv) {
    const currentId = String(user?._id);
    const traveler = conv.traveler;
    const local = conv.local;
    if (String(traveler?._id) === currentId) return local;
    return traveler;
  }

  function handleSelectConversation(conv) {
    const other = getOtherUser(conv);
    if (!other) return;
    setActiveChatUser(other);
    setConversations((prev) =>
      prev.map((c) => (c.roomId === conv.roomId ? { ...c, unreadCount: 0 } : c))
    );
    setTotalUnread((prev) => Math.max(0, prev - (conv.unreadCount || 0)));
  }

  function handleTyping(text) {
    setInputText(text);
    if (inputError) setInputError("");

    if (socketRef.current?.connected && activeChatUser?._id) {
      socketRef.current.emit("typing", {
        otherUserId: activeChatUser._id,
        isTyping: true,
      });
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketRef.current?.emit("typing", {
          otherUserId: activeChatUser._id,
          isTyping: false,
        });
      }, 1500);
    }
  }

  async function handleSend() {
    const text = inputText.trim();
    if (!text || !activeChatUser?._id) return;

    // Validate nội dung: SĐT, Zalo, dép lào, link ngoài trừ Google Maps
    const validation = validateMessage(text);
    if (!validation.valid) {
      setInputError(validation.reason);
      inputRef.current?.focus();
      return;
    }

    setSending(true);
    setInputError("");

    clearTimeout(typingTimerRef.current);
    socketRef.current?.emit("typing", {
      otherUserId: activeChatUser._id,
      isTyping: false,
    });

    if (socketRef.current?.connected) {
      socketRef.current.emit(
        "send_message",
        { otherUserId: activeChatUser._id, content: text },
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
      // Fallback REST
      try {
        const { data } = await api.post(`/chat/${activeChatUser._id}/messages`, {
          content: text,
        });
        setMessages((prev) => [...prev, data.message]);
        setInputText("");
        setTimeout(() => scrollToBottom(true), 50);
      } catch (err) {
        setInputError(err.response?.data?.message || "Không thể gửi tin nhắn.");
      } finally {
        setSending(false);
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group tin nhắn theo ngày
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
    String(msg.sender?._id || msg.sender) === String(user?._id);

  if (!token || !user || user.role === "admin") return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* KHUNG CỬA SỔ BONG BÓNG CHAT MỞ RỘNG */}
      {isOpen && (
        <div className="mb-3 flex flex-col w-[350px] sm:w-[380px] h-[520px] max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* ═════════ HEADER BONG BÓNG CHAT ═════════ */}
          <div className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-3.5 py-3 text-white shadow-xs">
            {activeChatUser ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveChatUser(null);
                    loadConversations();
                  }}
                  className="rounded-lg p-1 hover:bg-white/20 transition-colors"
                  title="Quay lại danh sách hội thoại"
                >
                  <ArrowLeft size={17} />
                </button>
                <div className="relative shrink-0">
                  {activeChatUser.avatar ? (
                    <img
                      src={activeChatUser.avatar}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-white/30"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-bold ring-2 ring-white/30">
                      {activeChatUser.fullName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                      connected ? "bg-emerald-400" : "bg-slate-400"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold leading-tight">
                    {activeChatUser.fullName}
                  </p>
                  <p className="text-[10px] text-blue-200 truncate">
                    {isTyping ? "đang soạn tin nhắn..." : connected ? "Đang trực tuyến" : "Mất kết nối..."}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <MessageCircle size={18} />
                <h3 className="font-extrabold text-sm">Tin nhắn</h3>
                {totalUnread > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.2 text-[10px] font-bold text-white">
                    {totalUnread}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 hover:bg-white/20 transition-colors"
                title="Thu nhỏ bong bóng chat"
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setActiveChatUser(null);
                }}
                className="rounded-lg p-1.5 hover:bg-white/20 transition-colors"
                title="Đóng chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ═════════ NỘI DUNG BÊN TRONG BONG BÓNG CHAT ═════════ */}
          {activeChatUser ? (
            /* ── CHẾ ĐỘ 1: KHUNG CHAT TRÒ CHUYỆN VỚI NGƯỜI CỤ THỂ ── */
            <div className="flex flex-col flex-1 min-h-0 bg-slate-50/50">
              {/* Cảnh báo an toàn */}
              <div className="flex items-center gap-1.5 bg-emerald-50 border-b border-emerald-100 px-3 py-1.5 text-[10px] text-emerald-800">
                <ShieldCheck size={12} className="shrink-0 text-emerald-600" />
                <span>
                  Không chia sẻ SĐT, Zalo hoặc link ngoài (chỉ cho phép link Google Maps).
                </span>
              </div>

              {/* Danh sách tin nhắn */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 size={22} className="animate-spin text-blue-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <MessageCircle size={32} className="opacity-40" />
                    <p className="text-xs">Hãy gửi lời chào đến {activeChatUser.fullName}!</p>
                  </div>
                ) : (
                  grouped.map((item, idx) => {
                    if (item.type === "date") {
                      return (
                        <div key={`d-${idx}`} className="flex items-center gap-2 py-1.5">
                          <div className="flex-1 border-t border-slate-200" />
                          <span className="text-[9px] text-slate-400 font-medium">
                            {item.label}
                          </span>
                          <div className="flex-1 border-t border-slate-200" />
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
                          <div className="mr-1.5 mt-auto shrink-0">
                            {activeChatUser.avatar ? (
                              <img
                                src={activeChatUser.avatar}
                                alt=""
                                className="h-5 w-5 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-600">
                                {activeChatUser.fullName?.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}
                        <div
                          className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed break-words ${
                            mine
                              ? "rounded-br-xs bg-blue-600 text-white shadow-xs"
                              : "rounded-bl-xs bg-white text-slate-800 border border-slate-200/80 shadow-2xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{renderMessageContent(msg.content)}</p>
                          <p
                            className={`mt-1 text-[9px] ${
                              mine ? "text-blue-200 text-right" : "text-slate-400"
                            }`}
                          >
                            {formatTime(msg.createdAt)}
                            {mine && msg.read && <span className="ml-1">✓✓</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 pl-2 py-1">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse [animation-delay:150ms]">●</span>
                    <span className="animate-pulse [animation-delay:300ms]">●</span>
                    <span className="text-[10px] ml-1">{activeChatUser.fullName} đang soạn tin...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Ô nhập tin nhắn */}
              <div className="p-2.5 bg-white border-t border-slate-200">
                {inputError && (
                  <div className="mb-2 flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-100 p-2 text-[10px] text-red-700">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{inputError}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="Nhập tin nhắn..."
                    value={inputText}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={2000}
                    disabled={sending}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !inputText.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 transition-all"
                    title="Gửi"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── CHẾ ĐỘ 2: DANH SÁCH HỘI THOẠI BÊN TRONG BONG BÓNG ── */
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingConversations ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 size={22} className="animate-spin text-blue-500" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-8">
                    <MessageCircle size={32} className="opacity-40" />
                    <p className="text-xs">Chưa có cuộc trò chuyện nào.</p>
                  </div>
                ) : (
                  conversations.map((conv) => {
                    const other = getOtherUser(conv);
                    if (!other) return null;
                    const lastMsg = conv.lastMessage;
                    const isFromMe =
                      String(lastMsg?.sender?._id || lastMsg?.sender) === String(user?._id);

                    return (
                      <button
                        key={conv.roomId}
                        type="button"
                        onClick={() => handleSelectConversation(conv)}
                        className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left hover:bg-blue-50/60 transition-colors border border-transparent hover:border-blue-100"
                      >
                        <div className="relative shrink-0">
                          {other.avatar ? (
                            <img
                              src={other.avatar}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                              {other.fullName?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {conv.unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-white">
                              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-bold text-navy">
                              {other.fullName}
                            </p>
                            {lastMsg?.createdAt && (
                              <span className="shrink-0 text-[10px] text-slate-400">
                                {timeAgo(lastMsg.createdAt)}
                              </span>
                            )}
                          </div>
                          <p
                            className={`truncate text-[11px] mt-0.5 ${
                              conv.unreadCount > 0 ? "font-bold text-slate-900" : "text-slate-400"
                            }`}
                          >
                            {isFromMe ? "Bạn: " : ""}
                            {lastMsg?.content || "Bắt đầu cuộc trò chuyện"}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════ NÚT TRÒN BONG BÓNG CHAT GÓC DƯỚI BÊN PHẢI ═════════ */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && !activeChatUser) loadConversations();
        }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
        title="Bong bóng tin nhắn"
        aria-label="Bong bóng tin nhắn"
      >
        {isOpen ? <Minus size={24} /> : <MessageCircle size={26} />}
        {totalUnread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
