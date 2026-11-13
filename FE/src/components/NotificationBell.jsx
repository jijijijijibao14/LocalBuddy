import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api, { API_BASE_URL } from "../services/api";
import { getSocket } from "../utils/socket";

export default function NotificationBell({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadNotifications = useCallback(async (requestedPage = page) => {
    try {
      const targetPage = Number.isInteger(requestedPage) ? requestedPage : page;
      const { data } = await api.get("/notifications", {
        params: { page: targetPage },
      });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setPage(data.page || targetPage);
      setPageCount(data.pageCount || 1);
      setError("");
    } catch (requestError) {
      console.error("Load header notifications error:", requestError);
      setError(requestError.response?.data?.message || "Không thể tải thông báo.");
    }
  }, [page]);

  useEffect(() => {
    loadNotifications(page);
    const interval = window.setInterval(() => loadNotifications(page), 30000);
    window.addEventListener("lb-notifications-change", loadNotifications);
    const token = localStorage.getItem("lb_token");
    const socket = token ? getSocket(API_BASE_URL.replace(/\/api$/, ""), token) : null;
    socket?.on("new_notification", loadNotifications);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("lb-notifications-change", loadNotifications);
      socket?.off("new_notification", loadNotifications);
    };
  }, [loadNotifications, page]);

  const firstVisiblePage = pageCount <= 3
    ? 1
    : Math.max(1, Math.min(page - 1, pageCount - 2));
  const visiblePages = Array.from(
    { length: Math.min(3, pageCount) },
    (_, index) => firstVisiblePage + index,
  );

  async function openNotification(notification) {
    if (!notification.readAt) {
      try {
        await api.patch(`/notifications/${notification._id}/read`);
        setNotifications((current) => current.map((item) => item._id === notification._id
          ? { ...item, readAt: new Date().toISOString() }
          : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (requestError) {
        console.error("Mark notification read error:", requestError);
        setError(requestError.response?.data?.message || "Không thể cập nhật thông báo.");
      }
    }
    setOpen(false);
    onNavigate?.();
    navigate(notification.link || "/");
  }

  async function markAllRead() {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((current) => current.map((item) => ({
        ...item,
        readAt: item.readAt || new Date().toISOString(),
      })));
      setUnreadCount(0);
    } catch (requestError) {
      console.error("Mark all notifications read error:", requestError);
      setError(requestError.response?.data?.message || "Không thể cập nhật thông báo.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        aria-label={`Thông báo${unreadCount ? `, ${unreadCount} mới` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section className="absolute right-0 top-12 z-[70] w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" aria-label="Thông báo">
          <header className="flex items-center justify-between border-b border-slate-100 p-3">
            <h2 className="text-sm font-extrabold text-navy">Thông báo</h2>
            <button type="button" className="inline-flex items-center gap-1 text-[10px] font-bold text-brand disabled:opacity-50" onClick={markAllRead} disabled={!unreadCount}>
              <CheckCheck size={14} /> Đánh dấu đã đọc
            </button>
          </header>
          {error && <p className="p-3 text-[11px] text-red-700" role="alert">{error}</p>}
          <div className="max-h-[min(60vh,26rem)] overflow-y-auto">
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification._id}
                onClick={() => openNotification(notification)}
                className={`block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 ${notification.readAt ? "" : "bg-blue-50/60"}`}
              >
                <span className="flex items-start gap-2">
                  {!notification.readAt && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />}
                  <span className="min-w-0">
                    <b className="block text-xs text-navy">{notification.title}</b>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-600">{notification.message}</span>
                    <time className="mt-0.5 block text-[9px] text-slate-400">{new Date(notification.createdAt).toLocaleString("vi-VN")}</time>
                  </span>
                </span>
              </button>
            ))}
            {!notifications.length && !error && <p className="p-5 text-center text-xs text-slate-500">Chưa có thông báo.</p>}
          </div>
          {pageCount > 1 && (
            <nav className="flex items-center justify-center gap-1 border-t border-slate-100 p-2" aria-label="Phân trang thông báo">
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                disabled={page === 1}
                aria-label="Trang trước"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                &lt;
              </button>
              {pageCount > 3 && firstVisiblePage > 1 && <span className="px-1 text-xs text-slate-400">...</span>}
              {visiblePages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  aria-current={pageNumber === page ? "page" : undefined}
                  className={pageNumber === page ? "rounded bg-brand px-2 py-1 text-xs font-bold text-white" : "rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              {pageCount > 3 && firstVisiblePage + 2 < pageCount && <span className="px-1 text-xs text-slate-400">...</span>}
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                disabled={page === pageCount}
                aria-label="Trang sau"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                &gt;
              </button>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
