import { useEffect, useState, useCallback, useRef } from "react";
import { MessageCircle, RefreshCw, Loader2 } from "lucide-react";
import api, { API_BASE_URL } from "../services/api";
import ChatModal from "./ChatModal";
import { getSocket } from "../utils/socket";

function getSocketUrl() {
  return API_BASE_URL.replace(/\/api$/, "");
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("lb_user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u.user && !u.fullName ? u.user : u;
  } catch {
    return null;
  }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return Math.floor(hrs / 24) + " ngày trước";
}

/**
 * ConversationList – hiển thị danh sách hội thoại và mở ChatModal.
 * 
 * Props:
 *  - currentUser: { _id, fullName, avatar, role }
 */
export default function ConversationList({ currentUser }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const socketRef = useRef(null);
  const token = localStorage.getItem("lb_token");

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/chat/conversations");
      setConversations(data.conversations || []);
    } catch {
      /* bỏ qua */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    loadConversations();
  }, [loadConversations, token]);

  // Lắng nghe thông báo tin nhắn mới để cập nhật badge
  useEffect(() => {
    if (!token || !currentUser?._id) return;

    const sock = getSocket(getSocketUrl(), token);
    socketRef.current = sock;

    function onNotification({ roomId, from, preview, createdAt }) {
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
        // Conversation mới – reload
        loadConversations();
        return prev;
      });
    }

    sock.on("new_message_notification", onNotification);
    return () => {
      sock.off("new_message_notification", onNotification);
    };
  }, [token, currentUser?._id, loadConversations]);

  function getOtherUser(conv) {
    const currentId = String(currentUser?._id);
    const traveler = conv.traveler;
    const local = conv.local;
    if (String(traveler?._id) === currentId) return local;
    return traveler;
  }

  function openChat(conv) {
    const other = getOtherUser(conv);
    if (!other) return;
    window.dispatchEvent(
      new CustomEvent("lb-open-chat", {
        detail: { otherUser: other },
      })
    );
  }

  function handleChatClose() {
    setActiveChatUser(null);
    loadConversations(); // Reload để cập nhật trạng thái đọc
  }

  if (!token) return null;

  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-extrabold">
          <MessageCircle size={18} className="text-brand" />
          Tin nhắn trực tiếp
        </h2>
        <button
          className="btn-light !py-2"
          onClick={loadConversations}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={22} className="animate-spin text-blue-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">
          <MessageCircle size={32} className="mx-auto mb-2 opacity-40" strokeWidth={1.5} />
          Chưa có cuộc trò chuyện nào.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {conversations.map((conv) => {
            const other = getOtherUser(conv);
            if (!other) return null;
            const lastMsg = conv.lastMessage;
            const isFromMe =
              String(lastMsg?.sender?._id || lastMsg?.sender) ===
              String(currentUser?._id);

            return (
              <li key={conv.roomId}>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition-all hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-sm"
                  onClick={() => openChat(conv)}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {other.avatar ? (
                      <img
                        src={other.avatar}
                        alt={other.fullName}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-600">
                        {other.fullName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {conv.unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-navy">
                        {other.fullName}
                      </p>
                      {lastMsg?.createdAt && (
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {timeAgo(lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    {lastMsg && (
                      <p
                        className={`mt-0.5 truncate text-[11px] ${
                          conv.unreadCount > 0
                            ? "font-semibold text-slate-700"
                            : "text-slate-400"
                        }`}
                      >
                        {isFromMe && (
                          <span className="text-slate-400">Bạn: </span>
                        )}
                        {lastMsg.content?.slice(0, 60)}
                      </p>
                    )}
                  </div>

                  {/* Role badge */}
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                    {other.role === "local" ? "Local" : "Traveler"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}


    </section>
  );
}

